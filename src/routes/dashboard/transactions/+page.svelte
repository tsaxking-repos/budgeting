<script lang="ts">
	import Card from '$lib/components/bootstrap/Card.svelte';
	import TransactionsTable from '$lib/components/finance/TransactionsTable.svelte';
	import Grid from '$lib/components/general/Grid.svelte';
	import {
		detectDelimiter,
		detectHeaderRow,
		parseAmountToMinorUnit,
		parseCsv,
		parseDate,
		parseDebitCreditToMinorUnit,
		splitTags,
		type AmountSignStrategy,
		type AmountUnit,
		type CsvDataRow,
		type CsvDelimiter,
		type DateFormat
	} from '$lib/services/finance/csv-import';
	import {
		detectPotentialTransferMatches,
		isWithinPotentialTransferDayRange,
		normalizeTransferPair,
		transferPairKey,
		type PotentialTransferLike
	} from '$lib/services/finance/potential-transfer';
	import {
		buildLinkedTransferUpdate,
		createTransferSiblingPayload,
		getTransferSiblingId,
		isTransferTransaction
	} from '$lib/services/finance/transfer';
	import { centsToCurrency, localDateLabel } from '$lib/services/finance/utils';
	import { confirm, notify, select } from '$lib/utils/prompts.svelte';
	import type {
		CellClickedEvent,
		CellValueChangedEvent,
		ColDef,
		RowClassParams,
		RowDoubleClickedEvent,
		ValueFormatterParams
	} from 'ag-grid-community';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { v5 as uuidv5 } from 'uuid';
	import { ModuleRegistry } from 'ag-grid-community';
	import { TextFilterModule } from 'ag-grid-community';
	import { NumberFilterModule } from 'ag-grid-community';
	import { DateFilterModule } from 'ag-grid-community';
	import { CustomFilterModule } from 'ag-grid-community';

	ModuleRegistry.registerModules([
		TextFilterModule,
		NumberFilterModule,
		DateFilterModule,
		CustomFilterModule
	]);

	const IMPORT_NAMESPACE = '5f3e403b-c915-4f29-9e68-253f5ec4ed45';

	const { data } = $props();
	const transactionStruct = $derived(data.finance.structs.transaction);
	const transactionTagStruct = $derived(data.finance.structs.transactionTag);
	const transactionTransferDismissalStruct = $derived(
		data.finance.structs.transactionTransferDismissal
	);
	const tagStruct = $derived(data.finance.structs.tags);

	const transactionQuery = $derived(data.finance.queries.transactions);
	const tagQuery = $derived(data.finance.queries.tags);
	const bucketQuery = $derived(data.finance.queries.buckets);
	const categoryQuery = $derived(data.finance.queries.categories);
	const transactionTagQuery = $derived(data.finance.queries.transactionTags);
	const transactionTransferDismissalQuery = $derived(
		data.finance.queries.transactionTransferDismissals
	);

	const transactions = $derived(transactionQuery.reactive);
	const tags = $derived(tagQuery.reactive);
	const buckets = $derived(bucketQuery.reactive);
	const categories = $derived(categoryQuery.reactive);
	const transactionTags = $derived(transactionTagQuery.reactive);
	const transactionTransferDismissals = $derived(transactionTransferDismissalQuery.reactive);
	const tagOptions = $derived(tags.filter((tag) => Boolean(tag.id)));
	const bucketOptions = $derived(buckets.filter((bucket) => Boolean(bucket.id)));
	const categoryOptions = $derived(categories.filter((category) => Boolean(category.id)));

	const bucketName = (id: string) =>
		buckets.find((bucket) => bucket.id === id)?.raw.name ?? 'Unknown';
	const categoryName = (id: string | null) =>
		id
			? (categories.find((category) => category.id === id)?.raw.name ?? 'Unassigned')
			: 'Unassigned';
	const tagName = (id: string) => tags.find((tag) => tag.id === id)?.raw.name ?? 'Unknown';

	const linksByTransaction = $derived.by(() => {
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

	type GridRow = {
		id: string;
		date: string;
		description: string | null;
		amount: number;
		account: string;
		accountId: string;
		categoryId: string | null;
		category: string;
		tags: string;
		tagIds: string[];
		transferSibling: string | null;
		isTransfer: boolean;
		potentialTransferCount: number;
		potentialTransferStatus: string;
	};

	type PotentialTransferReviewAction = 'review' | 'confirm' | 'dismiss';

	let filterAccount = $state('');
	let filterTag = $state('');
	let filterCategory = $state('');
	let filterMinAmount = $state('');
	let filterMaxAmount = $state('');
	let filterStartDate = $state('');
	let filterEndDate = $state('');
	let search = $state('');

	const toCents = (value: string) => {
		const parsed = parseAmountToMinorUnit(value, {
			unit: 'major',
			signStrategy: 'signed'
		});
		return parsed.ok ? parsed.cents : null;
	};

	const dismissedTransferPairKeys = $derived.by(
		() =>
			new Set(
				transactionTransferDismissals.map((dismissal) =>
					transferPairKey(dismissal.raw.left_transaction_id, dismissal.raw.right_transaction_id)
				)
			)
	);

	const potentialTransfersByTransaction = $derived.by(() => {
		const transferCandidates: PotentialTransferLike[] = [];
		for (const tx of transactions) {
			const id = tx.id ?? tx.raw.id;
			if (!id) continue;
			transferCandidates.push({
				id,
				created_at: tx.raw.created_at,
				amount: tx.raw.amount,
				bucket_id: tx.raw.bucket_id,
				description: tx.raw.description,
				transfer_sibling: tx.raw.transfer_sibling ?? null
			});
		}

		return detectPotentialTransferMatches(transferCandidates, dismissedTransferPairKeys);
	});

	const gridRows = $derived.by<GridRow[]>(() =>
		transactions
			.map((tx) => {
				const txId = tx.id ?? tx.raw.id;
				if (!txId) return null;
				const tagIds = linksByTransaction.get(txId) ?? [];
				const potentialTransferCount = potentialTransfersByTransaction.get(txId)?.length ?? 0;
				return {
					id: txId,
					date: tx.raw.created_at,
					description: tx.raw.description,
					amount: tx.raw.amount,
					account: bucketName(tx.raw.bucket_id),
					accountId: tx.raw.bucket_id,
					categoryId: tx.raw.category,
					category: categoryName(tx.raw.category),
					tags: tagIds.map(tagName).join(', '),
					tagIds,
					transferSibling: getTransferSiblingId(tx.raw as unknown as Record<string, unknown>),
					isTransfer: isTransferTransaction(tx.raw as unknown as Record<string, unknown>),
					potentialTransferCount,
					potentialTransferStatus: potentialTransferCount
						? potentialTransferCount > 1
							? `May be a transfer (${potentialTransferCount} matches)`
							: 'Potential transfer'
						: ''
				};
			})
			.filter((row): row is GridRow => Boolean(row))
	);

	const filteredRows = $derived(
		gridRows.filter((row) => {
			const rowTs = Date.parse(row.date);
			if (filterAccount && row.accountId !== filterAccount) return false;
			if (filterTag && !row.tagIds.includes(filterTag)) return false;
			if (filterCategory && row.categoryId !== filterCategory) return false;
			const min = filterMinAmount ? toCents(filterMinAmount) : null;
			const max = filterMaxAmount ? toCents(filterMaxAmount) : null;
			if (min !== null && row.amount < min) return false;
			if (max !== null && row.amount > max) return false;
			if (filterStartDate && rowTs < Date.parse(`${filterStartDate}T00:00:00Z`)) return false;
			if (filterEndDate) {
				const endTs = Date.parse(`${filterEndDate}T23:59:59.999Z`);
				if (rowTs > endTs) return false;
			}
			if (search) {
				const value = `${row.description ?? ''} ${row.account} ${row.tags}`.toLowerCase();
				if (!value.includes(search.toLowerCase())) return false;
			}
			return true;
		})
	);

	const filteredTransactionsForTable = $derived.by(() => {
		const included = new Set(filteredRows.map((row) => row.id));
		return transactions.filter((tx) => included.has(tx.id ?? tx.raw.id));
	});

	const colDefs = $derived<ColDef<GridRow>[]>([
		{
			field: 'date',
			headerName: 'Date',
			sort: 'desc',
			valueFormatter: (params) => localDateLabel(String(params.value ?? ''))
		},
		{
			field: 'description',
			headerName: 'Description',
			valueFormatter: (params) => String(params.value ?? '')
		},
		{
			field: 'amount',
			headerName: 'Amount',
			cellClass: 'text-end',
			valueFormatter: (params) => centsToCurrency(Number(params.value ?? 0))
		},
		{
			field: 'account',
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
			field: 'potentialTransferStatus',
			headerName: 'Potential transfer',
			cellClass: (params) => {
				const row = params.data;
				if (!row || row.isTransfer || !row.potentialTransferCount) return '';
				return row.potentialTransferCount > 1
					? 'tx-potential-transfer tx-potential-transfer-ambiguous'
					: 'tx-potential-transfer';
			}
		},
		{
			field: 'isTransfer',
			headerName: 'Type',
			valueFormatter: (params) => (params.value ? 'Transfer' : 'Standard')
		}
	]);

	const selectedRows = () => [] as GridRow[];

	const getTransactionRow = (transactionId: string) =>
		gridRows.find((row) => row.id === transactionId);

	const focusTransactionRow = (transactionId: string) => {
		const row = getTransactionRow(transactionId);
		notify({
			title: 'Review transfer match',
			message: row
				? `Match: ${row.account} • ${localDateLabel(row.date)} • ${centsToCurrency(row.amount)} • ${row.description ?? '—'}`
				: 'Matching transaction is outside the current filter.',
			color: row ? 'info' : 'warning',
			autoHide: 5000
		});
	};

	const dismissPotentialTransfer = async (transactionId: string, matchId: string) => {
		const pair = normalizeTransferPair(transactionId, matchId);
		const dismissalId = uuidv5(
			`transfer-dismissal|${pair.left_transaction_id}|${pair.right_transaction_id}`,
			IMPORT_NAMESPACE
		);
		const result = await transactionTransferDismissalStruct.upsert(
			[
				{
					id: dismissalId,
					...pair
				}
			],
			{
				onConflict: 'id',
				ignoreDuplicates: true
			}
		);
		if (result.isErr()) throw result.error;
	};

	const confirmPotentialTransfer = async (transactionId: string, matchId: string) => {
		if (transactionId === matchId) {
			throw new Error('Cannot confirm a transfer using the same transaction record.');
		}
		const transaction = transactions.find((tx) => tx.id === transactionId);
		const match = transactions.find((tx) => tx.id === matchId);
		if (!transaction || !match) {
			throw new Error('Could not find one or both transactions to confirm transfer.');
		}
		if (!isWithinPotentialTransferDayRange(transaction.raw.created_at, match.raw.created_at)) {
			throw new Error('Potential transfer match is no longer within 3 days.');
		}
		if (transaction.raw.amount + match.raw.amount !== 0) {
			throw new Error('Potential transfer match is no longer an exact opposite amount.');
		}
		if (
			getTransferSiblingId(transaction.raw as unknown as Record<string, unknown>) ||
			getTransferSiblingId(match.raw as unknown as Record<string, unknown>)
		) {
			throw new Error('One or both transactions are already linked as confirmed transfers.');
		}
		await updateTransferLinks(transactionId, matchId);
	};

	const runPotentialTransferWorkflow = async (
		transactionId: string,
		matchId: string,
		reason: 'single' | 'ambiguous'
	) => {
		const row = getTransactionRow(transactionId);
		const match = getTransactionRow(matchId);
		if (!row || !match) {
			notify({
				title: 'Potential transfer',
				message: 'Could not load details for the selected match.',
				color: 'warning',
				autoHide: 3500
			});
			return;
		}

		const promptPrefix =
			reason === 'ambiguous'
				? 'Multiple possible matches exist. You selected one candidate.\n\n'
				: '';
		const selection = await select(
			`${promptPrefix}Potential match:\nDate ${localDateLabel(row.date)}\nAmount ${centsToCurrency(row.amount)} ↔ ${centsToCurrency(match.amount)}\nDescription "${match.description ?? '—'}"\nAccount ${match.account}`,
			[
				{ value: 'review', text: 'Review match in table' },
				{ value: 'confirm', text: 'Confirm transfer' },
				{ value: 'dismiss', text: 'Dismiss suggestion' }
			] satisfies Array<{ value: PotentialTransferReviewAction; text: string }>,
			{
				title: 'Potential transfer',
				render: (option) => option.text
			}
		);

		if (!selection) return;

		try {
			if (selection.value === 'review') {
				focusTransactionRow(matchId);
				return;
			}

			if (selection.value === 'confirm') {
				await confirmPotentialTransfer(transactionId, matchId);
				notify({
					title: 'Transfer confirmed',
					message: 'Transactions are now linked as a confirmed transfer.',
					color: 'success',
					autoHide: 3500
				});
				return;
			}

			await dismissPotentialTransfer(transactionId, matchId);
			notify({
				title: 'Suggestion dismissed',
				message: 'This potential transfer pair will no longer be suggested.',
				color: 'success',
				autoHide: 3500
			});
		} catch (error) {
			notify({
				title: 'Potential transfer action failed',
				message: error instanceof Error ? error.message : String(error),
				color: 'danger',
				autoHide: 5000
			});
		}
	};

	const reviewPotentialTransferForTransaction = async (transactionId: string) => {
		const matches = potentialTransfersByTransaction.get(transactionId) ?? [];
		if (!matches.length) {
			notify({
				title: 'Potential transfer',
				message: 'No potential transfer matches are available for this transaction.',
				color: 'warning',
				autoHide: 3500
			});
			return;
		}

		if (matches.length === 1) {
			await runPotentialTransferWorkflow(transactionId, matches[0]!.id, 'single');
			return;
		}

		const selectedMatch = await select(
			'Multiple possible matches exist for this transaction. Choose one to review, confirm, or dismiss.',
			matches,
			{
				title: 'Potential transfer matches',
				render: (match) =>
					`${localDateLabel(match.created_at)} · ${centsToCurrency(match.amount)} · ${
						match.description ?? '—'
					} · ${bucketName(match.bucket_id)}`
			}
		);
		if (!selectedMatch) return;

		await runPotentialTransferWorkflow(transactionId, selectedMatch.id, 'ambiguous');
	};

	let editId = $state<string | null>(null);
	let formDescription = $state('');
	let formAmount = $state('');
	let formDate = $state(new Date().toISOString().slice(0, 10));
	let formBucketId = $state('');
	let formCategoryId = $state('');
	let formTagIds = $state<string[]>([]);
	let formIsTransfer = $state(false);
	let formTransferBucketId = $state('');
	let submitting = $state(false);
	const effectiveFormBucketId = $derived(formBucketId || buckets[0]?.id || '');

	const resetForm = () => {
		editId = null;
		formDescription = '';
		formAmount = '';
		formDate = new Date().toISOString().slice(0, 10);
		formBucketId = '';
		formCategoryId = '';
		formTagIds = [];
		formIsTransfer = false;
		formTransferBucketId = '';
	};

	const syncTransactionTags = async (transactionId: string, selectedTagIds: string[]) => {
		const existing = transactionTags.filter((link) => link.raw.transaction_id === transactionId);
		const selected = [...new Set(selectedTagIds)];
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

	const startEdit = (row: GridRow) => {
		editId = row.id;
		formDescription = row.description ?? '';
		formAmount = String(row.amount / 100);
		formDate = row.date.slice(0, 10);
		formBucketId = row.accountId;
		formCategoryId = row.categoryId ?? '';
		formTagIds = [...row.tagIds];
		formIsTransfer = row.isTransfer;
		const sibling = row.transferSibling
			? transactions.find((tx) => tx.id === row.transferSibling)
			: undefined;
		formTransferBucketId = sibling?.raw.bucket_id ?? '';
	};

	const updateTransferLinks = async (leftId: string, rightId: string) => {
		const left = transactions.find((tx) => tx.id === leftId);
		const right = transactions.find((tx) => tx.id === rightId);
		if (!left || !right) throw new Error('Unable to link transfer transactions');
		const leftUpdate = await left.update({
			transfer_sibling: buildLinkedTransferUpdate(leftId, rightId).transfer_sibling
		});
		if (leftUpdate.isErr()) throw leftUpdate.error;
		const rightUpdate = await right.update({
			transfer_sibling: buildLinkedTransferUpdate(rightId, leftId).transfer_sibling
		});
		if (rightUpdate.isErr()) throw rightUpdate.error;
	};

	const clearTransferLinks = async (leftId: string, rightId?: string | null) => {
		const ids = [leftId, rightId].filter((value): value is string => Boolean(value));
		if (!ids.length) return;
		for (const id of ids) {
			const row = transactions.find((tx) => tx.id === id);
			if (!row) continue;
			const result = await row.update({ transfer_sibling: null });
			if (result.isErr()) throw result.error;
		}
	};

	const saveTransaction = async () => {
		if (submitting) return;
		const selectedBucketId = formBucketId || buckets[0]?.id || '';
		const cents = toCents(formAmount);
		if (cents === null || !selectedBucketId || !formDate) {
			notify({
				title: 'Validation',
				message: 'Amount, date, and account are required',
				color: 'warning',
				autoHide: 3000
			});
			return;
		}

		submitting = true;
		try {
			const cleanedDescription = formDescription.trim();
			const basePayload = {
				description: cleanedDescription ? cleanedDescription : null,
				amount: cents,
				bucket_id: selectedBucketId,
				category: formCategoryId || null,
				created_at: new Date(`${formDate}T12:00:00Z`).toISOString()
			};

			if (!editId) {
				const created = await transactionStruct.new(basePayload);
				if (created.isErr()) throw created.error;
				const createdId = created.value[0]?.id ?? created.value[0]?.raw.id;
				if (!createdId) throw new Error('Created transaction has no id');
				await syncTransactionTags(createdId, formTagIds);
				if (formIsTransfer) {
					if (!formTransferBucketId || formTransferBucketId === selectedBucketId) {
						throw new Error('Select a different destination account for transfer pairing');
					}
					const siblingPayload = createTransferSiblingPayload(basePayload, formTransferBucketId);
					const siblingCreated = await transactionStruct.new(siblingPayload);
					if (siblingCreated.isErr()) throw siblingCreated.error;
					const siblingId = siblingCreated.value[0]?.id ?? siblingCreated.value[0]?.raw.id;
					if (!siblingId) throw new Error('Created transfer pair has no id');
					await updateTransferLinks(createdId, siblingId);
				}
				notify({
					title: 'Created',
					message: 'Transaction added',
					color: 'success',
					autoHide: 2500
				});
			} else {
				const current = transactions.find((tx) => tx.id === editId);
				if (!current) throw new Error('Could not find transaction to update');
				const updated = await current.update(basePayload);
				if (updated.isErr()) throw updated.error;
				await syncTransactionTags(editId, formTagIds);

				const existingSiblingId = getTransferSiblingId(
					current.raw as unknown as Record<string, unknown>
				);
				const existingSibling = existingSiblingId
					? transactions.find((tx) => tx.id === existingSiblingId)
					: undefined;

				if (!formIsTransfer && existingSiblingId) {
					await clearTransferLinks(editId, existingSiblingId);
				}

				if (formIsTransfer) {
					if (!formTransferBucketId || formTransferBucketId === selectedBucketId) {
						throw new Error('Select a different destination account for transfer pairing');
					}
					const siblingPayload = createTransferSiblingPayload(basePayload, formTransferBucketId);
					if (existingSiblingId && existingSibling) {
						const siblingUpdated = await existingSibling.update(siblingPayload);
						if (siblingUpdated.isErr()) throw siblingUpdated.error;
						await updateTransferLinks(editId, existingSiblingId);
					} else {
						const siblingCreated = await transactionStruct.new(siblingPayload);
						if (siblingCreated.isErr()) throw siblingCreated.error;
						const siblingId = siblingCreated.value[0]?.id ?? siblingCreated.value[0]?.raw.id;
						if (!siblingId) throw new Error('Created transfer pair has no id');
						await updateTransferLinks(editId, siblingId);
					}
				}

				notify({
					title: 'Saved',
					message: 'Transaction updated',
					color: 'success',
					autoHide: 2500
				});
			}
			resetForm();
		} catch (error) {
			notify({
				title: 'Failed',
				message: error instanceof Error ? error.message : String(error),
				color: 'danger',
				autoHide: 5000
			});
		} finally {
			submitting = false;
		}
	};

	const removeTransaction = async (id: string) => {
		const row = transactions.find((tx) => tx.id === id);
		if (!row) return;
		const siblingId = getTransferSiblingId(row.raw as unknown as Record<string, unknown>);
		const ok = await confirm(
			siblingId
				? 'Delete this transfer and its linked sibling transaction?'
				: 'Delete this transaction?'
		);
		if (!ok) return;
		if (siblingId) {
			const sibling = transactions.find((tx) => tx.id === siblingId);
			const firstDelete = await row.delete();
			if (firstDelete.isErr()) {
				notify({
					title: 'Delete failed',
					message: firstDelete.error.message,
					color: 'danger',
					autoHide: 5000
				});
				return;
			}
			if (sibling) {
				const secondDelete = await sibling.delete();
				if (secondDelete.isErr()) {
					notify({
						title: 'Sibling delete failed',
						message: secondDelete.error.message,
						color: 'danger',
						autoHide: 5000
					});
					return;
				}
			}
		} else {
			const result = await row.delete();
			if (result.isErr()) {
				notify({
					title: 'Delete failed',
					message: result.error.message,
					color: 'danger',
					autoHide: 5000
				});
				return;
			}
		}
		notify({
			title: 'Deleted',
			message: 'Transaction removed',
			color: 'success',
			autoHide: 2500
		});
	};

	let bulkTagId = $state('');
	let bulkCategoryId = $state('__unset__');
	const applyBulkTag = async () => {
		if (!bulkTagId) return;
		const rows = selectedRows();
		if (!rows.length) return;
		let failed = 0;
		for (const row of rows) {
			try {
				const existing = linksByTransaction.get(row.id) ?? [];
				await syncTransactionTags(
					row.id,
					[...existing, bulkTagId].filter((value, index, arr) => arr.indexOf(value) === index)
				);
			} catch {
				failed += 1;
			}
		}
		notify({
			title: 'Bulk tagging complete',
			message: failed ? `${failed} row(s) failed` : `Tagged ${rows.length} row(s)`,
			color: failed ? 'warning' : 'success',
			autoHide: 3500
		});
	};

	const applyBulkCategory = async () => {
		const rows = selectedRows();
		if (!rows.length) return;
		if (bulkCategoryId === '__unset__') return;
		const categoryId = bulkCategoryId || null;
		let failed = 0;
		for (const row of rows) {
			try {
				const tx = transactions.find((candidate) => candidate.id === row.id);
				if (!tx) {
					failed += 1;
					continue;
				}
				const updated = await tx.update({ category: categoryId });
				if (updated.isErr()) {
					failed += 1;
				}
			} catch {
				failed += 1;
			}
		}
		notify({
			title: 'Bulk category complete',
			message: failed
				? `${failed} row(s) failed`
				: categoryId
					? `Category applied to ${rows.length} row(s)`
					: `Category cleared for ${rows.length} row(s)`,
			color: failed ? 'warning' : 'success',
			autoHide: 3500
		});
	};

	type ImportParseSettings = {
		delimiter: CsvDelimiter;
		headerRow: number;
		dateFormat: DateFormat;
	};

	type ImportMapping = {
		date: string;
		description: string;
		category: string;
		tags: string;
		amountMode: 'single' | 'debit-credit';
		amount: string;
		debit: string;
		credit: string;
		signStrategy: AmountSignStrategy;
		indicator: string;
		indicatorExpenseValues: string;
		indicatorIncomeValues: string;
		amountUnit: AmountUnit;
	};

	type EditableImportField = 'date' | 'description' | 'amount' | 'category' | 'tags';

	type ImportedCsvRow = CsvDataRow & {
		sourceFileName: string;
	};

	type LoadedCsvFile = {
		name: string;
		text: string;
	};

	type CsvBatchParseResult = {
		headers: string[];
		rows: ImportedCsvRow[];
		rejectedFiles: Array<{ name: string; reason: string }>;
	};

	type ImportRow = {
		id: string;
		sourceFileName: string;
		sourceRowNumber: number;
		source: Record<string, string>;
		current: {
			dateText: string;
			description: string;
			amountText: string;
			accountText: string;
			categoryText: string;
			tagsText: string;
			include: boolean;
		};
		baseline: {
			dateText: string;
			description: string;
			amountText: string;
			accountText: string;
			categoryText: string;
			tagsText: string;
		};
		manualEdits: Record<EditableImportField, boolean>;
		autoTransforms: Record<EditableImportField, boolean>;
		isNew: boolean;
		excluded: boolean;
		duplicate: boolean;
		errors: string[];
		warnings: string[];
		parsed: {
			dateIso: string | null;
			amount: number | null;
			bucketId: string | null;
			categoryId: string | null;
			tags: string[];
		};
	};

	type ImportResult = {
		status: 'idle' | 'running' | 'done';
		total: number;
		selected: number;
		successful: number;
		failed: number;
		skipped: number;
		excluded: number;
		errors: Array<{ rowId: string; rowNumber: number; message: string }>;
	};

	let importStep = $state<1 | 2 | 3 | 4 | 5>(1);
	let csvFileNames = $state<string[]>([]);
	let csvFiles = $state<LoadedCsvFile[]>([]);
	let rejectedCsvFiles = $state<Array<{ name: string; reason: string }>>([]);
	let parseSettings = $state<ImportParseSettings>({
		delimiter: ',',
		headerRow: 0,
		dateFormat: 'auto'
	});
	let parsedRows = $state<ImportedCsvRow[]>([]);
	let csvHeaders = $state<string[]>([]);

	let mapping = $state<ImportMapping>({
		date: '',
		description: '',
		category: '',
		tags: '',
		amountMode: 'single',
		amount: '',
		debit: '',
		credit: '',
		signStrategy: 'signed',
		indicator: '',
		indicatorExpenseValues: 'debit,expense,outflow,dr',
		indicatorIncomeValues: 'credit,income,inflow,cr',
		amountUnit: 'major'
	});

	let importRows = $state<ImportRow[]>([]);
	let importGridRef: InstanceType<typeof Grid<ImportRow>> | null = $state(null);
	let generatingPreview = $state(false);
	let importing = $state(false);
	let createMissingTags = $state(true);
	let skipLikelyDuplicates = $state(true);
	let pendingRebuildWarning = $state(false);
	let importBucketId = $state('');
	const effectiveImportBucketId = $derived(importBucketId || buckets[0]?.id || '');
	const effectiveImportBucketName = $derived(
		buckets.find((bucket) => bucket.id === effectiveImportBucketId)?.raw.name ?? ''
	);
	let importResult = $state<ImportResult>({
		status: 'idle',
		total: 0,
		selected: 0,
		successful: 0,
		failed: 0,
		skipped: 0,
		excluded: 0,
		errors: []
	});

	const hasParsedCsv = $derived(Boolean(parsedRows.length && csvHeaders.length));
	const selectedImportRows = () => importGridRef?.getSelection() ?? [];

	const existingImportKeys = $derived(
		new Set(
			transactions.map((tx) =>
				buildDuplicateKey(tx.raw.bucket_id, tx.raw.created_at, tx.raw.amount, tx.raw.description)
			)
		)
	);

	const normalizeHeader = (value: string) => value.trim().toLowerCase();
	const headersMatchExactly = (a: string[], b: string[]) =>
		a.length === b.length && a.every((header, index) => header === b[index]);

	const parseCsvBatch = (
		files: LoadedCsvFile[],
		config: { delimiter: CsvDelimiter; headerRow: number }
	): CsvBatchParseResult => {
		if (!files.length) {
			return {
				headers: [],
				rows: [],
				rejectedFiles: []
			};
		}

		let baselineHeaders: string[] | null = null;
		const rows: ImportedCsvRow[] = [];
		const rejectedFiles: Array<{ name: string; reason: string }> = [];

		for (const file of files) {
			const parsed = parseCsv(file.text, config);
			if (!baselineHeaders) {
				baselineHeaders = parsed.headers;
			}

			if (!headersMatchExactly(parsed.headers, baselineHeaders)) {
				rejectedFiles.push({
					name: file.name,
					reason: 'Column headers do not exactly match the first file'
				});
				continue;
			}

			for (const row of parsed.rows) {
				rows.push({
					...row,
					sourceFileName: file.name
				});
			}
		}

		return {
			headers: baselineHeaders ?? [],
			rows,
			rejectedFiles
		};
	};

	const guessMapping = (headers: string[]) => {
		const find = (regex: RegExp) =>
			headers.find((header) => regex.test(normalizeHeader(header))) ?? '';
		const date = find(/(^|[_\s])(date|posted|transaction date)([_\s]|$)/i);
		const description = find(/description|memo|details|narrative|payee|merchant/i);
		const amount = find(/amount|value|total|sum/i);
		const debit = find(/debit|withdraw|outflow|expense/i);
		const credit = find(/credit|deposit|inflow|income/i);
		const indicator = find(/type|direction|debit.?credit|dr.?cr|flow/i);
		const category = find(/category/i);
		const tags = find(/tag|labels?/i);
		const guessedMode = debit && credit ? 'debit-credit' : 'single';
		const guessedDateFormat = date ? parseDateGuess(date) : 'auto';

		parseSettings = {
			...parseSettings,
			dateFormat: guessedDateFormat
		};

		mapping = {
			...mapping,
			date,
			description,
			category,
			tags,
			amountMode: guessedMode,
			amount: guessedMode === 'single' ? amount || debit || credit : '',
			debit: guessedMode === 'debit-credit' ? debit : '',
			credit: guessedMode === 'debit-credit' ? credit : '',
			indicator,
			signStrategy: indicator ? 'indicator-column' : 'signed'
		};
	};

	const parseDateGuess = (column: string): DateFormat => {
		if (!parsedRows.length) return 'auto';
		const samples = parsedRows
			.slice(0, 30)
			.map((row) => row.record[column]?.trim())
			.filter(Boolean);
		let iso = 0;
		let us = 0;
		let eu = 0;
		for (const value of samples) {
			if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) iso += 1;
			if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(value)) {
				const [a, b] = value.split(/[-/]/).map((part) => Number(part));
				if (a > 12 && b <= 12) eu += 1;
				if (b > 12 && a <= 12) us += 1;
			}
		}
		if (iso >= us && iso >= eu) return 'iso';
		if (us > eu) return 'us';
		if (eu > us) return 'eu';
		return 'auto';
	};

	const onCsvSelected = async (event: Event) => {
		const target = event.currentTarget as HTMLInputElement;
		const selectedFiles = [...(target.files ?? [])];
		if (!selectedFiles.length) return;

		const loadedFiles = await Promise.all(
			selectedFiles.map(async (file) => ({
				name: file.name,
				text: await file.text()
			}))
		);

		const first = loadedFiles[0];
		const detectedDelimiter = detectDelimiter(first.text);
		const firstPass = parseCsv(first.text, { delimiter: detectedDelimiter });
		const detectedHeaderRow = detectHeaderRow(firstPass.matrix);
		const nextParseSettings: ImportParseSettings = {
			delimiter: detectedDelimiter,
			headerRow: detectedHeaderRow,
			dateFormat: 'auto'
		};
		const parsed = parseCsvBatch(loadedFiles, {
			delimiter: nextParseSettings.delimiter,
			headerRow: nextParseSettings.headerRow
		});

		csvFiles = loadedFiles;
		csvFileNames = loadedFiles.map((file) => file.name);
		rejectedCsvFiles = parsed.rejectedFiles;
		parseSettings = {
			...nextParseSettings
		};
		parsedRows = parsed.rows;
		csvHeaders = parsed.headers;

		if (!parsed.rows.length) {
			notify({
				title: 'CSV',
				message: parsed.rejectedFiles.length
					? 'No compatible rows were loaded. Ensure all selected CSV files use the same exact header format.'
					: 'CSV parsed, but no data rows were found below the selected header row.',
				color: 'warning',
				autoHide: 4000
			});
		}
		if (parsed.rejectedFiles.length) {
			notify({
				title: 'Some files were skipped',
				message: `${parsed.rejectedFiles.length} file(s) were ignored because their columns do not match the first file.`,
				color: 'warning',
				autoHide: 5000
			});
		}

		guessMapping(parsed.headers);
		importRows = [];
		importStep = 2;
		importResult = {
			status: 'idle',
			total: 0,
			selected: 0,
			successful: 0,
			failed: 0,
			skipped: 0,
			excluded: 0,
			errors: []
		};
	};

	const reparseCsv = () => {
		if (!csvFiles.length) return;
		const parsed = parseCsvBatch(csvFiles, {
			delimiter: parseSettings.delimiter,
			headerRow: parseSettings.headerRow
		});
		parsedRows = parsed.rows;
		csvHeaders = parsed.headers;
		rejectedCsvFiles = parsed.rejectedFiles;
		guessMapping(parsed.headers);
		pendingRebuildWarning = Boolean(importRows.length);
		if (parsed.rejectedFiles.length) {
			notify({
				title: 'Some files were skipped',
				message: `${parsed.rejectedFiles.length} file(s) were ignored because their columns do not match the first file under the current parser settings.`,
				color: 'warning',
				autoHide: 5000
			});
		}
	};

	const buildDuplicateKey = (
		bucketId: string | null,
		dateIso: string | null,
		amount: number | null,
		description: string | null
	) => {
		if (!bucketId || !dateIso || amount === null) return '';
		return `${bucketId}|${dateIso.slice(0, 10)}|${amount}|${(description ?? '').trim().toLowerCase()}`;
	};

	const parseMappedAmount = (row: Record<string, string>) => {
		if (mapping.amountMode === 'single') {
			const amountRaw = row[mapping.amount] ?? '';
			return parseAmountToMinorUnit(amountRaw, {
				unit: mapping.amountUnit,
				signStrategy: mapping.signStrategy,
				indicatorValue: mapping.indicator ? row[mapping.indicator] : undefined,
				indicatorExpenseValues: mapping.indicatorExpenseValues,
				indicatorIncomeValues: mapping.indicatorIncomeValues
			});
		}
		return parseDebitCreditToMinorUnit(row[mapping.debit] ?? '', row[mapping.credit] ?? '', {
			unit: mapping.amountUnit
		});
	};

	const resolveCategoryIdByName = (name: string) => {
		const normalized = name.trim().toLowerCase();
		if (!normalized) return null;
		return (
			categories.find((category) => category.raw.name.trim().toLowerCase() === normalized)?.id ??
			null
		);
	};

	const toImportRow = (sourceRow: ImportedCsvRow, rowIndex: number): ImportRow => {
		const dateSource = sourceRow.record[mapping.date] ?? '';
		const descriptionSource = sourceRow.record[mapping.description] ?? '';
		const categorySource = mapping.category ? (sourceRow.record[mapping.category] ?? '') : '';
		const tagSource = mapping.tags ? (sourceRow.record[mapping.tags] ?? '') : '';
		const amountSource =
			mapping.amountMode === 'single'
				? (sourceRow.record[mapping.amount] ?? '')
				: `${sourceRow.record[mapping.debit] ?? ''} / ${sourceRow.record[mapping.credit] ?? ''}`;

		const dateIso = parseDate(dateSource, parseSettings.dateFormat);
		const amountResult = parseMappedAmount(sourceRow.record);
		const bucket = buckets.find((candidate) => candidate.id === effectiveImportBucketId) ?? null;
		const parsedAmount = amountResult.ok ? amountResult.cents : null;
		const parsedTags = splitTags(tagSource);
		const description = descriptionSource.trim();
		const categoryText = categorySource.trim();
		const categoryId = resolveCategoryIdByName(categoryText);
		const amountText = parsedAmount === null ? amountSource : String(parsedAmount / 100);
		const dateText = dateIso ? dateIso.slice(0, 10) : dateSource.trim();

		return {
			id: uuidv5(
				`import|${sourceRow.sourceRowNumber}|${rowIndex}|${descriptionSource}`,
				IMPORT_NAMESPACE
			),
			sourceFileName: sourceRow.sourceFileName,
			sourceRowNumber: sourceRow.sourceRowNumber,
			source: sourceRow.record,
			current: {
				dateText,
				description,
				amountText,
				accountText: bucket?.raw.name ?? '',
				categoryText,
				tagsText: parsedTags.join(', '),
				include: true
			},
			baseline: {
				dateText,
				description,
				amountText,
				accountText: bucket?.raw.name ?? '',
				categoryText,
				tagsText: parsedTags.join(', ')
			},
			manualEdits: {
				date: false,
				description: false,
				amount: false,
				category: false,
				tags: false
			},
			autoTransforms: {
				date: dateText !== dateSource.trim(),
				description: description !== descriptionSource,
				amount: amountText !== amountSource.trim(),
				category: categoryText !== categorySource,
				tags: parsedTags.join(', ') !== tagSource.trim()
			},
			isNew: false,
			excluded: false,
			duplicate: false,
			errors: [],
			warnings: [],
			parsed: {
				dateIso,
				amount: parsedAmount,
				bucketId: bucket?.id ?? null,
				categoryId,
				tags: parsedTags
			}
		};
	};

	const validateImportRow = (row: ImportRow): ImportRow => {
		const errors: string[] = [];
		const warnings: string[] = [];

		const parsedDate = parseDate(row.current.dateText, 'auto');
		if (!parsedDate) errors.push('Invalid date');
		const amountResult = parseAmountToMinorUnit(row.current.amountText, {
			unit: 'major',
			signStrategy: 'signed'
		});
		if (!amountResult.ok) errors.push(`Invalid amount: ${amountResult.error}`);
		const selectedBucket = buckets.find((bucket) => bucket.id === effectiveImportBucketId) ?? null;
		if (!selectedBucket) errors.push('Select a destination account/bucket');
		const categoryId = resolveCategoryIdByName(row.current.categoryText);
		if (row.current.categoryText.trim() && !categoryId) errors.push('Unknown category name');

		return {
			...row,
			parsed: {
				dateIso: parsedDate,
				amount: amountResult.ok ? amountResult.cents : null,
				bucketId: selectedBucket?.id ?? null,
				categoryId,
				tags: splitTags(row.current.tagsText)
			},
			excluded: !row.current.include,
			errors,
			warnings
		};
	};

	const recalculateRows = (rows: ImportRow[]) => {
		const validated = rows.map(validateImportRow);
		const seen = new SvelteSet<string>();
		return validated.map((row) => {
			const key = buildDuplicateKey(
				row.parsed.bucketId,
				row.parsed.dateIso,
				row.parsed.amount,
				row.current.description
			);
			const duplicate = key ? existingImportKeys.has(key) || seen.has(key) : false;
			if (key) seen.add(key);
			return { ...row, duplicate };
		});
	};

	const buildPreviewRows = async () => {
		if (!parsedRows.length) {
			notify({
				title: 'CSV import',
				message: 'Upload and parse one or more CSV files first.',
				color: 'warning',
				autoHide: 3000
			});
			return;
		}

		const required: string[] = [];
		if (!mapping.date) required.push('Date column');
		if (!mapping.description) required.push('Description column');
		if (mapping.amountMode === 'single' && !mapping.amount) required.push('Amount column');
		if (mapping.amountMode === 'debit-credit' && (!mapping.debit || !mapping.credit)) {
			required.push('Debit and credit columns');
		}
		if (!effectiveImportBucketId) required.push('Destination account/bucket');
		if (mapping.signStrategy === 'indicator-column' && !mapping.indicator) {
			required.push('Indicator column');
		}
		if (required.length) {
			notify({
				title: 'Mapping required',
				message: `Please map: ${required.join(', ')}`,
				color: 'warning',
				autoHide: 4500
			});
			return;
		}

		generatingPreview = true;
		try {
			importRows = recalculateRows(parsedRows.map(toImportRow));
			importStep = 3;
			pendingRebuildWarning = false;
		} finally {
			generatingPreview = false;
		}
	};

	const importRowFormatter = (params: ValueFormatterParams<ImportRow>) => {
		const value = params.value;
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return value == null ? '' : String(value);
	};

	const markFieldEdit = (
		row: ImportRow,
		field: EditableImportField,
		current: string,
		baseline: string
	): Record<EditableImportField, boolean> => ({
		...row.manualEdits,
		[field]: current !== baseline
	});

	const onImportCellChanged = (event: CellValueChangedEvent<ImportRow>) => {
		const row = event.data;
		if (!row) return;
		const field = String(event.colDef.field ?? '');
		let updated: ImportRow = row;
		if (field === 'dateText') {
			updated = {
				...row,
				current: { ...row.current, dateText: String(row.current.dateText ?? '') },
				manualEdits: markFieldEdit(row, 'date', row.current.dateText, row.baseline.dateText)
			};
		} else if (field === 'description') {
			updated = {
				...row,
				current: { ...row.current, description: String(row.current.description ?? '') },
				manualEdits: markFieldEdit(
					row,
					'description',
					row.current.description,
					row.baseline.description
				)
			};
		} else if (field === 'amountText') {
			updated = {
				...row,
				current: { ...row.current, amountText: String(row.current.amountText ?? '') },
				manualEdits: markFieldEdit(row, 'amount', row.current.amountText, row.baseline.amountText)
			};
		} else if (field === 'categoryText') {
			updated = {
				...row,
				current: { ...row.current, categoryText: String(row.current.categoryText ?? '') },
				manualEdits: markFieldEdit(
					row,
					'category',
					row.current.categoryText,
					row.baseline.categoryText
				)
			};
		} else if (field === 'tagsText') {
			updated = {
				...row,
				current: { ...row.current, tagsText: String(row.current.tagsText ?? '') },
				manualEdits: markFieldEdit(row, 'tags', row.current.tagsText, row.baseline.tagsText)
			};
		} else if (field === 'include') {
			updated = {
				...row,
				current: { ...row.current, include: Boolean(row.current.include) }
			};
		}

		importRows = recalculateRows(
			importRows.map((candidate) => (candidate.id === row.id ? updated : candidate))
		);
	};

	const toggleIncludeForSelection = (include: boolean) => {
		const selected = selectedImportRows();
		if (!selected.length) return;
		const selectedIds = new Set(selected.map((row) => row.id));
		importRows = recalculateRows(
			importRows.map((row) =>
				selectedIds.has(row.id) ? { ...row, current: { ...row.current, include } } : row
			)
		);
	};

	const removeSelectedImportRows = async () => {
		const selected = selectedImportRows();
		if (!selected.length) return;
		const ok = await confirm(`Remove ${selected.length} selected import row(s)?`);
		if (!ok) return;
		const selectedIds = new Set(selected.map((row) => row.id));
		importRows = recalculateRows(importRows.filter((row) => !selectedIds.has(row.id)));
	};

	const onImportBucketChange = (bucketId: string) => {
		importBucketId = bucketId;
		const selectedBucketName =
			buckets.find((bucket) => bucket.id === (bucketId || buckets[0]?.id || ''))?.raw.name ?? '';
		importRows = recalculateRows(
			importRows.map((row) => ({
				...row,
				current: {
					...row.current,
					accountText: selectedBucketName
				},
				baseline: {
					...row.baseline,
					accountText: selectedBucketName
				}
			}))
		);
	};

	const addImportRow = () => {
		const createdAt = new Date().toISOString().slice(0, 10);
		const newRow: ImportRow = {
			id: uuidv5(`manual|${Date.now()}|${importRows.length}`, IMPORT_NAMESPACE),
			sourceFileName: 'Manual',
			sourceRowNumber: 0,
			source: {},
			current: {
				dateText: createdAt,
				description: '',
				amountText: '0.00',
				accountText: effectiveImportBucketName,
				categoryText: '',
				tagsText: '',
				include: true
			},
			baseline: {
				dateText: createdAt,
				description: '',
				amountText: '0.00',
				accountText: effectiveImportBucketName,
				categoryText: '',
				tagsText: ''
			},
			manualEdits: {
				date: false,
				description: false,
				amount: false,
				category: false,
				tags: false
			},
			autoTransforms: {
				date: false,
				description: false,
				amount: false,
				category: false,
				tags: false
			},
			isNew: true,
			excluded: false,
			duplicate: false,
			errors: [],
			warnings: [],
			parsed: {
				dateIso: parseDate(createdAt, 'iso'),
				amount: 0,
				bucketId: effectiveImportBucketId || null,
				categoryId: null,
				tags: []
			}
		};
		importRows = recalculateRows([...importRows, newRow]);
		importStep = 3;
	};

	const restoreRowBaseline = async (id: string) => {
		const row = importRows.find((candidate) => candidate.id === id);
		if (!row) return;
		const ok = await confirm('Restore this row to its original transformed values?');
		if (!ok) return;
		const restored: ImportRow = {
			...row,
			current: {
				...row.current,
				dateText: row.baseline.dateText,
				description: row.baseline.description,
				amountText: row.baseline.amountText,
				accountText: row.baseline.accountText,
				categoryText: row.baseline.categoryText,
				tagsText: row.baseline.tagsText,
				include: true
			},
			manualEdits: {
				date: false,
				description: false,
				amount: false,
				category: false,
				tags: false
			}
		};
		importRows = recalculateRows(
			importRows.map((candidate) => (candidate.id === id ? restored : candidate))
		);
	};

	const importColDefs = $derived<ColDef<ImportRow>[]>([
		{
			field: 'sourceFileName',
			headerName: 'CSV File',
			width: 180,
			editable: false,
			valueFormatter: (params) => String(params.value ?? 'Manual')
		},
		{
			field: 'sourceRowNumber',
			headerName: 'CSV #',
			width: 90,
			valueFormatter: (params) => (params.value ? String(params.value) : 'New')
		},
		{
			field: 'current.include',
			headerName: 'Include',
			width: 95,
			editable: true,
			valueGetter: (params) => params.data?.current.include ?? false,
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.include = Boolean(params.newValue);
				return true;
			},
			valueFormatter: importRowFormatter
		},
		{
			field: 'current.dateText',
			headerName: 'Date',
			editable: true,
			valueGetter: (params) => params.data?.current.dateText ?? '',
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.dateText = String(params.newValue ?? '');
				return true;
			},
			tooltipValueGetter: (params) => `Original: ${params.data?.source[mapping.date] ?? '—'}`
		},
		{
			field: 'current.description',
			headerName: 'Description',
			editable: true,
			flex: 1.5,
			valueGetter: (params) => params.data?.current.description ?? '',
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.description = String(params.newValue ?? '');
				return true;
			},
			tooltipValueGetter: (params) => `Original: ${params.data?.source[mapping.description] ?? '—'}`
		},
		{
			field: 'current.amountText',
			headerName: 'Amount',
			editable: true,
			cellClass: 'text-end',
			valueGetter: (params) => params.data?.current.amountText ?? '',
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.amountText = String(params.newValue ?? '');
				return true;
			},
			tooltipValueGetter: (params) =>
				`Original: ${
					mapping.amountMode === 'single'
						? (params.data?.source[mapping.amount] ?? '—')
						: `${params.data?.source[mapping.debit] ?? ''} / ${params.data?.source[mapping.credit] ?? ''}`
				}`
		},
		{
			field: 'current.accountText',
			headerName: 'Account',
			editable: false,
			valueGetter: (params) => params.data?.current.accountText ?? '',
			tooltipValueGetter: () =>
				effectiveImportBucketName
					? `Selected bucket: ${effectiveImportBucketName}`
					: 'No bucket selected'
		},
		{
			field: 'current.categoryText',
			headerName: 'Category',
			editable: true,
			valueGetter: (params) => params.data?.current.categoryText ?? '',
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.categoryText = String(params.newValue ?? '');
				return true;
			},
			tooltipValueGetter: (params) => `Original: ${params.data?.source[mapping.category] ?? '—'}`
		},
		{
			field: 'current.tagsText',
			headerName: 'Tags',
			editable: true,
			valueGetter: (params) => params.data?.current.tagsText ?? '',
			valueSetter: (params) => {
				if (!params.data) return false;
				params.data.current.tagsText = String(params.newValue ?? '');
				return true;
			},
			tooltipValueGetter: (params) => `Original: ${params.data?.source[mapping.tags] ?? '—'}`
		},
		{
			field: 'errors',
			headerName: 'Validation',
			editable: false,
			flex: 1.5,
			valueFormatter: (params) => {
				const row = params.data;
				if (!row) return '';
				const messages = [...row.errors, ...row.warnings];
				if (row.duplicate && skipLikelyDuplicates)
					messages.push('Likely duplicate (will be skipped)');
				if (!messages.length) return 'Valid';
				return messages.join(' • ');
			}
		}
	]);

	const importRowClass = (params: RowClassParams<ImportRow>) => {
		const row = params.data;
		if (!row) return '';
		if (row.isNew) return 'import-row-new';
		if (row.excluded) return 'import-row-excluded';
		if (row.errors.length) return 'import-row-invalid';
		if (row.duplicate) return 'import-row-duplicate';
		if (Object.values(row.manualEdits).some(Boolean)) return 'import-row-edited';
		return '';
	};

	const validRowsForImport = $derived(
		importRows.filter((row) => {
			if (!row.current.include) return false;
			if (row.errors.length) return false;
			if (skipLikelyDuplicates && row.duplicate) return false;
			return true;
		})
	);

	const importSummary = $derived.by(() => {
		let income = 0;
		let expenses = 0;
		for (const row of validRowsForImport) {
			const amount = row.parsed.amount ?? 0;
			if (amount >= 0) income += amount;
			else expenses += Math.abs(amount);
		}
		return {
			total: importRows.length,
			selected: validRowsForImport.length,
			invalid: importRows.filter((row) => row.errors.length).length,
			excluded: importRows.filter((row) => !row.current.include).length,
			duplicates: importRows.filter((row) => row.duplicate).length,
			income,
			expenses,
			net: income - expenses
		};
	});

	const ensureTags = async (tagNames: string[]) => {
		const map = new SvelteMap(tags.map((tag) => [tag.raw.name.toLowerCase(), tag.id]));
		const missing = tagNames.filter((name) => !map.has(name.toLowerCase()));
		if (missing.length && createMissingTags) {
			const created = await tagStruct.new(...missing.map((name) => ({ name, color: '#6c757d' })));
			if (created.isErr()) throw created.error;
			for (const row of created.value) map.set(row.raw.name.toLowerCase(), row.id);
		}
		return map;
	};

	const buildImportId = (row: ImportRow) => {
		const key = buildDuplicateKey(
			row.parsed.bucketId,
			row.parsed.dateIso,
			row.parsed.amount,
			row.current.description
		);
		return uuidv5(`csv-import|${key || row.id}`, IMPORT_NAMESPACE);
	};

	const runImport = async () => {
		if (importing) return;
		if (!validRowsForImport.length) {
			notify({
				title: 'Import',
				message: 'No valid selected rows to import.',
				color: 'warning',
				autoHide: 3500
			});
			return;
		}

		const confirmImport = await confirm(
			`Import ${validRowsForImport.length} transaction(s)? Invalid/excluded rows will be skipped.`
		);
		if (!confirmImport) return;

		importing = true;
		importStep = 4;
		importResult = {
			status: 'running',
			total: importRows.length,
			selected: validRowsForImport.length,
			successful: 0,
			failed: 0,
			skipped: importRows.length - validRowsForImport.length,
			excluded: importRows.filter((row) => !row.current.include).length,
			errors: []
		};

		try {
			const allTagNames = validRowsForImport
				.flatMap((row) => row.parsed.tags)
				.map((name) => name.trim())
				.filter(Boolean)
				.filter((value, index, arr) => arr.indexOf(value) === index);
			const tagMap = await ensureTags(allTagNames);

			const batchSize = 150;
			for (let start = 0; start < validRowsForImport.length; start += batchSize) {
				const chunk = validRowsForImport.slice(start, start + batchSize);
				const payload = chunk.map((row) => ({
					id: buildImportId(row),
					description: row.current.description.trim() || null,
					amount: row.parsed.amount ?? 0,
					bucket_id: row.parsed.bucketId ?? '',
					category: row.parsed.categoryId,
					created_at: row.parsed.dateIso ?? new Date().toISOString()
				}));

				const upsertBatch = await transactionStruct.upsert(payload as never, {
					onConflict: 'id',
					ignoreDuplicates: true
				});

				if (upsertBatch.isErr()) {
					for (let i = 0; i < chunk.length; i++) {
						const row = chunk[i];
						const single = payload[i];
						const singleUpsert = await transactionStruct.upsert([single] as never, {
							onConflict: 'id',
							ignoreDuplicates: true
						});
						if (singleUpsert.isErr()) {
							importResult = {
								...importResult,
								failed: importResult.failed + 1,
								errors: [
									...importResult.errors,
									{
										rowId: row.id,
										rowNumber: row.sourceRowNumber,
										message: singleUpsert.error.message
									}
								]
							};
							continue;
						}
						importResult = {
							...importResult,
							successful: importResult.successful + 1
						};

						const tagLinks = row.parsed.tags
							.map((name) => tagMap.get(name.toLowerCase()))
							.filter((tagId): tagId is string => Boolean(tagId))
							.map((tagId) => ({
								id: uuidv5(`${single.id}|${tagId}`, IMPORT_NAMESPACE),
								archived: false,
								transaction_id: single.id,
								tag_id: tagId
							}));
						if (tagLinks.length) {
							const tagUpsert = await transactionTagStruct.upsert(tagLinks, {
								onConflict: 'id',
								ignoreDuplicates: true
							});
							if (tagUpsert.isErr()) {
								importResult = {
									...importResult,
									failed: importResult.failed + 1,
									successful: Math.max(0, importResult.successful - 1),
									errors: [
										...importResult.errors,
										{
											rowId: row.id,
											rowNumber: row.sourceRowNumber,
											message: `Tag link failed: ${tagUpsert.error.message}`
										}
									]
								};
							}
						}
					}
					continue;
				}

				importResult = {
					...importResult,
					successful: importResult.successful + chunk.length
				};

				const allLinks = chunk.flatMap((row, index) => {
					const txId = payload[index].id;
					return row.parsed.tags
						.map((name) => tagMap.get(name.toLowerCase()))
						.filter((tagId): tagId is string => Boolean(tagId))
						.map((tagId) => ({
							id: uuidv5(`${txId}|${tagId}`, IMPORT_NAMESPACE),
							archived: false,
							transaction_id: txId,
							tag_id: tagId
						}));
				});
				if (allLinks.length) {
					const linkUpsert = await transactionTagStruct.upsert(allLinks, {
						onConflict: 'id',
						ignoreDuplicates: true
					});
					if (linkUpsert.isErr()) {
						importResult = {
							...importResult,
							failed: importResult.failed + allLinks.length,
							errors: [
								...importResult.errors,
								{
									rowId: chunk[0].id,
									rowNumber: chunk[0].sourceRowNumber,
									message: `Tag link batch failed: ${linkUpsert.error.message}`
								}
							]
						};
					}
				}
			}

			importResult = {
				...importResult,
				status: 'done'
			};
			importStep = 5;
			notify({
				title: 'Import finished',
				message: `Successful: ${importResult.successful}, Failed: ${importResult.failed}, Skipped: ${importResult.skipped}`,
				color: importResult.failed ? 'warning' : 'success',
				autoHide: 7000
			});
		} catch (error) {
			importResult = {
				...importResult,
				status: 'done',
				failed: importResult.selected,
				successful: 0,
				errors: [
					...importResult.errors,
					{
						rowId: 'global',
						rowNumber: 0,
						message: error instanceof Error ? error.message : String(error)
					}
				]
			};
			importStep = 5;
			notify({
				title: 'Import failed',
				message: error instanceof Error ? error.message : String(error),
				color: 'danger',
				autoHide: 7000
			});
		} finally {
			importing = false;
		}
	};
