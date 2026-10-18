export type CsvDelimiter = ',' | ';' | '\t' | '|';
export type DateFormat = 'auto' | 'iso' | 'us' | 'eu';
export type AmountUnit = 'major' | 'minor';
export type AmountSignStrategy =
	| 'signed'
	| 'positive-expense'
	| 'positive-income'
	| 'indicator-column';

export type CsvParseConfig = {
	delimiter: CsvDelimiter;
	headerRow: number;
};

export type ParsedCsv = {
	matrix: string[][];
	headers: string[];
	rows: CsvDataRow[];
};

export type CsvDataRow = {
	sourceRowNumber: number;
	cells: string[];
	record: Record<string, string>;
};

export type FieldMapping = {
	dateColumn: string;
	descriptionColumn: string;
	accountColumn: string;
	categoryColumn: string;
	tagsColumn: string;
	amount: AmountMapping;
};

export type AmountMapping = {
	mode: 'single' | 'debit-credit';
	unit: AmountUnit;
	signStrategy: AmountSignStrategy;
	amountColumn: string;
	debitColumn: string;
	creditColumn: string;
	indicatorColumn: string;
	indicatorExpenseValues: string;
	indicatorIncomeValues: string;
};

export type AmountParseResult =
	| {
			ok: true;
			cents: number;
	  }
	| {
			ok: false;
			error: string;
	  };

const BIGINT_MAX = 9_223_372_036_854_775_807n;
const BIGINT_MIN = -9_223_372_036_854_775_808n;
const NUMBER_SAFE_BIGINT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const NUMBER_SAFE_BIGINT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

const DELIMITER_CANDIDATES: CsvDelimiter[] = [',', ';', '\t', '|'];

const cleanHeader = (value: string, fallbackIndex: number) => {
	const trimmed = value.trim();
	return trimmed.length ? trimmed : `Column ${fallbackIndex + 1}`;
};

export const detectDelimiter = (text: string): CsvDelimiter => {
	const lines = text
		.split(/\r\n|\n|\r/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 20);
	if (!lines.length) return ',';

	let best: CsvDelimiter = ',';
	let bestScore = -1;
	for (const delimiter of DELIMITER_CANDIDATES) {
		const counts = lines.map((line) => countDelimiter(line, delimiter));
		const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
		const variance =
			counts.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / counts.length;
		const score = average - variance;
		if (score > bestScore) {
			bestScore = score;
			best = delimiter;
		}
	}
	return best;
};

const countDelimiter = (line: string, delimiter: CsvDelimiter) => {
	let inQuotes = false;
	let count = 0;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const next = line[i + 1];
		if (char === '"' && inQuotes && next === '"') {
			i += 1;
			continue;
		}
		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (!inQuotes && char === delimiter) count += 1;
	}
	return count;
};

export const parseCsvMatrix = (text: string, delimiter: CsvDelimiter): string[][] => {
	const rows: string[][] = [];
	let current: string[] = [];
	let cell = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const next = text[i + 1];

		if (char === '"' && inQuotes && next === '"') {
			cell += '"';
			i += 1;
			continue;
		}

		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}

		if (!inQuotes && char === delimiter) {
			current.push(cell.trim());
			cell = '';
			continue;
		}

		if (!inQuotes && (char === '\n' || char === '\r')) {
			if (char === '\r' && next === '\n') i += 1;
			current.push(cell.trim());
			rows.push(current);
			current = [];
			cell = '';
			continue;
		}

		cell += char;
	}

	if (cell.length || current.length) {
		current.push(cell.trim());
		rows.push(current);
	}

	return rows;
};

export const detectHeaderRow = (matrix: string[][]): number => {
	const sample = matrix.slice(0, 10);
	let bestIndex = 0;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < sample.length; i++) {
		const row = sample[i];
		const nonEmpty = row.filter((cell) => cell.trim().length > 0).length;
		const unique = new Set(row.map((cell) => cell.trim().toLowerCase()).filter(Boolean)).size;
		const alpha = row.filter((cell) => /[a-z]/i.test(cell)).length;
		const score = nonEmpty * 2 + unique + alpha;
		if (score > bestScore) {
			bestScore = score;
			bestIndex = i;
		}
	}
	return bestIndex;
};

export const parseCsv = (text: string, config?: Partial<CsvParseConfig>): ParsedCsv => {
	const delimiter = config?.delimiter ?? detectDelimiter(text);
	const matrix = parseCsvMatrix(text, delimiter);
	const headerRow = config?.headerRow ?? detectHeaderRow(matrix);
	const headerCells = matrix[headerRow] ?? [];
	const headers = dedupeHeaders(headerCells.map((value, index) => cleanHeader(value, index)));

	const rows: CsvDataRow[] = [];
	for (let i = headerRow + 1; i < matrix.length; i++) {
		const source = matrix[i] ?? [];
		const record = Object.fromEntries(
			headers.map((header, index) => [header, String(source[index] ?? '').trim()])
		);
		rows.push({
			sourceRowNumber: i + 1,
			cells: source,
			record
		});
	}

	return {
		matrix,
		headers,
		rows
	};
};

