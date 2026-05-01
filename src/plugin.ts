import { Notice, Plugin, TFile } from 'obsidian';
import { RegexLibraryItem, RegexSearchSettings, SearchMatch, SearchResult, ReplaceResult, VaultReplaceResult, SearchProgress } from './types';
import { RegexUtils, SearchHistory, SearchTask, SearchTimeoutError } from './utils';
import { PLUGIN_CONFIG, DEFAULT_SETTINGS, BUILT_IN_REGEX_LIBRARY } from './constants';
import { ConfirmModal, QuickSearchModal, RegexLibraryModal, RegexSearchModal } from './ui/search-modals';
import { RegexSearchSettingTab } from './ui/settings-tab';

export default class RegexSearchPlugin extends Plugin {
	settings: RegexSearchSettings;
	private searchHistory: SearchHistory;
	private currentSearchTask: SearchTask | null = null;

	async onload() {
		await this.loadSettings();
		this.searchHistory = new SearchHistory();
		
		// 初始化正则表达式库
		this.initializeRegexLibrary();
		
		// 恢复搜索历史
		if (this.settings.enableSearchHistory) {
			this.settings.searchHistory.forEach(pattern => {
				this.searchHistory.add(pattern);
			});
		}

		// 添加搜索命令
		this.addCommand({
			id: 'open-search',
			name: '打开正则表达式搜索',
			callback: () => {
				new RegexSearchModal(this.app, this).open();
			}
		});

		// 添加当前文件搜索命令
		this.addCommand({
			id: 'search-current-file',
			name: '在当前文件中搜索',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					new RegexSearchModal(this.app, this, activeFile).open();
				} else {
					new Notice('没有打开的文件');
				}
			}
		});

		// 添加快速搜索命令
		this.addCommand({
			id: 'quick-search',
			name: '快速正则表达式搜索',
			callback: () => {
				new QuickSearchModal(this.app, this).open();
			}
		});

		// 添加正则表达式库管理命令
		this.addCommand({
			id: 'manage-library',
			name: '管理正则表达式库',
			callback: () => {
				new RegexLibraryModal(this.app, this).open();
			}
		});

		// 添加重置内置库命令
		this.addCommand({
			id: 'reset-builtin-library',
			name: '重置内置正则表达式库',
			callback: () => {
				this.resetBuiltInRegexLibrary();
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new RegexSearchSettingTab(this.app, this));
	}

	onunload() {
		// 取消当前搜索任务
		if (this.currentSearchTask) {
			this.currentSearchTask.cancel();
		}
		
		// 保存搜索历史
		if (this.settings.enableSearchHistory) {
			this.settings.searchHistory = this.searchHistory.get();
			void this.saveSettings();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 正则表达式库管理方法
	private initializeRegexLibrary() {
		// 检查是否需要更新内置库
		const existingIds = new Set(this.settings.regexLibrary.map(item => item.id));
		const newBuiltInItems = BUILT_IN_REGEX_LIBRARY.filter(item => !existingIds.has(item.id));
		
		if (newBuiltInItems.length > 0 || this.settings.regexLibrary.length === 0) {
			// 添加新的内置项目或初始化库
			this.settings.regexLibrary.push(...newBuiltInItems);
			void this.saveSettings();
			
			if (newBuiltInItems.length > 0) {
				new Notice(`已添加 ${newBuiltInItems.length} 个新的内置正则表达式`);
			}
		}
	}

	resetBuiltInRegexLibrary() {
		new ConfirmModal(this.app, {
			title: '重置内置正则表达式库',
			message: '这将会重新添加所有最新的内置正则表达式，不会影响你自定义的内容。确定继续吗？',
			confirmText: '确定',
			cancelText: '取消'
		}, (confirmed) => {
			if (confirmed) {
				// 移除所有内置项目
				const builtInIds = new Set(BUILT_IN_REGEX_LIBRARY.map(item => item.id));
				this.settings.regexLibrary = this.settings.regexLibrary.filter(item => !builtInIds.has(item.id));
				
				// 重新添加最新的内置项目
				this.settings.regexLibrary.push(...BUILT_IN_REGEX_LIBRARY);
				void this.saveSettings();
				
				new Notice('内置正则表达式库已重置！');
			}
		}).open();
	}

	addToRegexLibrary(name: string, pattern: string, description: string, category: string = '自定义', flags: string = 'g'): boolean {
		try {
			// 验证正则表达式
			RegexUtils.validateRegex(pattern, flags);
			
			const newItem: RegexLibraryItem = {
			id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
				name: name.trim(),
				pattern: pattern.trim(),
				description: description.trim(),
				category: category.trim(),
				flags: flags,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				usage: 0
			};
			
			this.settings.regexLibrary.push(newItem);
			void this.saveSettings();
			return true;
		} catch (error) {
			new Notice('正则表达式无效：' + error.message);
			return false;
		}
	}

	updateRegexLibraryItem(id: string, updates: Partial<RegexLibraryItem>): boolean {
		const index = this.settings.regexLibrary.findIndex(item => item.id === id);
		if (index === -1) return false;

		// 如果更新了模式或标志，验证正则表达式
		if (updates.pattern || updates.flags) {
			try {
				const pattern = updates.pattern || this.settings.regexLibrary[index].pattern;
				const flags = updates.flags || this.settings.regexLibrary[index].flags;
				RegexUtils.validateRegex(pattern, flags);
			} catch (error) {
				new Notice('正则表达式无效：' + error.message);
				return false;
			}
		}

		this.settings.regexLibrary[index] = {
			...this.settings.regexLibrary[index],
			...updates,
			updatedAt: Date.now()
		};
		
		void this.saveSettings();
		return true;
	}

	removeFromRegexLibrary(id: string): boolean {
		const index = this.settings.regexLibrary.findIndex(item => item.id === id);
		if (index === -1) return false;

		this.settings.regexLibrary.splice(index, 1);
		void this.saveSettings();
		return true;
	}

	getRegexLibraryItem(id: string): RegexLibraryItem | null {
		return this.settings.regexLibrary.find(item => item.id === id) || null;
	}

	incrementRegexUsage(id: string) {
		const item = this.getRegexLibraryItem(id);
		if (item) {
			item.usage++;
			item.updatedAt = Date.now();
			void this.saveSettings();
		}
	}

	getRegexLibraryByCategory(): Record<string, RegexLibraryItem[]> {
		const categories: Record<string, RegexLibraryItem[]> = {};
		
		this.settings.regexLibrary.forEach(item => {
			if (!categories[item.category]) {
				categories[item.category] = [];
			}
			categories[item.category].push(item);
		});

		// 按使用频率排序每个分类
		Object.keys(categories).forEach(category => {
			categories[category].sort((a, b) => b.usage - a.usage);
		});

		return categories;
	}

	exportRegexLibrary(): string {
		return JSON.stringify(this.settings.regexLibrary, null, 2);
	}

	importRegexLibrary(jsonString: string): boolean {
		try {
			const imported = JSON.parse(jsonString) as RegexLibraryItem[];
			
			// 验证导入的数据
			if (!Array.isArray(imported)) {
				throw new Error('导入的数据格式不正确');
			}

			imported.forEach(item => {
				if (!item.id || !item.name || !item.pattern) {
					throw new Error('导入的正则表达式缺少必要字段');
				}
				// 验证正则表达式
				RegexUtils.validateRegex(item.pattern, item.flags || 'g');
			});

			// 合并到现有库中，跳过重复的ID
			const existingIds = new Set(this.settings.regexLibrary.map(item => item.id));
			const newItems = imported.filter(item => !existingIds.has(item.id));
			
			this.settings.regexLibrary.push(...newItems);
			void this.saveSettings();
			
			new Notice(`成功导入 ${newItems.length} 个正则表达式`);
			return true;
		} catch (error) {
			new Notice('导入失败：' + error.message);
			return false;
		}
	}

	// 优化的文件过滤器
	private filterFiles(files: TFile[]): TFile[] {
		const allowedExtensions = new Set(this.settings.fileExtensions);
		const excludePatterns = this.settings.excludePatterns;
		let excludeRegexes: RegExp[] = [];
		
		// 预编译排除模式的正则表达式
		if (excludePatterns.length > 0) {
			excludeRegexes = excludePatterns.map(pattern => {
				try {
					return new RegExp(pattern, 'i');
				} catch {
					return null;
				}
			}).filter((regex): regex is RegExp => regex !== null);
		}
		
		return files.filter(file => {
			// 快速检查文件扩展名
			if (!allowedExtensions.has(file.extension)) {
				return false;
			}
			
			// 检查隐藏文件和隐藏目录（路径中任意部分以 . 开头）
			if (!this.settings.includeHiddenFiles) {
				const pathParts = file.path.split('/');
				for (const part of pathParts) {
					if (part.charCodeAt(0) === 46) { // '.'的ASCII码
						return false;
					}
				}
			}
			
			// 检查文件大小（预过滤）
			if (file.stat && file.stat.size > PLUGIN_CONFIG.MAX_FILE_SIZE) {
				return false;
			}
			
			// 检查排除模式
			if (excludeRegexes.length > 0) {
				const filePath = file.path;
				for (const regex of excludeRegexes) {
					if (regex.test(filePath)) {
						return false;
					}
				}
			}
			
			return true;
		});
	}

	// 检查文件大小
	private async checkFileSize(file: TFile): Promise<boolean> {
		try {
			const stat = await this.app.vault.adapter.stat(file.path);
			return stat && stat.size <= PLUGIN_CONFIG.MAX_FILE_SIZE;
		} catch {
			return true; // 如果无法获取文件大小，仍然尝试处理
		}
	}

	// 核心搜索方法（改进版）
	async searchInFile(file: TFile, pattern: string, flags: string, signal?: AbortSignal): Promise<SearchResult> {
		const startTime = Date.now();
		
		try {
			// 检查文件大小
			const isFileSizeOk = await this.checkFileSize(file);
			if (!isFileSizeOk) {
				return {
					file: file,
					matches: [],
					totalMatches: 0,
					searchTime: Date.now() - startTime,
					error: '文件过大，跳过搜索'
				};
			}
			
			// 检查是否取消
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			const content = await this.app.vault.read(file);
			const regex = RegexUtils.validateRegex(pattern, flags);
			const matches: SearchMatch[] = [];
			
			// 检查是否取消
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			await this.performSearch(content, regex, file, matches, signal);
			
			return {
				file: file,
				matches: matches,
				totalMatches: matches.length,
				searchTime: Date.now() - startTime
			};
		} catch (error) {
			return {
				file: file,
				matches: [],
				totalMatches: 0,
				searchTime: Date.now() - startTime,
				error: error.message
			};
		}
	}

	// 优化的搜索核心逻辑
	private async performSearch(content: string, regex: RegExp, file: TFile, matches: SearchMatch[], signal?: AbortSignal): Promise<void> {
		const maxResults = Math.min(this.settings.maxResultsPerFile, PLUGIN_CONFIG.MAX_RESULTS_PER_FILE);
		
		// 预检查：如果内容太短或为空，快速返回
		if (!content || content.length < 1) {
			return;
		}
		
		// 判断是否需要全文搜索
		const needsFullTextSearch = this.needsFullTextSearch(regex);
		
		if (needsFullTextSearch) {
			await this.performOptimizedFullTextSearch(content, regex, file, matches, maxResults, signal);
		} else {
			await this.performOptimizedLineSearch(content, regex, file, matches, maxResults, signal);
		}
	}

	private async performOptimizedLineSearch(content: string, regex: RegExp, file: TFile, matches: SearchMatch[], maxResults: number, signal?: AbortSignal): Promise<void> {
		const lines = content.split('\n');
		let processedLines = 0;
		
		for (let lineIndex = 0; lineIndex < lines.length && matches.length < maxResults; lineIndex++) {
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			const line = lines[lineIndex];
			
			// 快速预检查：如果行很短且不可能匹配，跳过
			if (line.length === 0) {
				continue;
			}
			
			regex.lastIndex = 0;
			let match: RegExpMatchArray | null;
			
			while ((match = regex.exec(line)) !== null && matches.length < maxResults) {
				// 延迟计算上下文，只在需要时计算
				const context = this.getOptimizedContext(lines, lineIndex);
				
				matches.push({
					file: file,
					line: lineIndex + 1,
					column: match.index + 1,
					match: match[0],
					context: context,
					lineText: line,
					matchId: `${file.path}-${lineIndex + 1}-${match.index + 1}`
				});
				
				if (!regex.global) {
					break;
				}
			}
			
			// 定期让出控制权，但频率降低
			processedLines++;
			if (processedLines % 200 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	}

	private async performOptimizedFullTextSearch(content: string, regex: RegExp, file: TFile, matches: SearchMatch[], maxResults: number, signal?: AbortSignal): Promise<void> {
		const lines = content.split('\n');
		let match: RegExpMatchArray | null;
		let matchCount = 0;
		
		regex.lastIndex = 0;
		
		while ((match = regex.exec(content)) !== null && matches.length < maxResults) {
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			const beforeMatch = content.substring(0, match.index);
			const lineNumber = beforeMatch.split('\n').length;
			const lineStart = beforeMatch.lastIndexOf('\n') + 1;
			const columnNumber = match.index - lineStart + 1;
			
			// 延迟计算上下文和行文本
			const context = this.getOptimizedContext(lines, lineNumber - 1);
			const lineText = lines[lineNumber - 1] || '';
			
			matches.push({
				file: file,
				line: lineNumber,
				column: columnNumber,
				match: match[0],
				context: context,
				lineText: lineText,
				matchId: `${file.path}-${lineNumber}-${columnNumber}`
			});
			
			if (!regex.flags.includes('g')) {
				break;
			}
			
			// 更少的让出控制权
			matchCount++;
			if (matchCount % 50 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	}

	private getOptimizedContext(lines: string[], lineIndex: number): string {
		const contextRange = Math.floor(PLUGIN_CONFIG.MAX_CONTEXT_LINES / 2);
		const startIndex = Math.max(0, lineIndex - contextRange);
		const endIndex = Math.min(lines.length - 1, lineIndex + contextRange);
		
		// 直接使用slice而不是循环，更高效
		return lines.slice(startIndex, endIndex + 1).join('\n');
	}

	private needsFullTextSearch(regex: RegExp): boolean {
		const pattern = regex.source;
		const flags = regex.flags;
		
		return flags.includes('m') || 
			/\\[1-9]/.test(pattern) ||
			pattern.includes('\\n') || 
			pattern.includes('\\r') ||
			(pattern.includes('\\s') && (pattern.includes('.*') || pattern.includes('.+'))) ||
			pattern.includes('.*') || 
			pattern.includes('.+');
	}



	// 支持实时结果回调的搜索方法
	async searchInVaultWithLiveResults(
		pattern: string, 
		flags: string, 
		progressCallback?: (progress: SearchProgress) => void,
		resultCallback?: (result: SearchResult) => void
	): Promise<void> {
		// 取消之前的搜索任务
		if (this.currentSearchTask) {
			this.currentSearchTask.cancel();
		}
		
		this.currentSearchTask = new SearchTask();
		const signal = this.currentSearchTask.signal;
		
		try {
			const files = this.app.vault.getFiles();
			const filteredFiles = this.filterFiles(files);
			
			if (filteredFiles.length === 0) {
				return;
			}
			
			// 启动超时计时器
			this.currentSearchTask.startTimeout();
			
			// 执行搜索
			await this.performVaultSearchWithLiveResults(
				filteredFiles, pattern, flags, progressCallback, resultCallback, signal
			);
			
			this.currentSearchTask.complete();
			
			// 添加到搜索历史
			if (this.settings.enableSearchHistory) {
				this.searchHistory.add(pattern);
			}
			
		} catch (error) {
			if (error instanceof SearchTimeoutError) {
				new Notice('搜索超时，请尝试更具体的搜索条件');
			}
			throw error;
		} finally {
			this.currentSearchTask = null;
		}
	}

	private async performVaultSearchWithLiveResults(
		files: TFile[], 
		pattern: string, 
		flags: string, 
		progressCallback?: (progress: SearchProgress) => void,
		resultCallback?: (result: SearchResult) => void,
		signal?: AbortSignal
	): Promise<void> {
		const batchSize = PLUGIN_CONFIG.SEARCH_BATCH_SIZE;
		const maxResults = PLUGIN_CONFIG.MAX_SEARCH_RESULTS;
		let totalMatches = 0;
		
		// 按文件大小排序，优先搜索小文件（通常更快）
		const sortedFiles = files.sort((a, b) => {
			const sizeA = a.stat?.size || 0;
			const sizeB = b.stat?.size || 0;
			return sizeA - sizeB;
		});
		
		for (let i = 0; i < sortedFiles.length; i += batchSize) {
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			// 早期终止：如果已经找到足够多的结果
			if (totalMatches >= maxResults) {
				break;
			}
			
			const batch = sortedFiles.slice(i, i + batchSize);
			
			// 并行处理当前批次
			const batchPromises = batch.map(file => this.searchInFile(file, pattern, flags, signal));
			const batchResults = await Promise.allSettled(batchPromises);
			
			// 处理批次结果并实时回调
			for (const settledResult of batchResults) {
				if (settledResult.status === 'fulfilled') {
					const result = settledResult.value;
					if (result.matches.length > 0) {
						totalMatches += result.matches.length;
						
						// 实时回调结果
						if (resultCallback) {
							resultCallback(result);
						}
						
						// 达到限制时停止
						if (totalMatches >= maxResults) {
							break;
						}
					}
				}
			}
			
			// 更新进度
			if (progressCallback) {
				progressCallback({
					current: i + batch.length,
					total: sortedFiles.length,
					currentFile: batch[batch.length - 1]?.name,
					isComplete: i + batch.length >= sortedFiles.length || totalMatches >= maxResults
				});
			}
			
			// 减少UI阻塞
			if (i % (batchSize * 2) === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	}

	// 跨文件搜索方法（优化版本）
	async searchInVault(pattern: string, flags: string, progressCallback?: (progress: SearchProgress) => void): Promise<SearchResult[]> {
		// 取消之前的搜索任务
		if (this.currentSearchTask) {
			this.currentSearchTask.cancel();
		}
		
		this.currentSearchTask = new SearchTask();
		const signal = this.currentSearchTask.signal;
		
		try {
			const files = this.app.vault.getFiles();
			const filteredFiles = this.filterFiles(files);
			const results: SearchResult[] = [];
			
		if (filteredFiles.length === 0) {
				return results;
			}
			
			// 启动超时计时器
			this.currentSearchTask.startTimeout();
			
			// 执行搜索
			await this.performVaultSearch(filteredFiles, pattern, flags, results, progressCallback, signal);
			
			this.currentSearchTask.complete();
			
			// 添加到搜索历史
			if (this.settings.enableSearchHistory) {
				this.searchHistory.add(pattern);
			}
			
			return results;
		} catch (error) {
			if (error instanceof SearchTimeoutError) {
				new Notice('搜索超时，请尝试更具体的搜索条件');
			}
			throw error;
		} finally {
			this.currentSearchTask = null;
		}
	}

	private async performVaultSearch(files: TFile[], pattern: string, flags: string, results: SearchResult[], progressCallback?: (progress: SearchProgress) => void, signal?: AbortSignal): Promise<void> {
		const batchSize = PLUGIN_CONFIG.SEARCH_BATCH_SIZE;
		const maxResults = PLUGIN_CONFIG.MAX_SEARCH_RESULTS;
		let totalMatches = 0;
		
		// 按文件大小排序，优先搜索小文件（通常更快）
		const sortedFiles = files.sort((a, b) => {
			const sizeA = a.stat?.size || 0;
			const sizeB = b.stat?.size || 0;
			return sizeA - sizeB;
		});
		
		for (let i = 0; i < sortedFiles.length; i += batchSize) {
			if (signal?.aborted) {
				throw new Error('搜索已取消');
			}
			
			// 早期终止：如果已经找到足够多的结果
			if (totalMatches >= maxResults) {
				break;
			}
			
			const batch = sortedFiles.slice(i, i + batchSize);
			
			// 并行处理当前批次，但限制并发数
			const batchPromises = batch.map(file => this.searchInFile(file, pattern, flags, signal));
			const batchResults = await Promise.allSettled(batchPromises);
			
			// 处理批次结果
			for (const settledResult of batchResults) {
				if (settledResult.status === 'fulfilled') {
					const result = settledResult.value;
					if (result.matches.length > 0) {
						results.push(result);
						totalMatches += result.matches.length;
						
						// 达到限制时停止
						if (totalMatches >= maxResults) {
							break;
						}
					}
				}
			}
			
			// 更新进度
			if (progressCallback) {
				progressCallback({
					current: i + batch.length,
					total: sortedFiles.length,
					currentFile: batch[batch.length - 1]?.name,
					isComplete: i + batch.length >= sortedFiles.length || totalMatches >= maxResults
				});
			}
			
			// 减少UI阻塞
			if (i % (batchSize * 2) === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
	}

	// 构建正则表达式标志
	buildRegexFlags(): string {
		let flags = '';
		if (!this.settings.caseSensitive) flags += 'i';
		if (this.settings.multiline) flags += 'm';
		flags += 'g'; // 总是使用全局搜索
		return flags;
	}

	// 单文件替换方法（改进版）
	async replaceInFile(file: TFile, pattern: string, replacement: string, flags: string, signal?: AbortSignal): Promise<ReplaceResult> {
		try {
			if (signal?.aborted) {
				throw new Error('替换已取消');
			}
			
			const originalContent = await this.app.vault.read(file);
			const regex = RegexUtils.validateRegex(pattern, flags);
			
			// 计算替换次数
			const matches = originalContent.match(regex);
			const replacedCount = matches ? matches.length : 0;
			
			if (replacedCount === 0) {
				return {
					file: file,
					replacedCount: 0,
					originalContent: originalContent,
					newContent: originalContent
				};
			}
			
			// 执行替换
			const newContent = originalContent.replace(regex, replacement);
			
			// 保存文件
			if (newContent !== originalContent) {
				await this.app.vault.modify(file, newContent);
			}
			
			return {
				file: file,
				replacedCount: replacedCount,
				originalContent: originalContent,
				newContent: newContent
			};
		} catch (error) {
			return {
				file: file,
				replacedCount: 0,
				originalContent: '',
				newContent: '',
				error: error.message
			};
		}
	}

	// 跨文件替换方法（优化版本）
	async replaceInVault(pattern: string, replacement: string, flags: string, progressCallback?: (progress: SearchProgress) => void): Promise<VaultReplaceResult> {
		const startTime = Date.now();
		
		// 取消之前的搜索任务
		if (this.currentSearchTask) {
			this.currentSearchTask.cancel();
		}
		
		this.currentSearchTask = new SearchTask();
		const signal = this.currentSearchTask.signal;
		
		try {
			const files = this.app.vault.getFiles();
			const filteredFiles = this.filterFiles(files);
			const results: ReplaceResult[] = [];
			const errors: string[] = [];
			let totalReplacements = 0;
			let filesModified = 0;
			
			if (filteredFiles.length === 0) {
				return {
					totalReplacements: 0,
					filesModified: 0,
					results: [],
					errors: [],
					processingTime: Date.now() - startTime
				};
			}
			
		// 启动超时计时器
			this.currentSearchTask.startTimeout();
			
			// 执行替换
			await this.performVaultReplace(filteredFiles, pattern, replacement, flags, results, errors, progressCallback, signal);
			
			this.currentSearchTask.complete();
			
			// 统计结果
			for (const result of results) {
				if (result.replacedCount > 0) {
					totalReplacements += result.replacedCount;
					filesModified++;
				}
			}
			
			return {
				totalReplacements: totalReplacements,
				filesModified: filesModified,
				results: results,
				errors: errors,
				processingTime: Date.now() - startTime
			};
		} catch (error) {
			if (error instanceof SearchTimeoutError) {
				new Notice('替换超时，请尝试更具体的搜索条件');
			}
			throw error;
		} finally {
			this.currentSearchTask = null;
		}
	}

	private async performVaultReplace(files: TFile[], pattern: string, replacement: string, flags: string, results: ReplaceResult[], errors: string[], progressCallback?: (progress: SearchProgress) => void, signal?: AbortSignal): Promise<void> {
		const batchSize = PLUGIN_CONFIG.BATCH_SIZE;
		
		for (let i = 0; i < files.length; i += batchSize) {
			if (signal?.aborted) {
				throw new Error('替换已取消');
			}
			
			const batch = files.slice(i, i + batchSize);
			
			// 串行处理替换操作（避免同时修改过多文件）
			for (const file of batch) {
				try {
					const result = await this.replaceInFile(file, pattern, replacement, flags, signal);
					if (result.error) {
						errors.push(`${file.path}: ${result.error}`);
					} else {
						results.push(result);
					}
				} catch (error) {
					errors.push(`${file.path}: ${error.message}`);
				}
			}
			
			// 更新进度
			if (progressCallback) {
				progressCallback({
					current: i + batch.length,
					total: files.length,
					currentFile: batch[batch.length - 1]?.name,
					isComplete: i + batch.length >= files.length
				});
			}
			
			// 让出控制权给 UI
			await new Promise(resolve => setTimeout(resolve, 0));
		}
	}

	// 取消当前搜索
	cancelCurrentSearch() {
		if (this.currentSearchTask) {
			this.currentSearchTask.cancel();
			this.currentSearchTask = null;
		}
	}

	// 获取搜索历史
	getSearchHistory(): string[] {
		return this.searchHistory.get();
	}

	// 清空搜索历史
	clearSearchHistory() {
		this.searchHistory.clear();
		this.settings.searchHistory = [];
		void this.saveSettings();
	}
}

// 快速搜索模态框
