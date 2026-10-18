import type { SupaStructData } from '$lib/services/supabase/supastruct.svelte';
import { isTransferTransaction } from '$lib/services/finance/transfer';

export type DateRangeKey = 'this-month' | 'last-month' | 'last-3-months' | 'ytd' | 'custom';

export type DateWindow = {
	start: Date;
	end: Date;
};

export const centsToCurrency = (amount: number, currency = 'USD') =>
	new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency
	}).format(amount / 100);

export const localDateLabel = (iso: string) =>
	new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: '2-digit'
	}).format(new Date(iso));

export const getDateWindow = (
	range: DateRangeKey,
	custom: {
		start: string;
		end: string;
	}
): DateWindow => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();

	if (range === 'custom') {
		const start = new Date(custom.start);
		const end = new Date(custom.end);
		if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
			start.setHours(0, 0, 0, 0);
			end.setHours(23, 59, 59, 999);
			return { start, end };
		}
	}

	if (range === 'this-month') {
		return {
			start: new Date(year, month, 1, 0, 0, 0, 0),
			end: new Date(year, month + 1, 0, 23, 59, 59, 999)
		};
	}

	if (range === 'last-month') {
		return {
			start: new Date(year, month - 1, 1, 0, 0, 0, 0),
			end: new Date(year, month, 0, 23, 59, 59, 999)
		};
	}

	if (range === 'last-3-months') {
		return {
			start: new Date(year, month - 2, 1, 0, 0, 0, 0),
			end: new Date(year, month + 1, 0, 23, 59, 59, 999)
		};
	}

	return {
		start: new Date(year, 0, 1, 0, 0, 0, 0),
		end: new Date(year, month + 1, 0, 23, 59, 59, 999)
	};
};

export const aggregateSeries = (
	transactions: SupaStructData<'budgeting', 'transaction'>[],
	window: DateWindow
) => {
	const totalDays = Math.ceil(
		(window.end.getTime() - window.start.getTime()) / (1000 * 60 * 60 * 24)
	);
	const useMonthly = totalDays > 120;
	const formatter = new Intl.DateTimeFormat(
		undefined,
		useMonthly ? { year: 'numeric', month: 'short' } : { month: 'short', day: '2-digit' }
	);

	const buckets = new Map<
		string,
		{
			ts: number;
			income: number;
			expenses: number;
		}
	>();

	for (const tx of transactions) {
		if (isTransferTransaction(tx.raw as unknown as Record<string, unknown>)) continue;
		const at = new Date(tx.raw.created_at);
		if (at < window.start || at > window.end) continue;

		const keyDate = useMonthly
			? new Date(at.getFullYear(), at.getMonth(), 1)
			: new Date(at.getFullYear(), at.getMonth(), at.getDate());
		const key = keyDate.toISOString();
		const existing = buckets.get(key) ?? {
			ts: keyDate.getTime(),
			income: 0,
			expenses: 0
		};

		if (tx.raw.amount >= 0) existing.income += tx.raw.amount;
		else existing.expenses += Math.abs(tx.raw.amount);

		buckets.set(key, existing);
	}

	const sorted = [...buckets.entries()].sort((a, b) => a[1].ts - b[1].ts);
	const labels: string[] = [];
	const income: number[] = [];
	const expenses: number[] = [];
	const net: number[] = [];
	const net_cents: number[] = [];

	for (const [iso, point] of sorted) {
		labels.push(formatter.format(new Date(iso)));
		income.push(point.income / 100);
		expenses.push(point.expenses / 100);
		net.push((point.income - point.expenses) / 100);
		net_cents.push(point.income - point.expenses);
	}

	return {
		labels,
		income,
		expenses,
		net,
		net_cents
	};
};

export const calculateBackwardBalanceSeries = (netCentsSeries: number[], totalBalanceCents: number) => {
	const balances: number[] = new Array(netCentsSeries.length);
	let running = totalBalanceCents;
	for (let i = netCentsSeries.length - 1; i >= 0; i--) {
		balances[i] = running / 100;
		running -= netCentsSeries[i] ?? 0;
	}
	return balances;
};

export type BreakdownPoint = {
	label: string;
	income: number;
	expenses: number;
	net: number;
};

const sortBreakdown = (points: BreakdownPoint[]) =>
	points.sort((a, b) => b.income + b.expenses - (a.income + a.expenses));

const toBreakdown = (
	map: Map<string, { income: number; expenses: number }>,
	limit: number
): BreakdownPoint[] =>
	sortBreakdown(
		[...map.entries()].map(([label, totals]) => ({
			label,
			income: totals.income / 100,
			expenses: totals.expenses / 100,
			net: (totals.income - totals.expenses) / 100
		}))
	).slice(0, limit);

export const aggregateByCategory = (
	transactions: SupaStructData<'budgeting', 'transaction'>[],
	resolveCategory: (categoryId: string | null) => string,
	limit = 12
) => {
	const totals = new Map<string, { income: number; expenses: number }>();
	for (const tx of transactions) {
		if (isTransferTransaction(tx.raw as unknown as Record<string, unknown>)) continue;
		const label = resolveCategory(tx.raw.category ?? null);
		const existing = totals.get(label) ?? { income: 0, expenses: 0 };
		if (tx.raw.amount >= 0) existing.income += tx.raw.amount;
		else existing.expenses += Math.abs(tx.raw.amount);
		totals.set(label, existing);
	}
	return toBreakdown(totals, limit);
};

export const aggregateByTag = (
	transactions: SupaStructData<'budgeting', 'transaction'>[],
	resolveTags: (transactionId: string) => string[],
	limit = 12
) => {
	const totals = new Map<string, { income: number; expenses: number }>();
	for (const tx of transactions) {
		if (isTransferTransaction(tx.raw as unknown as Record<string, unknown>)) continue;
		const labels = resolveTags(tx.id ?? tx.raw.id);
		const keys = labels.length ? labels : ['Untagged'];
		for (const key of keys) {
			const existing = totals.get(key) ?? { income: 0, expenses: 0 };
			if (tx.raw.amount >= 0) existing.income += tx.raw.amount;
			else existing.expenses += Math.abs(tx.raw.amount);
			totals.set(key, existing);
		}
	}
	return toBreakdown(totals, limit);
};