const dedupeHeaders = (headers: string[]) => {
	const map = new Map<string, number>();
	return headers.map((header) => {
		const normalized = header.toLowerCase();
		const count = map.get(normalized) ?? 0;
		map.set(normalized, count + 1);
		if (!count) return header;
		return `${header} (${count + 1})`;
	});
};

export const guessDateFormat = (rows: CsvDataRow[], column: string): DateFormat => {
	const sample = rows
		.slice(0, 30)
		.map((row) => row.record[column]?.trim())
		.filter(Boolean);
	if (!sample.length) return 'auto';
	let usHits = 0;
	let euHits = 0;
	let isoHits = 0;
	for (const value of sample) {
		if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) isoHits += 1;
		if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(value)) {
			const [a, b] = value.split(/[-/]/).map((part) => Number(part));
			if (a > 12 && b <= 12) euHits += 1;
			if (b > 12 && a <= 12) usHits += 1;
		}
	}

	if (isoHits >= usHits && isoHits >= euHits) return 'iso';
	if (usHits > euHits) return 'us';
	if (euHits > usHits) return 'eu';
	return 'auto';
};

export const parseDate = (value: string, format: DateFormat): string | null => {
	const text = value.trim();
	if (!text) return null;

	if (format === 'iso') {
		const dt = new Date(text);
		return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
	}

	if (format === 'us' || format === 'eu') {
		const parts = text.split(/[-/]/);
		if (parts.length !== 3) return null;
		const [x, y, z] = parts.map((part) => Number(part));
		if (!x || !y || !z) return null;
		const year = z < 100 ? 2000 + z : z;
		const month = format === 'us' ? x : y;
		const day = format === 'us' ? y : x;
		if (month < 1 || month > 12 || day < 1 || day > 31) return null;
		const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
		return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
	}

	const inferred = parseDate(text, 'iso') ?? parseDate(text, 'us') ?? parseDate(text, 'eu');
	return inferred;
};

const normalizeIntegerPart = (value: string) => value.replace(/[,_\s]/g, '');

const normalizeDecimal = (value: string) => {
	if (!value) return '';
	return value.replace(/[,_\s]/g, '');
};

const canonicalizeNumericText = (value: string): { sign: 1 | -1; value: string } | null => {
	let text = value.trim();
	if (!text) return null;
	let sign: 1 | -1 = 1;

	if (text.startsWith('(') && text.endsWith(')')) {
		sign = -1;
		text = text.slice(1, -1);
	}

	text = text.replace(/[^\d.,+\-]/g, '');
	if (!text) return null;

	if (text.startsWith('-')) {
		sign = -1;
		text = text.slice(1);
	} else if (text.startsWith('+')) {
		text = text.slice(1);
	}

	const lastDot = text.lastIndexOf('.');
	const lastComma = text.lastIndexOf(',');
	const decimalIndex = Math.max(lastDot, lastComma);
	if (decimalIndex >= 0) {
		const integer = normalizeIntegerPart(text.slice(0, decimalIndex));
		const decimal = normalizeDecimal(text.slice(decimalIndex + 1));
		if (!/^\d*$/.test(integer) || !/^\d*$/.test(decimal)) return null;
		return {
			sign,
			value: decimal.length ? `${integer || '0'}.${decimal}` : integer || '0'
		};
	}

	const integer = normalizeIntegerPart(text);
	if (!/^\d+$/.test(integer)) return null;
	return { sign, value: integer };
};

const parseMajorToBigInt = (value: string, scale: number): { value: bigint } | { error: string } => {
	const canonical = canonicalizeNumericText(value);
	if (!canonical) return { error: 'Amount is blank or not numeric' };
	const [wholeRaw, fracRaw = ''] = canonical.value.split('.');
	if (fracRaw.length > scale) {
		return { error: `Too many decimal places (max ${scale})` };
	}

	const whole = wholeRaw || '0';
	const frac = fracRaw.padEnd(scale, '0');
	const unsigned = BigInt(whole) * BigInt(10 ** scale) + BigInt(frac || '0');
	return { value: canonical.sign === -1 ? -unsigned : unsigned };
};

