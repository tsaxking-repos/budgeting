import type { Client } from '$lib/services/supabase/supastruct.svelte';
import { SupaStruct } from '$lib/services/supabase/supastruct.svelte';

export const getFinanceStructs = (client: Client) => {
	const bucket = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'bucket'
	});
	const transaction = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'transaction'
	});
	const category = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'category'
	});
	const tags = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'tags'
	});
	const transactionTag = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'transaction_tag'
	});
	const transactionTransferDismissal = SupaStruct.get({
		client,
		schema: 'budgeting',
		table: 'transaction_transfer_dismissal'
	});

	return {
		bucket,
		transaction,
		category,
		tags,
		transactionTag,
		transactionTransferDismissal
	};
};

export type FinanceStructs = ReturnType<typeof getFinanceStructs>;
