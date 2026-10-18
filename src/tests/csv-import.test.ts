import { describe, expect, test } from 'vitest';
import {
	parseAmountToMinorUnit,
	parseDebitCreditToMinorUnit
} from '$lib/services/finance/csv-import';

describe('CSV amount conversion', () => {
	test('converts major currency strings to cents', () => {
		expect(
			parseAmountToMinorUnit('0.01', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: 1 });

		expect(
			parseAmountToMinorUnit('12.34', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: 1234 });

		expect(
			parseAmountToMinorUnit('100.00', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: 10000 });
	});

	test('handles negatives and parentheses', () => {
		expect(
			parseAmountToMinorUnit('-$12.34', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: -1234 });

		expect(
			parseAmountToMinorUnit('($12.34)', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: -1234 });
	});

	test('supports large values and zero', () => {
		expect(
			parseAmountToMinorUnit('0', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: 0 });

		expect(
			parseAmountToMinorUnit('90071992547409.91', {
				unit: 'major',
				signStrategy: 'signed'
			})
		).toEqual({ ok: true, cents: 9007199254740991 });
	});

	test('rejects precision above supported minor units', () => {
		const parsed = parseAmountToMinorUnit('12.345', {
			unit: 'major',
			signStrategy: 'signed'
		});
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.error).toContain('Too many decimal places');
	});

	test('supports indicator based sign mapping', () => {
		expect(
			parseAmountToMinorUnit('12.34', {
				unit: 'major',
				signStrategy: 'indicator-column',
				indicatorValue: 'debit',
				indicatorExpenseValues: 'debit,expense,outflow',
				indicatorIncomeValues: 'credit,income,inflow'
			})
		).toEqual({ ok: true, cents: -1234 });

		expect(
			parseAmountToMinorUnit('12.34', {
				unit: 'major',
				signStrategy: 'indicator-column',
				indicatorValue: 'credit',
				indicatorExpenseValues: 'debit,expense,outflow',
				indicatorIncomeValues: 'credit,income,inflow'
			})
		).toEqual({ ok: true, cents: 1234 });
	});

	test('supports separate debit/credit columns', () => {
		expect(
			parseDebitCreditToMinorUnit('12.34', '', {
				unit: 'major'
			})
		).toEqual({ ok: true, cents: -1234 });

		expect(
			parseDebitCreditToMinorUnit('', '12.34', {
				unit: 'major'
			})
		).toEqual({ ok: true, cents: 1234 });
	});
});
