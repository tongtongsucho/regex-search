import { RegexSearchSettings, RegexLibraryItem, StateTransition, SearchState } from '../types';

export const PLUGIN_CONFIG = {
	MAX_REGEX_COMPLEXITY: 1000,
	MAX_FILE_SIZE: 10 * 1024 * 1024,
	BATCH_SIZE: 8,
	SEARCH_BATCH_SIZE: 20,
	DEBOUNCE_DELAY: 150,
	PROGRESS_UPDATE_INTERVAL: 50,
	HIGHLIGHT_DURATION: 3000,
	MAX_CONTEXT_LINES: 2,
	MAX_RESULTS_PER_FILE: 50,
	MIN_SEARCH_LENGTH: 1,
	MAX_SEARCH_LENGTH: 500,
	TIMEOUT_DURATION: 15000,
	MAX_SEARCH_RESULTS: 3000
};

export const DEFAULT_SETTINGS: RegexSearchSettings = {
	defaultPattern: '',
	caseSensitive: false,
	multiline: false,
	maxResultsPerFile: 50,
	includeHiddenFiles: false,
	fileExtensions: ['md'],
	searchHistory: [],
	enableSearchHistory: true,
	confirmReplace: true,
	enableProgressIndicator: true,
	excludePatterns: [],
	enableDebugLogging: false,
	regexLibrary: [],
	enableRegexLibrary: true
};

export const STATE_TRANSITIONS: Record<string, StateTransition> = {
	startSearch: { from: [SearchState.Idle], to: SearchState.Searching, action: 'search' },
	startReplace: { from: [SearchState.Idle], to: SearchState.Replacing, action: 'replace' },
	completeOperation: { from: [SearchState.Searching, SearchState.Replacing], to: SearchState.Idle },
	cancelOperation: { from: [SearchState.Searching, SearchState.Replacing], to: SearchState.Cancelled },
	handleError: { from: [SearchState.Searching, SearchState.Replacing], to: SearchState.Error },
	reset: { from: [SearchState.Cancelled, SearchState.Error], to: SearchState.Idle }
};

export const BUILT_IN_REGEX_LIBRARY: RegexLibraryItem[] = [
	{
		id: 'email',
		name: '电子邮箱',
		pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
		description: '匹配标准格式的电子邮箱地址',
		category: '联系信息',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'phone-cn',
		name: '中国手机号',
		pattern: '1[3-9]\\d{9}',
		description: '匹配中国大陆11位手机号码',
		category: '联系信息',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'phone-fixed-cn',
		name: '中国固定电话',
		pattern: '0\\d{2,3}-?\\d{7,8}',
		description: '匹配中国固定电话号码',
		category: '联系信息',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'url',
		name: '网址链接',
		pattern: 'https?://[^\\s\\]\\)]+',
		description: '匹配HTTP或HTTPS网址',
		category: '网络',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'ip-address',
		name: 'IP地址',
		pattern: '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)',
		description: '匹配IPv4地址',
		category: '网络',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'domain',
		name: '域名',
		pattern: '[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?\\.[a-zA-Z]{2,}',
		description: '匹配域名',
		category: '网络',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'date-iso',
		name: 'ISO日期',
		pattern: '\\d{4}-\\d{2}-\\d{2}',
		description: '匹配YYYY-MM-DD格式的日期',
		category: '日期时间',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'date-cn',
		name: '中文日期',
		pattern: '\\d{4}年\\d{1,2}月\\d{1,2}日',
		description: '匹配中文格式日期',
		category: '日期时间',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'time-24h',
		name: '24小时时间',
		pattern: '([01]?\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?',
		description: '匹配24小时制时间格式',
		category: '日期时间',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'file-image',
		name: '图片文件',
		pattern: '[^\\s]+\\.(jpg|jpeg|png|gif|bmp|webp|svg)(?:\\?[^\\s]*)?',
		description: '匹配常见图片文件扩展名',
		category: '文件',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'file-document',
		name: '文档文件',
		pattern: '[^\\s]+\\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf)(?:\\?[^\\s]*)?',
		description: '匹配常见文档文件扩展名',
		category: '文件',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'file-media',
		name: '媒体文件',
		pattern: '[^\\s]+\\.(mp4|avi|mkv|mov|wmv|flv|mp3|wav|flac|aac|ogg)(?:\\?[^\\s]*)?',
		description: '匹配常见音视频文件扩展名',
		category: '文件',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'file-archive',
		name: '压缩文件',
		pattern: '[^\\s]+\\.(zip|rar|7z|tar|gz|bz2|xz)(?:\\?[^\\s]*)?',
		description: '匹配常见压缩文件扩展名',
		category: '文件',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'markdown-link',
		name: 'Markdown链接',
		pattern: '\\[([^\\]]+)\\]\\(([^\\)]+)\\)',
		description: '匹配Markdown格式的链接 [文本](链接)',
		category: 'Markdown',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'markdown-image',
		name: 'Markdown图片',
		pattern: '!\\[([^\\]]*)\\]\\(([^\\)]+)\\)',
		description: '匹配Markdown格式的图片 ![alt](url)',
		category: 'Markdown',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'markdown-heading',
		name: 'Markdown标题',
		pattern: '^#{1,6}\\s+.+$',
		description: '匹配Markdown标题（# ## ### 等）',
		category: 'Markdown',
		flags: 'gm',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'markdown-code-block',
		name: 'Markdown代码块',
		pattern: '```[\\s\\S]*?```',
		description: '匹配Markdown代码块',
		category: 'Markdown',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'number-decimal',
		name: '小数',
		pattern: '-?\\d+\\.\\d+',
		description: '匹配小数（包括负数）',
		category: '数字',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'number-integer',
		name: '整数',
		pattern: '-?\\d+',
		description: '匹配整数（包括负数）',
		category: '数字',
		flags: 'g',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	},
	{
		id: 'hex-color',
		name: '十六进制颜色',
		pattern: '#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})',
		description: '匹配十六进制颜色代码',
		category: '代码',
		flags: 'gi',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		usage: 0
	}
];