</script>

<div class="container-fluid py-3">
	<div class="row g-3">
		<div class="col-12 col-xl-4">
			<Card title={editId ? 'Edit transaction' : 'New transaction'}>
				{#snippet body()}
					<div class="vstack gap-2">
						<input class="form-control" placeholder="Description" bind:value={formDescription} />
						<input class="form-control" placeholder="Amount" bind:value={formAmount} />
						<input class="form-control" type="date" bind:value={formDate} />
						<select
							class="form-select"
							value={effectiveFormBucketId}
							onchange={(event) => {
								formBucketId = (event.currentTarget as HTMLSelectElement).value;
							}}
						>
							{#each bucketOptions as bucket (bucket.id)}
								<option value={bucket.id ?? ''}>{bucket.raw.name}</option>
							{/each}
						</select>
						<select class="form-select" bind:value={formCategoryId}>
							<option value="">Unassigned category</option>
							{#each categoryOptions as category (category.id)}
								<option value={category.id ?? ''}>{category.raw.name}</option>
							{/each}
						</select>
						<div class="form-check">
							<input
								id="tx-transfer"
								class="form-check-input"
								type="checkbox"
								bind:checked={formIsTransfer}
							/>
							<label class="form-check-label" for="tx-transfer">Mark as transfer</label>
						</div>
						{#if formIsTransfer}
							<select class="form-select" bind:value={formTransferBucketId}>
								<option value="">Select transfer destination account</option>
								{#each bucketOptions as bucket (bucket.id)}
									{#if bucket.id !== effectiveFormBucketId}
										<option value={bucket.id ?? ''}>{bucket.raw.name}</option>
									{/if}
								{/each}
							</select>
							<div class="form-text">
								A paired transaction with opposite amount is created/updated in the selected
								account.
							</div>
						{/if}
						<label class="form-label mb-0" for="tx-tags">Tags</label>
						<select
							id="tx-tags"
							class="form-select"
							multiple
							onchange={(event) => {
								const target = event.currentTarget as HTMLSelectElement;
								formTagIds = [...target.selectedOptions].map((option) => option.value);
							}}
						>
							{#each tagOptions as tag (tag.id)}
								<option value={tag.id ?? ''} selected={tag.id ? formTagIds.includes(tag.id) : false}
									>{tag.raw.name}</option
								>
							{/each}
						</select>
						<div class="d-flex gap-2">
							<button
								class="btn btn-primary"
								type="button"
								disabled={submitting}
								onclick={saveTransaction}
							>
								{editId ? 'Save' : 'Create'}
							</button>
							<button class="btn btn-outline-secondary" type="button" onclick={resetForm}
								>Reset</button
							>
						</div>
					</div>
				{/snippet}
			</Card>

			<Card title="Guided CSV import" classes="mt-3">
				{#snippet body()}
					<div class="vstack gap-3">
						<div>
							<div class="fw-semibold">1. Upload CSV</div>
							<input
								class="form-control mt-1"
								type="file"
								accept=".csv,text/csv"
								multiple
								onchange={onCsvSelected}
							/>
							{#if csvFileNames.length}
								<div class="form-text">
									Loaded {csvFileNames.length} file(s): {csvFileNames.join(', ')}
								</div>
							{/if}
							{#if rejectedCsvFiles.length}
								<div class="alert alert-warning py-2 px-3 mt-2 mb-0">
									<div class="fw-semibold small mb-1">Skipped files (format mismatch):</div>
									<ul class="small mb-0 ps-3">
										{#each rejectedCsvFiles as rejected (rejected.name)}
											<li>{rejected.name}: {rejected.reason}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>

						<div>
							<div class="fw-semibold">2. Configure parsing & map columns</div>
							<div class="row g-2 mt-1">
								<div class="col-6">
									<label class="form-label mb-0" for="csv-delimiter">Delimiter</label>
									<select
										id="csv-delimiter"
										class="form-select form-select-sm"
										bind:value={parseSettings.delimiter}
									>
										<option value=",">Comma (,)</option>
										<option value=";">Semicolon (;)</option>
										<option value="\t">Tab</option>
										<option value="|">Pipe (|)</option>
									</select>
								</div>
								<div class="col-6">
									<label class="form-label mb-0" for="csv-header-row">Header row (1-based)</label>
									<input
										id="csv-header-row"
										class="form-control form-control-sm"
										type="number"
										min="1"
										value={String(parseSettings.headerRow + 1)}
										onchange={(event) => {
											const target = event.currentTarget as HTMLInputElement;
											const row = Math.max(1, Number(target.value || '1'));
											parseSettings = { ...parseSettings, headerRow: row - 1 };
										}}
									/>
								</div>
								<div class="col-6">
									<label class="form-label mb-0" for="csv-date-format">Date format</label>
									<select
										id="csv-date-format"
										class="form-select form-select-sm"
										bind:value={parseSettings.dateFormat}
									>
										<option value="auto">Auto detect</option>
										<option value="iso">ISO / browser parse</option>
										<option value="us">US (MM/DD/YYYY)</option>
										<option value="eu">EU (DD/MM/YYYY)</option>
									</select>
								</div>
								<div class="col-6 d-flex align-items-end">
									<button
										class="btn btn-outline-secondary btn-sm w-100"
										type="button"
										onclick={reparseCsv}
									>
										Re-parse CSV
									</button>
								</div>
							</div>

							{#if hasParsedCsv}
								<div class="row g-2 mt-2">
									<div class="col-6">
										<label class="form-label mb-0" for="map-date">Date</label>
										<select
											id="map-date"
											class="form-select form-select-sm"
											bind:value={mapping.date}
										>
											<option value="">Select</option>
											{#each csvHeaders as header (header)}
												<option value={header}>{header}</option>
											{/each}
										</select>
									</div>
									<div class="col-6">
										<label class="form-label mb-0" for="map-description">Description</label>
										<select
											id="map-description"
											class="form-select form-select-sm"
											bind:value={mapping.description}
										>
											<option value="">Select</option>
											{#each csvHeaders as header (header)}
												<option value={header}>{header}</option>
											{/each}
										</select>
									</div>
									<div class="col-6">
										<label class="form-label mb-0" for="import-bucket">
											Destination account/bucket
										</label>
										<select
											id="import-bucket"
											class="form-select form-select-sm"
											value={effectiveImportBucketId}
											onchange={(event) => {
												onImportBucketChange((event.currentTarget as HTMLSelectElement).value);
											}}
										>
											<option value="">Select</option>
											{#each bucketOptions as bucket (bucket.id)}
												<option value={bucket.id ?? ''}>{bucket.raw.name}</option>
											{/each}
										</select>
									</div>
									<div class="col-6">
										<label class="form-label mb-0" for="map-category">Category (optional)</label>
										<select
											id="map-category"
											class="form-select form-select-sm"
											bind:value={mapping.category}
										>
											<option value="">Ignore</option>
											{#each csvHeaders as header (header)}
												<option value={header}>{header}</option>
											{/each}
										</select>
									</div>
									<div class="col-6">
										<label class="form-label mb-0" for="map-tags">Tags (optional)</label>
										<select
											id="map-tags"
											class="form-select form-select-sm"
											bind:value={mapping.tags}
										>
											<option value="">Ignore</option>
											{#each csvHeaders as header (header)}
												<option value={header}>{header}</option>
											{/each}
										</select>
									</div>
									<div class="col-6">
										<label class="form-label mb-0" for="map-amount-mode">Amount mapping</label>
										<select
											id="map-amount-mode"
											class="form-select form-select-sm"
											bind:value={mapping.amountMode}
										>
											<option value="single">Single amount column</option>
											<option value="debit-credit">Separate debit / credit columns</option>
										</select>
									</div>

									{#if mapping.amountMode === 'single'}
										<div class="col-6">
											<label class="form-label mb-0" for="map-amount">Amount column</label>
											<select
												id="map-amount"
												class="form-select form-select-sm"
												bind:value={mapping.amount}
											>
												<option value="">Select</option>
												{#each csvHeaders as header (header)}
													<option value={header}>{header}</option>
												{/each}
											</select>
										</div>
										<div class="col-6">
											<label class="form-label mb-0" for="map-amount-unit">Amount unit</label>
											<select
												id="map-amount-unit"
												class="form-select form-select-sm"
												bind:value={mapping.amountUnit}
											>
												<option value="major">Major units (dollars)</option>
												<option value="minor">Minor units (cents)</option>
											</select>
										</div>
										<div class="col-6">
											<label class="form-label mb-0" for="map-sign-strategy"
												>Sign interpretation</label
											>
											<select
												id="map-sign-strategy"
												class="form-select form-select-sm"
												bind:value={mapping.signStrategy}
											>
												<option value="signed">Use sign from amount (+ / -)</option>
												<option value="positive-expense">Positive means expense</option>
												<option value="positive-income">Positive means income</option>
												<option value="indicator-column">Use indicator column</option>
											</select>
										</div>
										{#if mapping.signStrategy === 'indicator-column'}
											<div class="col-6">
												<label class="form-label mb-0" for="map-indicator-column"
													>Indicator column</label
												>
												<select
													id="map-indicator-column"
													class="form-select form-select-sm"
													bind:value={mapping.indicator}
												>
													<option value="">Select</option>
													{#each csvHeaders as header (header)}
														<option value={header}>{header}</option>
													{/each}
												</select>
											</div>
											<div class="col-6">
												<label class="form-label mb-0" for="map-indicator-expense">
													Expense indicator values
												</label>
												<input
													id="map-indicator-expense"
													class="form-control form-control-sm"
													bind:value={mapping.indicatorExpenseValues}
												/>
											</div>
											<div class="col-6">
												<label class="form-label mb-0" for="map-indicator-income">
													Income indicator values
												</label>
												<input
													id="map-indicator-income"
													class="form-control form-control-sm"
													bind:value={mapping.indicatorIncomeValues}
												/>
											</div>
										{/if}
									{:else}
										<div class="col-6">
											<label class="form-label mb-0" for="map-debit-column">Debit column</label>
											<select
												id="map-debit-column"
												class="form-select form-select-sm"
												bind:value={mapping.debit}
											>
												<option value="">Select</option>
												{#each csvHeaders as header (header)}
													<option value={header}>{header}</option>
												{/each}
											</select>
										</div>
										<div class="col-6">
											<label class="form-label mb-0" for="map-credit-column">Credit column</label>
											<select
												id="map-credit-column"
												class="form-select form-select-sm"
												bind:value={mapping.credit}
											>
												<option value="">Select</option>
												{#each csvHeaders as header (header)}
													<option value={header}>{header}</option>
												{/each}
											</select>
										</div>
										<div class="col-6">
											<label class="form-label mb-0" for="map-amount-unit-split">Amount unit</label>
											<select
												id="map-amount-unit-split"
												class="form-select form-select-sm"
												bind:value={mapping.amountUnit}
											>
												<option value="major">Major units (dollars)</option>
												<option value="minor">Minor units (cents)</option>
											</select>
										</div>
									{/if}
								</div>

								<div class="form-text mt-2">
									Columns are never discarded silently. Unmapped columns remain available in source
									values for comparison.
								</div>
							{/if}
						</div>

						<div>
							<div class="fw-semibold">3. Build editable preview</div>
							<div class="d-flex gap-2 mt-1">
								<button
									class="btn btn-primary btn-sm"
									type="button"
									disabled={generatingPreview}
									onclick={buildPreviewRows}
								>
									{generatingPreview ? 'Building…' : 'Generate preview rows'}
								</button>
								<button
									class="btn btn-outline-secondary btn-sm"
									type="button"
									onclick={addImportRow}
								>
									Add row
								</button>
							</div>
							{#if pendingRebuildWarning}
								<div class="form-text text-warning mt-1">
									Mapping/parsing changed. Re-generate preview to apply changes.
								</div>
							{/if}
						</div>
					</div>
				{/snippet}
			</Card>
		</div>

		<div class="col-12 col-xl-8">
			<Card title="Transaction filters">
				{#snippet body()}
					<div class="row g-2">
						<div class="col-12 col-md-4">
							<input class="form-control" placeholder="Search" bind:value={search} />
						</div>
						<div class="col-6 col-md-4">
							<select class="form-select" bind:value={filterAccount}>
								<option value="">All accounts</option>
								{#each bucketOptions as bucket (bucket.id)}
									<option value={bucket.id ?? ''}>{bucket.raw.name}</option>
								{/each}
							</select>
						</div>
						<div class="col-6 col-md-4">
							<select class="form-select" bind:value={filterTag}>
								<option value="">All tags</option>
								{#each tagOptions as tag (tag.id)}
									<option value={tag.id ?? ''}>{tag.raw.name}</option>
								{/each}
							</select>
						</div>
						<div class="col-6 col-md-4">
							<select class="form-select" bind:value={filterCategory}>
								<option value="">All categories</option>
								{#each categoryOptions as category (category.id)}
									<option value={category.id ?? ''}>{category.raw.name}</option>
								{/each}
							</select>
						</div>
						<div class="col-6 col-md-4">
							<input class="form-control" placeholder="Min amount" bind:value={filterMinAmount} />
						</div>
						<div class="col-6 col-md-4">
							<input class="form-control" placeholder="Max amount" bind:value={filterMaxAmount} />
						</div>
						<div class="col-6 col-md-4">
							<input class="form-control" type="date" bind:value={filterStartDate} />
						</div>
						<div class="col-6 col-md-4">
							<input class="form-control" type="date" bind:value={filterEndDate} />
						</div>
					</div>
				{/snippet}
			</Card>

			<Card title="Transactions" classes="mt-3">
				{#snippet body()}
					<div class="d-flex justify-content-between align-items-center mb-2">
						<div class="small text-muted">{filteredRows.length} row(s)</div>
						<div class="small text-muted">Right-click for create/edit/category/tag actions</div>
					</div>

					<TransactionsTable
						transactions={filteredTransactionsForTable}
						{buckets}
						{categories}
						{tags}
						{transactionTags}
						{transactionStruct}
						{transactionTagStruct}
						editable={true}
						height={560}
						emptyMessage="No transactions in this filter."
						potentialTransfersByTransaction={potentialTransfersByTransaction}
						onPotentialTransferReview={reviewPotentialTransferForTransaction}
					/>
				{/snippet}
			</Card>

			{#if importRows.length}
				<Card title="4. Review and edit import preview" classes="mt-3">
					{#snippet body()}
						<div class="d-flex flex-wrap gap-2 mb-2">
							<button class="btn btn-outline-secondary btn-sm" type="button" onclick={addImportRow}
								>Add row</button
							>
							<button
								class="btn btn-outline-secondary btn-sm"
								type="button"
								onclick={() => toggleIncludeForSelection(false)}
							>
								Exclude selected
							</button>
							<button
								class="btn btn-outline-secondary btn-sm"
								type="button"
								onclick={() => toggleIncludeForSelection(true)}
							>
								Include selected
							</button>
							<button
								class="btn btn-outline-danger btn-sm"
								type="button"
								onclick={removeSelectedImportRows}>Remove selected</button
							>
							<button
								class="btn btn-outline-secondary btn-sm"
								type="button"
								onclick={async () => {
									const row = selectedImportRows()[0];
									if (row) await restoreRowBaseline(row.id);
								}}
							>
								Restore first selected
							</button>
						</div>

						<div class="form-check mb-2">
							<input
								id="skip-likely-duplicates"
								class="form-check-input"
								type="checkbox"
								bind:checked={skipLikelyDuplicates}
							/>
							<label class="form-check-label" for="skip-likely-duplicates">
								Skip likely duplicate rows on import
							</label>
						</div>
						<div class="form-check mb-2">
							<input
								id="create-missing-tags"
								class="form-check-input"
								type="checkbox"
								bind:checked={createMissingTags}
							/>
							<label class="form-check-label" for="create-missing-tags">
								Create missing tags automatically
							</label>
						</div>

						<Grid
							bind:this={importGridRef}
							data={importRows}
							opts={{
								columnDefs: importColDefs,
								defaultColDef: {
									sortable: true,
									filter: true,
									resizable: true
								},
								pagination: true,
								paginationPageSize: 50,
								rowSelection: 'multiple',
								getRowClass: importRowClass,
								onCellValueChanged: onImportCellChanged
							}}
							height={520}
						/>
						<div class="form-text mt-2">
							Edited cells are highlighted. Hover editable cells to inspect original CSV values.
						</div>
					{/snippet}
				</Card>

				<Card title="5. Confirm import" classes="mt-3">
					{#snippet body()}
						<div class="row g-2">
							<div class="col-6 col-md-4">
								<div class="small text-muted">Total parsed rows</div>
								<div class="fw-semibold">{importSummary.total}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Rows selected</div>
								<div class="fw-semibold">{importSummary.selected}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Invalid rows</div>
								<div class="fw-semibold">{importSummary.invalid}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Excluded rows</div>
								<div class="fw-semibold">{importSummary.excluded}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Likely duplicates</div>
								<div class="fw-semibold">{importSummary.duplicates}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Total income</div>
								<div class="fw-semibold text-success">{centsToCurrency(importSummary.income)}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Total expenses</div>
								<div class="fw-semibold text-danger">{centsToCurrency(importSummary.expenses)}</div>
							</div>
							<div class="col-6 col-md-4">
								<div class="small text-muted">Net</div>
								<div class="fw-semibold">{centsToCurrency(importSummary.net)}</div>
							</div>
						</div>

						<div class="d-flex gap-2 mt-3">
							<button
								class="btn btn-success"
								type="button"
								disabled={importing}
								onclick={runImport}
							>
								{importing ? 'Importing…' : 'Run import'}
							</button>
							<button
								class="btn btn-outline-secondary"
								type="button"
								onclick={() => (importStep = 3)}
							>
								Back to review
							</button>
						</div>

						{#if importResult.status !== 'idle'}
							<div class="small mt-2">
								Status: {importResult.status} · Successful {importResult.successful} · Failed
								{importResult.failed} · Skipped {importResult.skipped} · Excluded
								{importResult.excluded}
							</div>
						{/if}
					{/snippet}
				</Card>
			{/if}

			{#if importStep === 5}
				<Card title="Import results" classes="mt-3">
					{#snippet body()}
						<div class="row g-2">
							<div class="col-6 col-md-3">
								<div class="small text-muted">Successful</div>
								<div class="fw-semibold text-success">{importResult.successful}</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="small text-muted">Failed</div>
								<div class="fw-semibold text-danger">{importResult.failed}</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="small text-muted">Skipped</div>
								<div class="fw-semibold">{importResult.skipped}</div>
							</div>
							<div class="col-6 col-md-3">
								<div class="small text-muted">Excluded</div>
								<div class="fw-semibold">{importResult.excluded}</div>
							</div>
						</div>

						{#if importResult.errors.length}
							<div class="table-responsive mt-3">
								<table class="table table-sm table-striped mb-0">
									<thead>
										<tr>
											<th>Row</th>
											<th>Error</th>
										</tr>
									</thead>
									<tbody>
										{#each importResult.errors as issue (issue.rowId + issue.message)}
											<tr>
												<td>{issue.rowNumber || '—'}</td>
												<td>{issue.message}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{/snippet}
				</Card>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(.tx-potential-transfer) {
		color: var(--bs-warning-text-emphasis);
		font-weight: 600;
	}

	:global(.tx-potential-transfer-ambiguous) {
		color: var(--bs-orange);
	}

	:global(.import-row-new .ag-cell) {
		background: color-mix(in srgb, var(--bs-info) 12%, transparent);
	}

	:global(.import-row-edited .ag-cell) {
		background: color-mix(in srgb, var(--bs-primary) 10%, transparent);
	}

	:global(.import-row-invalid .ag-cell) {
		background: color-mix(in srgb, var(--bs-danger) 14%, transparent);
	}

	:global(.import-row-duplicate .ag-cell) {
		background: color-mix(in srgb, var(--bs-warning) 14%, transparent);
	}

	:global(.import-row-excluded .ag-cell) {
		opacity: 0.7;
		background: color-mix(in srgb, var(--bs-secondary) 10%, transparent);
	}
</style>
