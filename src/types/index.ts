import { TFile } from 'obsidian';

export enum SearchState {
	Idle = 'idle',
	Searching = 'searching',
	Replacing = 'replacing',
	Cancelled = 'cancelled',
	Error = 'error'
}

export interface StateTransition {
	from: SearchState[];
	to: SearchState;
	action?: string;
}

export interface RegexLibraryItem {
	id: string;
	name: string;
	pattern: string;
	description: string;
	category: string;
	flags: string;
	createdAt: number;
	updatedAt: number;
	usage: number;
}

export interface RegexSearchSettings {
	defaultPattern: string;
	caseSensitive: boolean;
	multiline: boolean;
	maxResultsPerFile: number;
	includeHiddenFiles: boolean;
	fileExtensions: string[];
	searchHistory: string[];
	enableSearchHistory: boolean;
	confirmReplace: boolean;
	enableProgressIndicator: boolean;
	excludePatterns: string[];
	enableDebugLogging: boolean;
	regexLibrary: RegexLibraryItem[];
	enableRegexLibrary: boolean;
}

export interface SearchMatch {
	file: TFile;
	line: number;
	column: number;
	match: string;
	context: string;
	lineText: string;
	matchId: string;
}

export interface SearchResult {
	file: TFile;
	matches: SearchMatch[];
	totalMatches: number;
	searchTime: number;
	error?: string;
}

export interface ReplaceResult {
	file: TFile;
	replacedCount: number;
	originalContent: string;
	newContent: string;
	error?: string;
}

export interface VaultReplaceResult {
	totalReplacements: number;
	filesModified: number;
	results: ReplaceResult[];
	errors: string[];
	processingTime: number;
}

export interface SearchProgress {
	current: number;
	total: number;
	currentFile?: string;
	isComplete: boolean;
}
