<script lang="ts">
	import Grid from '$lib/components/general/Grid.svelte';
	import { parseAmountToMinorUnit } from '$lib/services/finance/csv-import';
	import {
		buildClearedTransferUpdate,
		getTransferSiblingId,
		isTransferTransaction
	} from '$lib/services/finance/transfer';
	import { centsToCurrency, localDateLabel } from '$lib/services/finance/utils';
	import type { SupaStruct, SupaStructData } from '$lib/services/supabase/supastruct.svelte';
	import { Form } from '$lib/utils/form.svelte.js';
	import { contextmenu } from '$lib/utils/contextmenu';
	import { confirm, notify, select } from '$lib/utils/prompts.svelte';
	import type { CellClickedEvent, CellContextMenuEvent, ColDef, SelectionChangedEvent } from 'ag-grid-community';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type TxRow = SupaStructData<'budgeting', 'transaction'>;
	type BucketRow = SupaStructData<'budgeting', 'bucket'>;
	type CategoryRow = SupaStructData<'budgeting', 'category'>;
	type TagRow = SupaStructData<'budgeting', 'tags'>;
	type TransactionTagRow = SupaStructData<'budgeting', 'transaction_tag'>;
	type TransactionTagStruct = SupaStruct<'budgeting', 'transaction_tag'>;
	type TransactionStruct = SupaStruct<'budgeting', 'transaction'>;

	type PotentialTransferMatch = {
		id: string;
		created_at: string;
		amount: number;
		bucket_id: string;
		description: string | null;
	};

	type TableRow = {
		id: string;
		date: string;
		createdAt: string;
		description: string | null;
		amount: number;
		accountName: string;
		category: string;
		tags: string;
		transferStatus: string;
		transferDetails: string;
		usageLabel: string;
		potentialTransferStatus: string;
	};

	interface Props {
		transactions: TxRow[];
		buckets: BucketRow[];
		categories: CategoryRow[];
		tags: TagRow[];
		transactionTags: TransactionTagRow[];
		transactionTagStruct?: TransactionTagStruct;
		transactionStruct?: TransactionStruct;
		editable?: boolean;
		height?: number;
		emptyMessage?: string;
		potentialTransfersByTransaction?: Map<string, PotentialTransferMatch[]>;
		onPotentialTransferReview?: (transactionId: string) => Promise<void> | void;
	}

	const {
		transactions,
		buckets,
		categories,
		tags,
		transactionTags,
		transactionTagStruct,
		transactionStruct,
		editable = false,
		height = 560,
		emptyMessage = 'No transactions to display.',
		potentialTransfersByTransaction,
		onPotentialTransferReview
	}: Props = $props();

	let gridRef: InstanceType<typeof Grid<TableRow>> | null = $state(null);
	const selectedRows = () => gridRef?.getSelection() ?? [];

	const bucketName = (id: string) =>
		buckets.find((bucket) => bucket.id === id)?.raw.name ?? 'Unknown account';

	const tagsByTransaction = $derived.by(() => {
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

	const rowsById = $derived.by(() => {
		const map = new SvelteMap<string, TableRow>();
		for (const row of tableRows) map.set(row.id, row);
		return map;
	});

	const transactionsById = $derived.by(
		() => new SvelteMap(transactions.map((tx) => [tx.id ?? tx.raw.id, tx] as const))
	);

	const tableRows = $derived.by<TableRow[]>(() =>
		transactions.map((tx) => {
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
			const tagIds = tagsByTransaction.get(txId) ?? [];
			const tagNames = tagIds
				.map((tagId) => tags.find((tag) => tag.id === tagId)?.raw.name ?? '')
				.filter(Boolean);
			const transferSiblingId = getTransferSiblingId(tx.raw as unknown as Record<string, unknown>);
			const transferSibling = transferSiblingId ? transactionsById.get(transferSiblingId) : null;
			const siblingAccount = transferSibling ? bucketName(transferSibling.raw.bucket_id) : null;
			const transferDetails = transferSibling
				? `${siblingAccount} • ${centsToCurrency(transferSibling.raw.amount)} • ${localDateLabel(transferSibling.raw.created_at)} • ${transferSibling.raw.description ?? '—'}`
				: transferSiblingId
					? 'Linked transfer transaction not found'
					: '—';
			const potentialMatches = potentialTransfersByTransaction?.get(txId) ?? [];

			return {
				id: txId,
				date: localDateLabel(tx.raw.created_at),
				createdAt: tx.raw.created_at,
				description: tx.raw.description,
				amount: tx.raw.amount,
				accountName: bucketName(tx.raw.bucket_id),
				category,
				tags: tagNames.join(', ') || '—',
				transferStatus: isTransfer ? 'Confirmed transfer' : 'Standard',
				transferDetails,
				usageLabel: isTransfer ? 'No (transfer)' : 'Yes',
				potentialTransferStatus: potentialMatches.length
					? potentialMatches.length > 1
						? `May be a transfer (${potentialMatches.length} matches)`
						: 'Potential transfer'
					: ''
			};
		})
	);

	const colDefs = $derived<ColDef<TableRow>[]>([
		{
			field: 'date',
			headerName: 'Date',
			sort: 'desc'
		},
		{
			field: 'createdAt',
			headerName: 'Created at (ISO)'
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
			field: 'tags',
			headerName: 'Tags'
		},
		{
			field: 'amount',
			headerName: 'Amount',
			cellClass: (params) =>
				Number(params.value ?? 0) >= 0 ? 'text-success text-end' : 'text-danger text-end',
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
			field: 'potentialTransferStatus',
			headerName: 'Potential transfer',
			cellClass: (params) => {
				const value = String(params.value ?? '');
				if (!value.length) return '';
				return value.includes('matches')
					? 'tx-potential-transfer tx-potential-transfer-ambiguous'
					: 'tx-potential-transfer';
			}
		},
		{
			field: 'usageLabel',
			headerName: 'Used in cash-flow totals'
		}
	]);

	const syncTransactionTags = async (transactionId: string, nextTagIds: string[]) => {
		if (!transactionTagStruct) {
			throw new Error('Tag assignment is unavailable because transactionTagStruct was not provided.');
		}
		const existing = transactionTags.filter((link) => link.raw.transaction_id === transactionId);
		const selected = [...new Set(nextTagIds)];
		const current = existing.map((link) => String(link.raw.tag_id));

		for (const link of existing) {
			if (link.raw.tag_id && !selected.includes(link.raw.tag_id)) {
				const remove = await link.delete();
				if (remove.isErr()) throw remove.error;
			}
		}

		const toAdd = selected.filter((tagId) => !current.includes(tagId));
		if (!toAdd.length) return;
		const insert = await transactionTagStruct.new(
			...toAdd.map((tagId) => ({
				archived: false,
				transaction_id: transactionId,
				tag_id: tagId
			}))
		);
		if (insert.isErr()) throw insert.error;
	};

	const availableTags = $derived.by(() =>
		tags.filter((tag): tag is TagRow & { id: string } => Boolean(tag.id))
	);

	const promptTagIds = async (
		initialTagIds: string[],
		title: string
	): Promise<string[] | null> => {
		const form = new Form().input('tags', {
			type: 'checkbox',
			label: 'Tags',
			required: false,
			options: availableTags.map((tag) => ({
				value: tag.id,
				label: tag.raw.name
			})),
			value: initialTagIds
		});

		const result = await form.prompt({ title, send: false });
		if (result.isErr()) return null;
		return Array.isArray(result.value.value.tags)
			? result.value.value.tags
			: result.value.value.tags
				? [result.value.value.tags]
				: [];
	};

	const resolveActionTargets = (clicked: TableRow) => {
		const selection = selectedRows();
		if (!selection.length) return [clicked];
		return selection.some((row) => row.id === clicked.id) ? selection : [clicked];
	};

	const openTransactionForm = async (mode: 'create' | 'edit', row?: TableRow) => {
		const source = row ? transactionsById.get(row.id) : null;
		if (mode === 'edit' && !source) return;
		const existingTagIds = source ? tagsByTransaction.get(source.id ?? source.raw.id) ?? [] : [];

		const form = new Form()
			.input('description', {
				type: 'text',
				label: 'Description',
				required: false,
				value: source?.raw.description ?? ''
			})
			.input('amount', {
				type: 'text',
				label: 'Amount (major units, e.g. -45.67)',
				required: true,
				value: source ? String(source.raw.amount / 100) : '',
				validation: [{ type: 'required', message: 'Amount is required' }]
			})
			.input('date', {
				type: 'date',
				label: 'Date',
				required: true,
				value: source?.raw.created_at.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
				validation: [{ type: 'required', message: 'Date is required' }]
			})
			.input('account', {
				type: 'select',
				label: 'Account',
				required: true,
				options: buckets
					.filter((bucket): bucket is BucketRow & { id: string } => Boolean(bucket.id))
					.map((bucket) => ({ value: bucket.id, label: bucket.raw.name })),
				value: source?.raw.bucket_id ?? buckets[0]?.id ?? ''
			})
			.input('category', {
				type: 'select',
				label: 'Category',
				required: false,
				options: [
					{ value: '', label: 'Unassigned' },
					...categories
						.filter((category): category is CategoryRow & { id: string } => Boolean(category.id))
						.map((category) => ({ value: category.id, label: category.raw.name }))
				],
				value: source?.raw.category ?? ''
			})
			.input('tags', {
				type: 'checkbox',
				label: 'Tags',
				required: false,
				options: availableTags.map((tag) => ({
					value: tag.id,
					label: tag.raw.name
				})),
				value: existingTagIds
			});

		const formResult = await form.prompt({
			title: mode === 'create' ? 'Create transaction' : 'Edit transaction',
			send: false
		});
		if (formResult.isErr()) return;

		const values = formResult.value.value;
		const selectedTagIds = Array.isArray(values.tags)
			? values.tags
			: values.tags
				? [values.tags]
				: [];
		const parsedAmount = parseAmountToMinorUnit(String(values.amount || ''), {
			unit: 'major',
			signStrategy: 'signed'
		});
		if (!parsedAmount.ok) throw new Error(parsedAmount.error);
		if (!values.account) throw new Error('Account is required');
		if (!values.date) throw new Error('Date is required');
		const payload = {
			description: values.description.trim() ? values.description.trim() : null,
			amount: parsedAmount.cents,
			created_at: new Date(`${values.date}T12:00:00Z`).toISOString(),
			bucket_id: values.account,
			category: values.category || null
		};

		if (mode === 'create') {
			if (!transactionStruct) {
				throw new Error('Creating transactions is unavailable because transactionStruct was not provided.');
			}
			const created = await transactionStruct.new(payload);
			if (created.isErr()) throw created.error;
			const createdId = created.value[0]?.id ?? created.value[0]?.raw.id;
			if (!createdId || typeof createdId !== 'string') {
				throw new Error('Created transaction has no id');
			}
			if (selectedTagIds.length) await syncTransactionTags(createdId, selectedTagIds);
			return;
		}

		if (!source) return;
		const updated = await source.update(payload);
		if (updated.isErr()) throw updated.error;
		await syncTransactionTags(source.id ?? source.raw.id, selectedTagIds);
	};

	const assignCategory = async (targets: TableRow[]) => {
		const selected = await select(
			`Assign category to ${targets.length} transaction(s)`,
			[
				{ id: '', label: 'Unassigned' },
				...categories
					.filter((category): category is CategoryRow & { id: string } => Boolean(category.id))
					.map((category) => ({ id: category.id, label: category.raw.name }))
			],
			{
				title: 'Assign category',
				render: (option) => option.label
			}
		);
		if (!selected) return;

		for (const row of targets) {
			const tx = transactionsById.get(row.id);
			if (!tx) continue;
			const result = await tx.update({ category: selected.id || null });
			if (result.isErr()) throw result.error;
		}
	};

	const setTags = async (targets: TableRow[]) => {
		const first = targets[0];
		const initialTagIds = first
			? tagsByTransaction.get(first.id) ?? []
			: [];
		const tagIds = await promptTagIds(initialTagIds, `Set tags (${targets.length} transactions)`);
		if (tagIds === null) return;
		for (const row of targets) {
			await syncTransactionTags(row.id, tagIds);
		}
	};

	const transferPairKeyForRows = (leftId: string, rightId: string) =>
		leftId < rightId ? `${leftId}::${rightId}` : `${rightId}::${leftId}`;

	const getTransferPairCount = (targets: TableRow[]) => {
		const pairs = new SvelteSet<string>();
		for (const row of targets) {
			const tx = transactionsById.get(row.id);
			if (!tx) continue;
			const siblingId = getTransferSiblingId(tx.raw as unknown as Record<string, unknown>);
			if (!siblingId) continue;
			pairs.add(transferPairKeyForRows(row.id, siblingId));
		}
		return pairs.size;
	};

	const removeTransferLinks = async (targets: TableRow[]) => {
		const pairCount = getTransferPairCount(targets);
		if (!pairCount) {
			throw new Error('No confirmed transfer links found for the selected transaction(s).');
		}
		const confirmed = await confirm(
			`Remove ${pairCount} confirmed transfer link${pairCount === 1 ? '' : 's'}?`
		);
		if (!confirmed) return;

		const processed = new SvelteSet<string>();
		for (const row of targets) {
			const tx = transactionsById.get(row.id);
			if (!tx) continue;
			const siblingId = getTransferSiblingId(tx.raw as unknown as Record<string, unknown>);
			if (!siblingId) continue;
			const pairKey = transferPairKeyForRows(row.id, siblingId);
			if (processed.has(pairKey)) continue;
			processed.add(pairKey);

			const txUpdate = await tx.update(buildClearedTransferUpdate(row.id));
			if (txUpdate.isErr()) throw txUpdate.error;

			const sibling = transactionsById.get(siblingId);
			if (!sibling) continue;
			const siblingUpdate = await sibling.update(buildClearedTransferUpdate(siblingId));
			if (siblingUpdate.isErr()) throw siblingUpdate.error;
		}
	};

	const archive = async (targets: TableRow[]) => {
		const ok = await confirm(`Archive ${targets.length} transaction(s)?`);
		if (!ok) return;
		for (const row of targets) {
			const tx = transactionsById.get(row.id);
			if (!tx) continue;
			const result = await tx.set_archive(true);
			if (result.isErr()) throw result.error;
		}
	};

	const runAction = async (action: () => Promise<void>, success: string) => {
		try {
			await action();
			notify({
				title: 'Updated',
				message: success,
				color: 'success',
				autoHide: 2500
			});
		} catch (error) {
			notify({
				title: 'Action failed',
				message: error instanceof Error ? error.message : String(error),
				color: 'danger',
				autoHide: 5000
			});
		}
	};

	const showContextMenu = (event: CellContextMenuEvent<TableRow>) => {
		const clickedRow = event.data;
		if (!clickedRow) return;
		const targets = resolveActionTargets(clickedRow);
		const canEdit = editable;
		const isSingle = targets.length === 1;
		const potentialMatches = potentialTransfersByTransaction?.get(clickedRow.id) ?? [];
		const transferPairCount = getTransferPairCount(targets);

		contextmenu(event.event as MouseEvent, {
			options: [
				'Transaction actions',
				{
					name: 'Create transaction',
					action: () => void runAction(() => openTransactionForm('create'), 'Transaction created'),
					icon: { type: 'bootstrap', name: 'plus-circle' },
					disabled: !canEdit || !transactionStruct
				},
				{
					name: isSingle ? 'Edit transaction' : 'Edit transaction (single row only)',
					action: () =>
						void runAction(
							() => openTransactionForm('edit', clickedRow),
							'Transaction updated'
						),
					icon: { type: 'bootstrap', name: 'pencil' },
					disabled: !canEdit || !isSingle
				},
				{
					name: `Assign category (${targets.length})`,
					action: () =>
						void runAction(
							() => assignCategory(targets),
							`Category assigned for ${targets.length} transaction(s)`
						),
					icon: { type: 'bootstrap', name: 'folder' },
					disabled: !canEdit
				},
				{
					name: `Set tags (${targets.length})`,
					action: () =>
						void runAction(
							() => setTags(targets),
							`Tags updated for ${targets.length} transaction(s)`
						),
					icon: { type: 'bootstrap', name: 'tags' },
					disabled: !canEdit
				},
				{
					name:
						transferPairCount > 0
							? `Remove transfer link${transferPairCount === 1 ? '' : 's'} (${transferPairCount})`
							: 'Remove transfer links',
					action: () =>
						void runAction(
							() => removeTransferLinks(targets),
							`Removed ${transferPairCount} transfer link${transferPairCount === 1 ? '' : 's'}`
						),
					icon: { type: 'bootstrap', name: 'link-45deg' },
					disabled: !canEdit || transferPairCount === 0
				},
				null,
				{
					name: 'Review potential transfer',
					action: () => void onPotentialTransferReview?.(clickedRow.id),
					icon: { type: 'bootstrap', name: 'arrow-left-right' },
					show: Boolean(onPotentialTransferReview),
					disabled: !potentialMatches.length
				},
				{
					name: `Archive transaction${targets.length > 1 ? 's' : ''} (${targets.length})`,
					action: () =>
						void runAction(
							() => archive(targets),
							`Archived ${targets.length} transaction(s)`
						),
					icon: { type: 'bootstrap', name: 'trash' },
					disabled: !canEdit
				}
			]
		});
	};

	const onCellClicked = (event: CellClickedEvent<TableRow>) => {
		if (event.colDef.field !== 'potentialTransferStatus') return;
		const row = event.data;
		if (!row?.potentialTransferStatus.length) return;
		void onPotentialTransferReview?.(row.id);
	};

	const onSelectionChanged = (_event: SelectionChangedEvent<TableRow>) => {
		// selection consumed through gridRef.getSelection()
	};
</script>

{#if !tableRows.length}
	<div class="alert alert-secondary mb-2">{emptyMessage}</div>
{/if}

<Grid
	bind:this={gridRef}
	data={tableRows}
	opts={{
		columnDefs: colDefs,
		defaultColDef: {
			sortable: true,
			filter: true,
			resizable: true
		},
		pagination: true,
		paginationPageSize: 25,
		rowSelection: editable ? 'multiple' : undefined,
		preventDefaultOnContextMenu: true,
		onCellClicked,
		onSelectionChanged,
		onCellContextMenu: showContextMenu
	}}
	height={height}
/>

<style>
	:global(.tx-potential-transfer) {
		color: var(--bs-warning-text-emphasis);
		font-weight: 600;
	}

	:global(.tx-potential-transfer-ambiguous) {
		color: var(--bs-orange);
	}
</style>
