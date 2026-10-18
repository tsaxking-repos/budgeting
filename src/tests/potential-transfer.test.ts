import { describe, expect, test } from 'vitest';
import {
	detectPotentialTransferMatches,
	normalizeTransferPair,
	transferPairKey,
	type PotentialTransferLike
} from '$lib/services/finance/potential-transfer';

const tx = (input: Partial<PotentialTransferLike> & Pick<PotentialTransferLike, 'id'>) => ({
	id: input.id,
	created_at: input.created_at ?? '2026-10-18T12:00:00.000Z',
	amount: input.amount ?? 0,
	bucket_id: input.bucket_id ?? 'bucket-a',
	description: input.description ?? null,
	transfer_sibling: input.transfer_sibling ?? null
});

describe('potential transfer detection', () => {
	test('matches opposite amounts within 3 calendar days', () => {
		const rows = [
			tx({ id: 'a', amount: -5000, created_at: '2026-10-18T09:00:00.000Z' }),
			tx({ id: 'b', amount: 5000, created_at: '2026-10-21T21:30:00.000Z' }),
			tx({ id: 'c', amount: 5000, created_at: '2026-10-22T09:00:00.000Z' })
		];

		const result = detectPotentialTransferMatches(rows);
		expect(result.get('a')?.map((match) => match.id)).toEqual(['b']);
		expect(result.get('b')?.map((match) => match.id)).toEqual(['a']);
		expect(result.has('c')).toBe(false);
	});

	test('does not require descriptions to match', () => {
		const rows = [
			tx({ id: 'a', amount: -8200, description: 'Bank transfer out' }),
			tx({ id: 'b', amount: 8200, description: 'ACH CREDIT EXT' })
		];
		const result = detectPotentialTransferMatches(rows);
		expect(result.get('a')?.[0]?.id).toBe('b');
	});

	test('allows same-account opposite amounts as potential transfers', () => {
		const rows = [
			tx({ id: 'a', amount: -4100, bucket_id: 'bucket-1' }),
			tx({ id: 'b', amount: 4100, bucket_id: 'bucket-1' })
		];
		const result = detectPotentialTransferMatches(rows);
		expect(result.get('a')?.[0]?.id).toBe('b');
	});

	test('returns multiple matches when ambiguous', () => {
		const rows = [
			tx({ id: 'a', amount: -1200 }),
			tx({ id: 'b', amount: 1200 }),
			tx({ id: 'c', amount: 1200 })
		];
		const result = detectPotentialTransferMatches(rows);
		expect(result.get('a')?.map((match) => match.id)).toEqual(['b', 'c']);
	});

	test('excludes already confirmed transfers', () => {
		const rows = [
			tx({ id: 'a', amount: -3300, transfer_sibling: 'b' }),
			tx({ id: 'b', amount: 3300, transfer_sibling: 'a' }),
			tx({ id: 'c', amount: -3300 }),
			tx({ id: 'd', amount: 3300 })
		];
		const result = detectPotentialTransferMatches(rows);
		expect(result.has('a')).toBe(false);
		expect(result.has('b')).toBe(false);
		expect(result.get('c')?.map((match) => match.id)).toEqual(['d']);
	});

	test('does not allow self matching', () => {
		const rows = [tx({ id: 'a', amount: 0 })];
		const result = detectPotentialTransferMatches(rows);
		expect(result.has('a')).toBe(false);
	});

	test('supports dismissing suggestions by transaction pair', () => {
		const rows = [
			tx({ id: 'a', amount: -1000 }),
			tx({ id: 'b', amount: 1000 }),
			tx({ id: 'c', amount: 1000 })
		];
		const dismissed = new Set<string>([transferPairKey('a', 'b')]);
		const result = detectPotentialTransferMatches(rows, dismissed);
		expect(result.get('a')?.map((match) => match.id)).toEqual(['c']);
		expect(result.has('b')).toBe(false);
	});

	test('normalizes dismissal pair ids consistently', () => {
		expect(normalizeTransferPair('b', 'a')).toEqual({
			left_transaction_id: 'a',
			right_transaction_id: 'b'
		});
	});

	test('does not match unrelated transactions', () => {
		const rows = [
			tx({ id: 'a', amount: -5000, created_at: '2026-10-18T12:00:00.000Z' }),
			tx({ id: 'b', amount: 4900, created_at: '2026-10-18T12:00:00.000Z' }),
			tx({ id: 'c', amount: 5000, created_at: '2026-10-23T12:00:00.000Z' })
		];
		const result = detectPotentialTransferMatches(rows);
		expect(result.size).toBe(0);
	});
});
