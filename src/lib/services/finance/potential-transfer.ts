import { getTransferSiblingId } from '$lib/services/finance/transfer';

export type PotentialTransferLike = {
	id: string;
	created_at: string;
	amount: number;
	bucket_id: string;
	description: string | null;
	transfer_sibling?: string | null;
	transfer_sibiling?: string | null;
};

export type PotentialTransferMatch = {
	id: string;
	created_at: string;
	amount: number;
	bucket_id: string;
	description: string | null;
};

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

export const transferPairKey = (leftId: string, rightId: string) =>
	leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;

export const normalizeTransferPair = (leftId: string, rightId: string) =>
	leftId < rightId
		? { left_transaction_id: leftId, right_transaction_id: rightId }
		: { left_transaction_id: rightId, right_transaction_id: leftId };

export const POTENTIAL_TRANSFER_DAY_RANGE = 3;

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const transferEpochDay = (createdAt: string) => {
	const [year, month, day] = createdAt.slice(0, 10).split('-').map(Number);
	return Math.floor(Date.UTC(year, month - 1, day) / MS_IN_DAY);
};

export const isWithinPotentialTransferDayRange = (
	leftCreatedAt: string,
	rightCreatedAt: string,
	maxDayDelta: number = POTENTIAL_TRANSFER_DAY_RANGE
) => Math.abs(transferEpochDay(leftCreatedAt) - transferEpochDay(rightCreatedAt)) <= maxDayDelta;

const isEligibleTransferCandidate = (tx: PotentialTransferLike) =>
	Boolean(tx.id) && !getTransferSiblingId(tx as unknown as Record<string, unknown>);

export const detectPotentialTransferMatches = (
	transactions: PotentialTransferLike[],
	dismissedPairKeys: Set<string> = new Set()
) => {
	const eligible = transactions.filter(isEligibleTransferCandidate);
	const grouped = new Map<string, PotentialTransferLike[]>();
	const dayByTransactionId = new Map<string, number>();

	for (const tx of eligible) {
		const day = transferEpochDay(tx.created_at);
		dayByTransactionId.set(tx.id, day);
		const key = `${day}|${tx.amount}`;
		const existing = grouped.get(key) ?? [];
		existing.push(tx);
		grouped.set(key, existing);
	}

	const matchesByTransaction = new Map<string, PotentialTransferMatch[]>();

	for (const tx of eligible) {
		const txDay = dayByTransactionId.get(tx.id);
		if (txDay == null) continue;
		const candidates: PotentialTransferLike[] = [];
		for (let dayOffset = -POTENTIAL_TRANSFER_DAY_RANGE; dayOffset <= POTENTIAL_TRANSFER_DAY_RANGE; dayOffset += 1) {
			const oppositeKey = `${txDay + dayOffset}|${tx.amount * -1}`;
			const byDay = grouped.get(oppositeKey);
			if (byDay?.length) candidates.push(...byDay);
		}
		const matches = candidates
			.filter((candidate) => candidate.id !== tx.id)
			.filter((candidate) => !dismissedPairKeys.has(transferPairKey(tx.id, candidate.id)))
			.sort(byId)
			.map((candidate) => ({
				id: candidate.id,
				created_at: candidate.created_at,
				amount: candidate.amount,
				bucket_id: candidate.bucket_id,
				description: candidate.description
			}));

		if (matches.length) {
			matchesByTransaction.set(tx.id, matches);
		}
	}

	return matchesByTransaction;
};
