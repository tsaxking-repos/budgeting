import { getFinanceStructs } from '$lib/services/finance/structs';

export const load = async (event) => {
	const parent = await event.parent();
	const structs = getFinanceStructs(parent.supabase);

	const buckets = structs.bucket.all().sort((a, b) => a.raw.name.localeCompare(b.raw.name));
	const transactions = structs.transaction
		.all()
		.sort((a, b) => new Date(b.raw.created_at).getTime() - new Date(a.raw.created_at).getTime());
	const categories = structs.category.all().sort((a, b) => a.raw.name.localeCompare(b.raw.name));
	const tags = structs.tags.all().sort((a, b) => a.raw.name.localeCompare(b.raw.name));
	const transactionTags = structs.transactionTag.all();
	const transactionTransferDismissals = structs.transactionTransferDismissal.all();

	buckets.sync(1000 * 60);
	transactions.sync(1000 * 60);
	categories.sync(1000 * 60);
	tags.sync(1000 * 60);
	transactionTags.sync(1000 * 60);
	transactionTransferDismissals.sync(1000 * 60);

	buckets.subscribe();
	transactions.subscribe();
	categories.subscribe();
	tags.subscribe();
	transactionTags.subscribe();
	transactionTransferDismissals.subscribe();

	return {
		finance: {
			structs,
			queries: {
				buckets,
				transactions,
				categories,
				tags,
				transactionTags,
				transactionTransferDismissals
			}
		}
	};
};
