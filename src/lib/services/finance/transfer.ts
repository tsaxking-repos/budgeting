export type TransactionTransferLike = {
	id: string;
	amount: number;
	bucket_id: string;
	created_at: string;
	description: string | null;
	transfer_sibiling?: string | null;
	transfer_sibling?: string | null;
};

export const getTransferSiblingId = (tx: Record<string, unknown>): string | null => {
	const value = tx.transfer_sibiling ?? tx.transfer_sibling;
	return typeof value === 'string' && value.length ? value : null;
};

export const isTransferTransaction = (tx: Record<string, unknown>) =>
	Boolean(getTransferSiblingId(tx));

export const createTransferSiblingPayload = (
	tx: Pick<TransactionTransferLike, 'amount' | 'created_at' | 'description'> & { id?: string },
	siblingBucketId: string
) => ({
	description: tx.description?.trim() ? tx.description.trim() : null,
	amount: tx.amount * -1,
	bucket_id: siblingBucketId,
	created_at: tx.created_at
});

export const buildLinkedTransferUpdate = (txId: string, siblingId: string) => ({
	id: txId,
	transfer_sibling: siblingId
});

export const buildClearedTransferUpdate = (txId: string) => ({
	id: txId,
	transfer_sibling: null
});
