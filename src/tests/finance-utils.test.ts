import { describe, expect, test } from 'vitest';
import {
	aggregateByCategory,
	aggregateByTag,
	aggregateSeries,
	calculateBackwardBalanceSeries
} from '$lib/services/finance/utils';

describe('finance aggregate series', () => {
	test('excludes transfer transactions from income/expense/net', () => {
		const start = new Date('2026-10-01T00:00:00.000Z');
		const end = new Date('2026-10-31T23:59:59.999Z');

		const tx = [
			{
				raw: {
					id: 't1',
					created_at: '2026-10-05T12:00:00.000Z',
					amount: 5000,
					description: 'Paycheck',
					bucket_id: 'b1',
					transfer_sibling: null
				}
			},
			{
				raw: {
					id: 't2',
					created_at: '2026-10-06T12:00:00.000Z',
					amount: -1200,
					description: 'Coffee',
					bucket_id: 'b1',
					transfer_sibling: null
				}
			},
			{
				raw: {
					id: 't3',
					created_at: '2026-10-07T12:00:00.000Z',
					amount: -3000,
					description: 'Transfer to savings',
					bucket_id: 'b1',
					transfer_sibling: 't4'
				}
			}
		] as never;

		const result = aggregateSeries(tx, { start, end });
		const incomeTotal = result.income.reduce((sum, value) => sum + value, 0);
		const expenseTotal = result.expenses.reduce((sum, value) => sum + value, 0);
		const netTotal = result.net.reduce((sum, value) => sum + value, 0);

		expect(incomeTotal).toBe(50);
		expect(expenseTotal).toBe(12);
		expect(netTotal).toBe(38);
	});

	test('does not exclude potential transfer-like pairs without transfer_sibling', () => {
		const start = new Date('2026-10-01T00:00:00.000Z');
		const end = new Date('2026-10-31T23:59:59.999Z');

		const tx = [
			{
				raw: {
					id: 't1',
					created_at: '2026-10-05T12:00:00.000Z',
					amount: -5000,
					description: 'Transfer out maybe',
					bucket_id: 'b1',
					transfer_sibling: null
				}
			},
			{
				raw: {
					id: 't2',
					created_at: '2026-10-05T12:00:00.000Z',
					amount: 5000,
					description: 'Transfer in maybe',
					bucket_id: 'b2',
					transfer_sibling: null
				}
			}
		] as never;

		const result = aggregateSeries(tx, { start, end });
		const incomeTotal = result.income.reduce((sum, value) => sum + value, 0);
		const expenseTotal = result.expenses.reduce((sum, value) => sum + value, 0);
		const netTotal = result.net.reduce((sum, value) => sum + value, 0);

		expect(incomeTotal).toBe(50);
		expect(expenseTotal).toBe(50);
		expect(netTotal).toBe(0);
	});

	test('aggregates by category', () => {
		const tx = [
			{ id: 't1', raw: { amount: 5000, category: 'c-income', transfer_sibling: null } },
			{ id: 't2', raw: { amount: -1200, category: 'c-food', transfer_sibling: null } },
			{ id: 't3', raw: { amount: -800, category: null, transfer_sibling: null } }
		] as never;

		const result = aggregateByCategory(tx, (categoryId) => {
			if (categoryId === 'c-income') return 'Income';
			if (categoryId === 'c-food') return 'Food';
			return 'Unassigned';
		});

		expect(result).toEqual([
			{ label: 'Income', income: 50, expenses: 0, net: 50 },
			{ label: 'Food', income: 0, expenses: 12, net: -12 },
			{ label: 'Unassigned', income: 0, expenses: 8, net: -8 }
		]);
	});

	test('aggregates by tag', () => {
		const tx = [
			{ id: 't1', raw: { id: 't1', amount: 5000, transfer_sibling: null } },
			{ id: 't2', raw: { id: 't2', amount: -1200, transfer_sibling: null } },
			{ id: 't3', raw: { id: 't3', amount: -800, transfer_sibling: null } }
		] as never;

		const result = aggregateByTag(tx, (id) => {
			if (id === 't1') return ['Salary'];
			if (id === 't2') return ['Food', 'Coffee'];
			return [];
		});

		expect(result).toEqual([
			{ label: 'Salary', income: 50, expenses: 0, net: 50 },
			{ label: 'Food', income: 0, expenses: 12, net: -12 },
			{ label: 'Coffee', income: 0, expenses: 12, net: -12 },
			{ label: 'Untagged', income: 0, expenses: 8, net: -8 }
		]);
	});

	describe('backward balance series', () => {
		test('works backwards from total balance', () => {
			const balances = calculateBackwardBalanceSeries([1000, -500, 250], 10_000);
			expect(balances).toEqual([102.5, 97.5, 100]);
		});
	});
});
