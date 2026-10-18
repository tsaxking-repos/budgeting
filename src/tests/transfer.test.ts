import { describe, expect, test } from 'vitest';
import {
	buildClearedTransferUpdate,
	buildLinkedTransferUpdate,
	createTransferSiblingPayload,
	isTransferTransaction
} from '$lib/services/finance/transfer';

describe('transfer helpers', () => {
	test('identifies transfer transactions by sibling id', () => {
		expect(isTransferTransaction({ transfer_sibiling: null })).toBe(false);
		expect(isTransferTransaction({ transfer_sibling: '' })).toBe(false);
		expect(isTransferTransaction({ transfer_sibiling: 'abc-123' })).toBe(true);
	});

	test('builds sibling payload with opposite amount', () => {
		const sibling = createTransferSiblingPayload(
			{
				amount: -1250,
				created_at: '2026-10-18T12:00:00.000Z',
				description: 'Transfer to Savings'
			},
			'bucket-2'
		);

		expect(sibling.amount).toBe(1250);
		expect(sibling.bucket_id).toBe('bucket-2');
		expect(sibling.created_at).toBe('2026-10-18T12:00:00.000Z');
		expect(sibling.description).toBe('Transfer to Savings');
	});

	test('preserves nullable description in sibling payload', () => {
		const sibling = createTransferSiblingPayload(
			{
				amount: 500,
				created_at: '2026-10-18T12:00:00.000Z',
				description: null
			},
			'bucket-2'
		);

		expect(sibling.description).toBeNull();
	});

	test('builds symmetric transfer link updates', () => {
		expect(buildLinkedTransferUpdate('left', 'right')).toEqual({
			id: 'left',
			transfer_sibling: 'right'
		});
	});

	test('builds transfer unlink updates', () => {
		expect(buildClearedTransferUpdate('left')).toEqual({
			id: 'left',
			transfer_sibling: null
		});
	});
});