const parseMinorToBigInt = (value: string): { value: bigint } | { error: string } => {
	const canonical = canonicalizeNumericText(value);
	if (!canonical) return { error: 'Amount is blank or not numeric' };
	if (canonical.value.includes('.')) {
		return { error: 'Cents/minor unit amount cannot contain decimals' };
	}
	const parsed = BigInt(canonical.value);
	return { value: canonical.sign === -1 ? -parsed : parsed };
};

const applySignStrategy = (
	value: bigint,
	strategy: AmountSignStrategy,
	opts: {
		indicatorValue?: string;
		indicatorExpenseValues?: string;
		indicatorIncomeValues?: string;
	}
): { value: bigint } | { error: string } => {
	if (strategy === 'signed') return { value };

	if (strategy === 'positive-expense') {
		return { value: value === 0n ? 0n : -absBigInt(value) };
	}

	if (strategy === 'positive-income') {
		return { value: absBigInt(value) };
	}

	const indicator = opts.indicatorValue?.trim().toLowerCase();
	if (!indicator) {
		return { error: 'Indicator column is blank' };
	}

	const expenseValues = splitIndicatorValues(opts.indicatorExpenseValues);
	const incomeValues = splitIndicatorValues(opts.indicatorIncomeValues);
	const inExpense = expenseValues.has(indicator);
	const inIncome = incomeValues.has(indicator);

	if (inExpense && inIncome) {
		return { error: `Indicator "${indicator}" maps to both income and expense` };
	}
	if (!inExpense && !inIncome) {
		return { error: `Indicator "${indicator}" is not mapped` };
	}
	return { value: inExpense ? -absBigInt(value) : absBigInt(value) };
};

const splitIndicatorValues = (value: string | undefined) =>
	new Set(
		String(value ?? '')
			.split(',')
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean)
	);

const absBigInt = (value: bigint) => (value < 0n ? -value : value);

const assertBigIntRange = (value: bigint): string | null => {
	if (value > BIGINT_MAX || value < BIGINT_MIN) return 'Amount is outside PostgreSQL bigint range';
	if (value > NUMBER_SAFE_BIGINT_MAX || value < NUMBER_SAFE_BIGINT_MIN) {
		return 'Amount exceeds safe integer range for browser numeric transport';
	}
	return null;
};

export const parseAmountToMinorUnit = (
	value: string,
	config: {
		unit: AmountUnit;
		signStrategy: AmountSignStrategy;
		indicatorValue?: string;
		indicatorExpenseValues?: string;
		indicatorIncomeValues?: string;
		currencyMinorUnitScale?: number;
	}
): AmountParseResult => {
	const scale = config.currencyMinorUnitScale ?? 2;
	const parsed =
		config.unit === 'major' ? parseMajorToBigInt(value, scale) : parseMinorToBigInt(value);

	if ('error' in parsed) {
		return { ok: false, error: parsed.error };
	}

	const signed = applySignStrategy(parsed.value, config.signStrategy, {
		indicatorValue: config.indicatorValue,
		indicatorExpenseValues: config.indicatorExpenseValues,
		indicatorIncomeValues: config.indicatorIncomeValues
	});
	if ('error' in signed) {
		return { ok: false, error: signed.error };
	}

	const rangeError = assertBigIntRange(signed.value);
	if (rangeError) {
		return { ok: false, error: rangeError };
	}

	return { ok: true, cents: Number(signed.value) };
};

export const parseDebitCreditToMinorUnit = (
	debitRaw: string,
	creditRaw: string,
	config: {
		unit: AmountUnit;
		currencyMinorUnitScale?: number;
	}
): AmountParseResult => {
	const scale = config.currencyMinorUnitScale ?? 2;
	const debitValue = debitRaw.trim();
	const creditValue = creditRaw.trim();
	const hasDebit = debitValue.length > 0;
	const hasCredit = creditValue.length > 0;
	if (!hasDebit && !hasCredit) {
		return { ok: false, error: 'Both debit and credit are blank' };
	}
	if (hasDebit && hasCredit) {
		return { ok: false, error: 'Both debit and credit are populated; expected one' };
	}

	const parser =
		config.unit === 'major' ? (value: string) => parseMajorToBigInt(value, scale) : parseMinorToBigInt;
	const parsed = parser(hasDebit ? debitValue : creditValue);
	if ('error' in parsed) {
		return { ok: false, error: parsed.error };
	}
	const signed = hasDebit ? -absBigInt(parsed.value) : absBigInt(parsed.value);

	const rangeError = assertBigIntRange(signed);
	if (rangeError) return { ok: false, error: rangeError };
	return { ok: true, cents: Number(signed) };
};

export const splitTags = (value: string) =>
	value
		.split(/[;,]/)
		.map((entry) => entry.trim())
		.filter(Boolean);
