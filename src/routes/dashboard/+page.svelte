<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/bootstrap/Card.svelte';
	import Grid from '$lib/components/general/Grid.svelte';
	import TransactionsTable from '$lib/components/finance/TransactionsTable.svelte';
	import {
		aggregateByCategory,
		aggregateByTag,
		aggregateSeries,
		calculateBackwardBalanceSeries,
		centsToCurrency,
		getDateWindow,
		localDateLabel,
		type DateRangeKey
	} from '$lib/services/finance/utils';
	import { getTransferSiblingId, isTransferTransaction } from '$lib/services/finance/transfer';
	import { Chart } from 'chart.js/auto';
	import type { ColDef } from 'ag-grid-community';
	import { SvelteMap } from 'svelte/reactivity';

	const { data } = $props();

	const bucketQuery = $derived(data.finance.queries.buckets);
	const transactionQuery = $derived(data.finance.queries.transactions);
	const categoryQuery = $derived(data.finance.queries.categories);
	const tagQuery = $derived(data.finance.queries.tags);
	const transactionTagQuery = $derived(data.finance.queries.transactionTags);
	const transactionStruct = $derived(data.finance.structs.transaction);
	const transactionTagStruct = $derived(data.finance.structs.transactionTag);

	const buckets = $derived(bucketQuery.reactive);
	const transactions = $derived(transactionQuery.reactive);
	const categories = $derived(categoryQuery.reactive);
	const tags = $derived(tagQuery.reactive);
	const transactionTags = $derived(transactionTagQuery.reactive);

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let range = $state<DateRangeKey>('this-month');
	let customStart = $state(
		new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
	);
	let customEnd = $state(new Date().toISOString().slice(0, 10));

	const dateWindow = $derived(
		getDateWindow(range, {
			start: customStart,
			end: customEnd
		})
	);

	const filteredTransactions = $derived(
		transactions.filter((tx) => {
			const at = new Date(tx.raw.created_at);
			return at >= dateWindow.start && at <= dateWindow.end;
		})
	);
	const financialTransactions = $derived(
		filteredTransactions.filter(
			(tx) => !isTransferTransaction(tx.raw as unknown as Record<string, unknown>)
		)
	);

	const totalIncome = $derived(
		financialTransactions.reduce((sum, tx) => sum + (tx.raw.amount > 0 ? tx.raw.amount : 0), 0)
	);
	const totalExpenses = $derived(
		financialTransactions.reduce(
			(sum, tx) => sum + (tx.raw.amount < 0 ? Math.abs(tx.raw.amount) : 0),
			0
		)
	);
	const netCashFlow = $derived(totalIncome - totalExpenses);
	const totalBalance = $derived(buckets.reduce((sum, account) => sum + account.raw.balance, 0));

	const tagMapByTransaction = $derived.by(() => {
		const map = new SvelteMap<string, string[]>();
		for (const link of transactionTags) {
			const txId = link.raw.transaction_id;
			const tagId = link.raw.tag_id;
			if (!txId || !tagId) continue;
			const existing = map.get(txId) ?? [];
			existing.push(tagId);
			map.set(txId, existing);
		}
		return map;
	});

	const categoryBreakdown = $derived(
		aggregateByCategory(filteredTransactions, (categoryId) => {
			if (!categoryId) return 'Unassigned';
			return categories.find((category) => category.id === categoryId)?.raw.name ?? 'Unknown category';
		})
	);

	const tagBreakdown = $derived(
		aggregateByTag(filteredTransactions, (transactionId) => {
			const tagIds = tagMapByTransaction.get(transactionId) ?? [];
			return tagIds
				.map((tagId) => tags.find((tag) => tag.id === tagId)?.raw.name ?? '')
				.filter(Boolean);
		})
	);

	type DashboardTransactionRow = {
		id: string;
		createdAt: string;
		date: string;
		description: string | null;
		amount: number;
		accountName: string;
		category: string;
		tagNames: string;
		transferStatus: string;
		transferDetails: string;
		isTransfer: boolean;
		isUsedInCashFlow: boolean;
		usageLabel: string;
	};

	const dashboardTransactionRows = $derived.by(() =>
		filteredTransactions.map((tx) => {
			const txId = tx.id ?? tx.raw.id;
			const isTransfer = isTransferTransaction(tx.raw as unknown as Record<string, unknown>);
			const categoryId = tx.raw.category;
			const categoryMatch = categoryId
				? categories.find((category) => category.id === categoryId)
				: null;
			const categoryName = categoryMatch?.raw.name ?? 'Unknown category';
			const category = categoryId
				? `${categoryName}${categoryMatch?.raw.kind ? ` (${categoryMatch.raw.kind})` : ''}`
				: 'Unassigned';
			const tagIds = tagMapByTransaction.get(txId) ?? [];
			const tagNames = tagIds
				.map((tagId) => tags.find((tag) => tag.id === tagId)?.raw.name ?? '')
				.filter(Boolean);
			const transferSiblingId = getTransferSiblingId(tx.raw as unknown as Record<string, unknown>);
			const transferSibling = transferSiblingId
				? transactions.find((candidate) => candidate.id === transferSiblingId)
				: null;
			const siblingAccount = transferSibling
				? (buckets.find((bucket) => bucket.id === transferSibling.raw.bucket_id)?.raw.name ?? 'Unknown')
				: null;
			const transferDetails = transferSibling
				? `${siblingAccount} • ${centsToCurrency(transferSibling.raw.amount)} • ${localDateLabel(transferSibling.raw.created_at)} • ${transferSibling.raw.description ?? '—'}`
				: transferSiblingId
					? 'Linked transfer transaction not found'
					: '—';

			return {
				id: txId,
				createdAt: tx.raw.created_at,
				date: localDateLabel(tx.raw.created_at),
				description: tx.raw.description,
				amount: tx.raw.amount,
				accountName: buckets.find((bucket) => bucket.id === tx.raw.bucket_id)?.raw.name ?? 'Unknown',
				category,
				tagNames: tagNames.join(', ') || '—',
				transferStatus: isTransfer ? 'Confirmed transfer' : 'Standard',
				transferDetails,
				isTransfer,
				isUsedInCashFlow: !isTransfer,
				usageLabel: isTransfer ? 'No (transfer)' : 'Yes'
			};
		})
	);

	const dashboardTransactionColDefs = $derived<ColDef<DashboardTransactionRow>[]>([
		{
			field: 'date',
			headerName: 'Date',
			sort: 'desc'
		},
		{
			field: 'description',
			headerName: 'Description',
			valueFormatter: (params) => String(params.value ?? '—')
		},
		{
			field: 'accountName',
			headerName: 'Account'
		},
		{
			field: 'category',
			headerName: 'Category'
		},
		{
			field: 'tagNames',
			headerName: 'Tags'
		},
		{
			field: 'amount',
			headerName: 'Amount',
			cellClass: (params) => (Number(params.value ?? 0) >= 0 ? 'text-success text-end' : 'text-danger text-end'),
			valueFormatter: (params) => centsToCurrency(Number(params.value ?? 0))
		},
		{
			field: 'transferStatus',
			headerName: 'Transfer Status'
		},
		{
			field: 'transferDetails',
			headerName: 'Transfer Match'
		},
		{
			field: 'usageLabel',
			headerName: 'Used in cash-flow totals'
		}
	]);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let chart: Chart | null = null;
	let categoryCanvas = $state<HTMLCanvasElement | null>(null);
	let categoryChart: Chart | null = null;
	let tagCanvas = $state<HTMLCanvasElement | null>(null);
	let tagChart: Chart | null = null;
	const chartSeries = $derived(aggregateSeries(filteredTransactions, dateWindow));
	const showCalculatedBalance = $derived(range !== 'custom');
	const primaryChartSeries = $derived(
		showCalculatedBalance
			? calculateBackwardBalanceSeries(chartSeries.net_cents, totalBalance)
			: chartSeries.net
	);

	$effect(() => {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: chartSeries.labels,
				datasets: [
					{
						label: 'Income',
						data: chartSeries.income,
						borderColor: '#198754',
						backgroundColor: 'rgba(25, 135, 84, 0.2)',
						tension: 0.25
					},
					{
						label: 'Expenses',
						data: chartSeries.expenses,
						borderColor: '#dc3545',
						backgroundColor: 'rgba(220, 53, 69, 0.2)',
						tension: 0.25
					},
					{
						label: showCalculatedBalance ? 'Calculated Balance' : 'Net Cash Flow',
						data: primaryChartSeries,
						borderColor: '#0d6efd',
						backgroundColor: 'rgba(13, 110, 253, 0.2)',
						tension: 0.25
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false
			}
		});
	});

	$effect(() => {
		if (!categoryCanvas) return;
		categoryChart?.destroy();
		categoryChart = new Chart(categoryCanvas, {
			type: 'bar',
			data: {
				labels: categoryBreakdown.map((item) => item.label),
				datasets: [
					{
						label: 'Income',
						data: categoryBreakdown.map((item) => item.income),
						backgroundColor: 'rgba(25, 135, 84, 0.5)',
						borderColor: '#198754',
						borderWidth: 1
					},
					{
						label: 'Expenses',
						data: categoryBreakdown.map((item) => item.expenses),
						backgroundColor: 'rgba(220, 53, 69, 0.5)',
						borderColor: '#dc3545',
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false
			}
		});
	});

	$effect(() => {
		if (!tagCanvas) return;
		tagChart?.destroy();
		tagChart = new Chart(tagCanvas, {
			type: 'bar',
			data: {
				labels: tagBreakdown.map((item) => item.label),
				datasets: [
					{
						label: 'Income',
						data: tagBreakdown.map((item) => item.income),
						backgroundColor: 'rgba(25, 135, 84, 0.5)',
						borderColor: '#198754',
						borderWidth: 1
					},
					{
						label: 'Expenses',
						data: tagBreakdown.map((item) => item.expenses),
						backgroundColor: 'rgba(220, 53, 69, 0.5)',
						borderColor: '#dc3545',
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false
			}
		});
	});

	onMount(() => {
		loading = true;
		const unsubs = [
			bucketQuery.subscribe(() => {}),
			transactionQuery.subscribe(() => {}),
			categoryQuery.subscribe(() => {}),
			tagQuery.subscribe(() => {}),
			transactionTagQuery.subscribe(() => {})
		];
		Promise.all([
			bucketQuery.sync(0),
			transactionQuery.sync(0),
			categoryQuery.sync(0),
			tagQuery.sync(0),
			transactionTagQuery.sync(0)
		])
			.then(() => {
				loadError = null;
			})
			.catch((error) => {
				loadError = error instanceof Error ? error.message : String(error);
			})
			.finally(() => {
				loading = false;
			});

		return () => {
			for (const unsub of unsubs) unsub();
			chart?.destroy();
			categoryChart?.destroy();
			tagChart?.destroy();
		};
	});
</script>

<div class="container-fluid py-3">
	<div class="row g-3 align-items-end">
		<div class="col-12 col-md-4">
			<label class="form-label" for="range">Date range</label>
			<select id="range" class="form-select" bind:value={range}>
				<option value="this-month">This month</option>
				<option value="last-month">Last month</option>
				<option value="last-3-months">Last 3 months</option>
				<option value="ytd">Year to date</option>
				<option value="custom">Custom range</option>
			</select>
		</div>
		{#if range === 'custom'}
			<div class="col-12 col-md-4">
				<label class="form-label" for="start">Start date</label>
				<input id="start" class="form-control" type="date" bind:value={customStart} />
			</div>
			<div class="col-12 col-md-4">
				<label class="form-label" for="end">End date</label>
				<input id="end" class="form-control" type="date" bind:value={customEnd} />
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="alert alert-secondary mt-3 mb-0">Loading dashboard data...</div>
	{:else if loadError}
		<div class="alert alert-danger mt-3 mb-0">Failed to load dashboard data: {loadError}</div>
	{:else if !transactions.length}
		<div class="alert alert-warning mt-3 mb-0">
			No transactions found yet. Add transactions to populate reports.
		</div>
	{:else}
		<div class="row g-3 mt-1">
			<div class="col-12 col-md-6 col-xl-3">
				<Card title="Total Balance">
					{#snippet body()}
						<div class="h4 mb-0">{centsToCurrency(totalBalance)}</div>
					{/snippet}
				</Card>
			</div>
			<div class="col-12 col-md-6 col-xl-3">
				<Card title="Income">
					{#snippet body()}
						<div class="h4 mb-0 text-success">{centsToCurrency(totalIncome)}</div>
					{/snippet}
				</Card>
			</div>
			<div class="col-12 col-md-6 col-xl-3">
				<Card title="Expenses">
					{#snippet body()}
						<div class="h4 mb-0 text-danger">{centsToCurrency(totalExpenses)}</div>
					{/snippet}
				</Card>
			</div>
			<div class="col-12 col-md-6 col-xl-3">
				<Card title="Net Cash Flow">
					{#snippet body()}
						<div
							class={[
								'h4 mb-0',
								{ 'text-success': netCashFlow >= 0, 'text-danger': netCashFlow < 0 }
							]}
						>
							{centsToCurrency(netCashFlow)}
						</div>
					{/snippet}
				</Card>
			</div>
		</div>

		<div class="card mt-3">
			<div class="card-header">
				<h5 class="mb-0">Cash Flow Trend</h5>
			</div>
			<div class="card-body">
				<div style="height: 360px;">
					<canvas bind:this={canvas}></canvas>
				</div>
			</div>
		</div>

		<div class="row g-3 mt-1">
			<div class="col-12 col-xl-6">
				<div class="card h-100">
					<div class="card-header">
						<h5 class="mb-0">By Category (Income vs Expenses)</h5>
					</div>
					<div class="card-body">
						{#if !categoryBreakdown.length}
							<div class="alert alert-secondary mb-0">No category activity in this range.</div>
						{:else}
							<div style="height: 340px;">
								<canvas bind:this={categoryCanvas}></canvas>
							</div>
						{/if}
					</div>
				</div>
			</div>
			<div class="col-12 col-xl-6">
				<div class="card h-100">
					<div class="card-header">
						<h5 class="mb-0">By Tag (Income vs Expenses)</h5>
					</div>
					<div class="card-body">
						{#if !tagBreakdown.length}
							<div class="alert alert-secondary mb-0">No tag activity in this range.</div>
						{:else}
							<div style="height: 340px;">
								<canvas bind:this={tagCanvas}></canvas>
							</div>
						{/if}
						<div class="form-text mt-2">
							If a transaction has multiple tags, it contributes to each of those tag totals.
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="card mt-3">
			<div class="card-header d-flex justify-content-between align-items-center">
				<h5 class="mb-0">Transactions in selected range</h5>
				<div class="small text-muted">{filteredTransactions.length} transaction(s)</div>
			</div>
			<div class="card-body">
				<TransactionsTable
					transactions={filteredTransactions}
					{buckets}
					{categories}
					{tags}
					{transactionTags}
					{transactionStruct}
					{transactionTagStruct}
					editable={true}
					height={800}
					emptyMessage="No transactions in this date range."
				/>
			</div>
		</div>
	{/if}
</div>
