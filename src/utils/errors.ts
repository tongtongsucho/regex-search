export class RegexValidationError extends Error {
	constructor(message: string, public readonly pattern: string) {
		super(message);
		this.name = 'RegexValidationError';
	}
}

export class SearchTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SearchTimeoutError';
	}
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (error && typeof error === 'object') {
		try {
			return JSON.stringify(error);
		} catch {
			return Object.prototype.toString.call(error);
		}
	}
	if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
		return error.toString();
	}
	if (typeof error === 'symbol') {
		return error.toString();
	}
	if (error === null) {
		return 'null';
	}
	if (error === undefined) {
		return 'undefined';
	}
	return Object.prototype.toString.call(error);
}
