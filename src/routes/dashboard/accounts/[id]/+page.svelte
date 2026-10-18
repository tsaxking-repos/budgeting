<script lang="ts">
	import { page } from '$app/state';
	import Card from '$lib/components/bootstrap/Card.svelte';
	import TransactionsTable from '$lib/components/finance/TransactionsTable.svelte';
	import { centsToCurrency } from '$lib/services/finance/utils';

	const { data } = $props();

	const accountId = $derived(page.params.id);
	const buckets = $derived(data.finance.queries.buckets.reactive);
	const transactions = $derived(data.finance.queries.transactions.reactive);
	const categories = $derived(data.finance.queries.categories.reactive);
	const tags = $derived(data.finance.queries.tags.reactive);
	const transactionTags = $derived(data.finance.queries.transactionTags.reactive);
	const transactionStruct = $derived(data.finance.structs.transaction);
	const transactionTagStruct = $derived(data.finance.structs.transactionTag);

	const account = $derived(buckets.find((bucket) => bucket.id === accountId) ?? null);
	const accountTransactions = $derived(transactions.filter((tx) => tx.raw.bucket_id === accountId));

</script>

<div class="container-fluid py-3">
	{#if !account}
		<div class="alert alert-warning">Account not found or archived.</div>
	{:else}
		<div class="row g-3 mb-3">
			<div class="col-12 col-md-6">
				<Card title="Account">
					{#snippet body()}
						<div class="h5 mb-1">{account.raw.name}</div>
						<div class="text-muted">Balance</div>
						<div class="h4 mb-0">{centsToCurrency(account.raw.balance)}</div>
					{/snippet}
				</Card>
			</div>
			<div class="col-12 col-md-6">
				<Card title="Transaction count">
					{#snippet body()}
						<div class="display-6 mb-0">{accountTransactions.length}</div>
					{/snippet}
				</Card>
			</div>
		</div>

		<Card title="Account transactions">
			{#snippet body()}
				<TransactionsTable
					transactions={accountTransactions}
					{buckets}
					{categories}
					{tags}
					{transactionTags}
					{transactionStruct}
					{transactionTagStruct}
					editable={true}
					height={460}
					emptyMessage="No transactions for this account."
				/>
			{/snippet}
		</Card>
	{/if}
</div>
