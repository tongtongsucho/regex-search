import { App, Editor, MarkdownView, Menu, Modal, Notice, TFile, debounce } from 'obsidian';
import type RegexSearchPlugin from '../plugin';
import { RegexLibraryItem, SearchMatch, SearchResult, SearchState } from '../types';
import { RegexUtils, RegexValidationError } from '../utils';
import { PLUGIN_CONFIG, STATE_TRANSITIONS } from '../constants';

export class QuickSearchModal extends Modal {
	plugin: RegexSearchPlugin;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private currentResults: SearchResult[] = [];

	constructor(app: App, plugin: RegexSearchPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quick-search-modal');

		// 创建搜索输入
		const searchContainer = contentEl.createDiv('quick-search-container');
		searchContainer.createEl('h3', { text: '🔍 快速搜索' });
		
		this.searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: '输入搜索内容...',
			cls: 'quick-search-input'
		});
		
		// 创建结果容器
		this.resultsContainer = contentEl.createDiv('quick-search-results');
		
		// 绑定搜索事件
		const debouncedSearch = debounce(this.performQuickSearch.bind(this), PLUGIN_CONFIG.DEBOUNCE_DELAY);
		this.searchInput.addEventListener('input', debouncedSearch);
		
		// 绑定键盘事件
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.close();
			} else if (e.key === 'Enter') {
				this.openFullSearch();
			}
		});
		
		this.searchInput.focus();
	}

	private async performQuickSearch() {
		const query = this.searchInput.value.trim();
		if (query.length < PLUGIN_CONFIG.MIN_SEARCH_LENGTH) {
			this.resultsContainer.empty();
			return;
		}
		
		try {
			// 转义特殊字符进行字面量搜索
			const escapedQuery = RegexUtils.escapeRegex(query);
			const flags = this.plugin.buildRegexFlags();
			
			// 只搜索前10个匹配的文件
			const files = this.plugin.app.vault.getFiles().slice(0, 10);
			const results: SearchResult[] = [];
			
			for (const file of files) {
				const result = await this.plugin.searchInFile(file, escapedQuery, flags);
				if (result.matches.length > 0) {
					results.push(result);
				}
			}
			
			this.displayQuickResults(results);
		} catch (error) {
			console.error('Quick search error:', error);
		}
	}

	private displayQuickResults(results: SearchResult[]) {
		this.resultsContainer.empty();
		this.currentResults = results;
		
		if (results.length === 0) {
			this.resultsContainer.createEl('div', { text: '未找到匹配项', cls: 'quick-search-no-results' });
			return;
		}
		
		results.forEach(result => {
			const fileEl = this.resultsContainer.createDiv('quick-search-file');
			fileEl.createEl('div', { text: result.file.name, cls: 'quick-search-filename' });
			
			result.matches.slice(0, 3).forEach(match => {
				const matchEl = fileEl.createDiv('quick-search-match');
				matchEl.createEl('span', { text: `第${match.line}行: `, cls: 'quick-search-line' });
				matchEl.createEl('span', { text: match.lineText, cls: 'quick-search-text' });
				
				matchEl.addEventListener('click', () => {
					void this.jumpToMatch(match);
				});
			});
		});
	}

	private async jumpToMatch(match: SearchMatch) {
		this.close();
		
		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(match.file);
		
		setTimeout(() => {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.editor) {
				const editor = activeView.editor;
				const line = match.line - 1;
				const column = match.column - 1;
				
				editor.setCursor(line, column);
				editor.scrollIntoView({
					from: { line: line, ch: 0 },
					to: { line: line, ch: editor.getLine(line).length }
				}, true);
			}
		}, 100);
	}

	private openFullSearch() {
		this.close();
		new RegexSearchModal(this.app, this.plugin).open();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 主搜索模态框
export class RegexSearchModal extends Modal {
	plugin: RegexSearchPlugin;
	currentFile: TFile | null;
	searchResults: SearchResult[] = [];
	private patternInput: HTMLInputElement;
	private replaceInput: HTMLInputElement;
	private currentState: SearchState = SearchState.Idle;
	private progressEl: HTMLElement;
	private prefilledItem: RegexLibraryItem | null;

	constructor(app: App, plugin: RegexSearchPlugin, currentFile?: TFile, prefilledItem?: RegexLibraryItem) {
		super(app);
		this.plugin = plugin;
		this.currentFile = currentFile || null;
		this.prefilledItem = prefilledItem || null;
	}

	// 状态管理方法
	private canTransitionTo(newState: SearchState): boolean {
		// 修复：使用 some() 遍历所有规则，而不是 find() 只取第一个
		return Object.values(STATE_TRANSITIONS).some(
			t => t.to === newState && t.from.includes(this.currentState)
		);
	}

	private transitionToState(newState: SearchState, action?: string): boolean {
		if (this.canTransitionTo(newState)) {
			const previousState = this.currentState;
			this.currentState = newState;
			this.onStateChanged(previousState, newState, action);
			return true;
		}
		console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
		return false;
	}

	private onStateChanged(from: SearchState, to: SearchState, action?: string) {
		// 记录状态转换日志
		this.logStateTransition(from, to, action);
		
		// 状态变化时的回调，用于更新UI
		this.updateButtonStates();
		
		// 根据状态变化执行特定的逻辑
		switch (to) {
			case SearchState.Idle:
				this.hideProgress();
				break;
			case SearchState.Searching:
				this.showProgress('搜索中...');
				break;
			case SearchState.Replacing:
				this.showProgress('替换中...');
				break;
			case SearchState.Cancelled:
				this.hideProgress();
				new Notice('操作已取消');
				// 自动回到空闲状态
				setTimeout(() => this.transitionToState(SearchState.Idle), 1000);
				break;
			case SearchState.Error:
				this.hideProgress();
				// 自动回到空闲状态
				setTimeout(() => this.transitionToState(SearchState.Idle), 2000);
				break;
		}
	}

	// 状态调试和监控方法
	private logStateTransition(from: SearchState, to: SearchState, action?: string) {
		if (this.plugin.settings.enableDebugLogging) {
			console.debug(`🔄 状态转换: ${from} -> ${to}${action ? ` (${action})` : ''}`);
		}
	}

	private getStateDisplayName(state: SearchState): string {
		const stateNames = {
			[SearchState.Idle]: '空闲',
			[SearchState.Searching]: '搜索中',
			[SearchState.Replacing]: '替换中',
			[SearchState.Cancelled]: '已取消',
			[SearchState.Error]: '错误'
		};
		return stateNames[state] || state;
	}

	// 获取当前状态信息（用于调试）
	public getCurrentStateInfo(): { state: SearchState; displayName: string; canSearch: boolean; canReplace: boolean } {
		return {
			state: this.currentState,
			displayName: this.getStateDisplayName(this.currentState),
			canSearch: this.isIdle(),
			canReplace: this.isIdle()
		};
	}

	// 设置搜索模式（用于从正则库填入）
	public setPattern(pattern: string) {
		if (this.patternInput) {
			this.patternInput.value = pattern;
			this.patternInput.focus();
		}
	}

	// 便捷的状态检查方法
	private isIdle(): boolean { return this.currentState === SearchState.Idle; }
	private isSearching(): boolean { return this.currentState === SearchState.Searching; }
	private isReplacing(): boolean { return this.currentState === SearchState.Replacing; }
	private isOperating(): boolean { return this.isSearching() || this.isReplacing(); }

	// 添加实时正则表达式验证
	private addPatternValidation() {
		const validatePattern = debounce(() => {
			const pattern = RegexUtils.sanitizeInput(this.patternInput.value);
			if (!pattern) {
				this.patternInput.removeClass('regex-pattern-error');
				this.patternInput.removeClass('regex-pattern-valid');
				return;
			}

			try {
				// 构建当前标志
				let flags = 'g';
			const caseSensitiveToggle = this.containerEl.querySelector<HTMLInputElement>('.regex-options-container input:nth-of-type(1)');
			const multilineToggle = this.containerEl.querySelector<HTMLInputElement>('.regex-options-container input:nth-of-type(2)');
				
				if (caseSensitiveToggle && !caseSensitiveToggle.checked) {
					flags += 'i';
				}
				if (multilineToggle && multilineToggle.checked) {
					flags += 'm';
				}
				
				RegexUtils.validateRegex(pattern, flags);
				this.patternInput.removeClass('regex-pattern-error');
				this.patternInput.addClass('regex-pattern-valid');
			} catch {
				this.patternInput.removeClass('regex-pattern-valid');
				this.patternInput.addClass('regex-pattern-error');
			}
		}, 300);

		this.patternInput.addEventListener('input', validatePattern);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('regex-search-modal');
		
		// 创建标题
		contentEl.createEl('h2', { 
			text: this.currentFile ? `🔍 在 ${this.currentFile.name} 中搜索` : '🎯 正则表达式搜索',
			cls: 'regex-search-title'
		});

		// 创建搜索表单
		const searchContainer = contentEl.createDiv('regex-search-container');
		
		// 正则表达式输入
		const patternContainer = searchContainer.createDiv('regex-pattern-container');
		patternContainer.createEl('label', { text: '⚡ 正则表达式：' });
		
		this.patternInput = patternContainer.createEl('input', { 
			type: 'text',
			placeholder: '输入正则表达式...',
			value: this.prefilledItem?.pattern || this.plugin.settings.defaultPattern,
			cls: 'regex-pattern-input'
		});
		
		this.patternInput.focus();

		// 添加实时验证
		this.addPatternValidation();

		// 添加搜索历史和库选择按钮
		const quickAccessContainer = searchContainer.createDiv('regex-quick-access');
		
		if (this.plugin.settings.enableSearchHistory) {
			this.createHistoryDropdown(quickAccessContainer);
		}
		
		if (this.plugin.settings.enableRegexLibrary) {
			this.createLibrarySelector(quickAccessContainer);
		}

		// 替换输入框
		const replaceContainer = searchContainer.createDiv('regex-replace-container');
		replaceContainer.createEl('label', { text: '✨ 替换为：' });
		this.replaceInput = replaceContainer.createEl('input', { 
			type: 'text',
			placeholder: '输入替换内容...',
			value: '',
			cls: 'regex-replace-input'
		});

		// 搜索选项
		const optionsContainer = searchContainer.createDiv('regex-options-container');
		
		const caseSensitiveToggle = this.createToggle(optionsContainer, '🔤 区分大小写', this.plugin.settings.caseSensitive);
		const multilineToggle = this.createToggle(optionsContainer, '📝 多行模式', this.plugin.settings.multiline);

		// 进度指示器
		this.progressEl = searchContainer.createDiv('regex-progress');

		// 按钮容器
		const buttonContainer = searchContainer.createDiv('regex-button-container');
		const searchButton = buttonContainer.createEl('button', { text: '🔍 搜索', cls: 'regex-search-button' });
		const replaceButton = buttonContainer.createEl('button', { text: '🔄 替换', cls: 'regex-replace-button' });
		const cancelButton = buttonContainer.createEl('button', { text: '❌ 取消', cls: 'regex-cancel-button' });
		const clearButton = buttonContainer.createEl('button', { text: '🧹 清空结果', cls: 'regex-clear-button' });

		// 结果容器
		const resultsContainer = contentEl.createDiv('regex-results-container');

		// 绑定事件
		this.bindEvents(searchButton, replaceButton, cancelButton, clearButton, resultsContainer, caseSensitiveToggle, multilineToggle);
	}

	private createHistoryDropdown(container: HTMLElement) {
		const historyButton = container.createEl('button', { text: '📚 历史', cls: 'regex-history-button' });
		historyButton.addEventListener('click', () => {
			this.showHistoryMenu(historyButton);
		});
	}

	private showHistoryMenu(button: HTMLElement) {
		const history = this.plugin.getSearchHistory();
		if (history.length === 0) {
			new Notice('没有搜索历史');
			return;
		}

		const menu = new Menu();
		history.forEach(pattern => {
			menu.addItem((item) => {
				item.setTitle(pattern);
				item.onClick(() => {
					this.patternInput.value = pattern;
					this.patternInput.focus();
				});
			});
		});

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle('清空历史');
			item.onClick(() => {
				this.plugin.clearSearchHistory();
				new Notice('搜索历史已清空');
			});
		});

		const rect = button.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}

	private createLibrarySelector(container: HTMLElement) {
		const libraryButton = container.createEl('button', { text: '📚 正则库', cls: 'regex-library-button' });
		libraryButton.addEventListener('click', () => {
			// 直接打开管理页面，传入当前搜索模态框的引用
			new RegexLibraryModal(this.app, this.plugin, this).open();
		});
	}



	private createToggle(container: HTMLElement, label: string, defaultValue: boolean): HTMLInputElement {
		const toggleContainer = container.createDiv('regex-toggle-container');
		const checkbox = toggleContainer.createEl('input', { type: 'checkbox' });
		checkbox.checked = defaultValue;
		toggleContainer.createEl('label', { text: label });
		return checkbox;
	}

	private bindEvents(searchButton: HTMLButtonElement, replaceButton: HTMLButtonElement, cancelButton: HTMLButtonElement, clearButton: HTMLButtonElement, resultsContainer: HTMLElement, caseSensitiveToggle: HTMLInputElement, multilineToggle: HTMLInputElement) {
		// 优化的搜索函数 - 支持实时结果显示
		const performSearch = async () => {
			if (!this.isIdle()) return;
			
			const pattern = RegexUtils.sanitizeInput(this.patternInput.value);
			if (!pattern) {
				new Notice('请输入正则表达式');
				return;
			}

			try {
				// 构建标志
				let flags = '';
				if (!caseSensitiveToggle.checked) flags += 'i';
				if (multilineToggle.checked) flags += 'm';
				flags += 'g';

				// 首先验证正则表达式（在状态转换之前）
				RegexUtils.validateRegex(pattern, flags);
				
				// 验证成功后才转换状态
				this.transitionToState(SearchState.Searching);

				// 清空结果容器并准备实时显示
				resultsContainer.empty();
				resultsContainer.classList.add('has-content');
				this.containerEl.classList.add('has-results');

				// 创建实时结果显示结构
				const liveStatsEl = resultsContainer.createEl('div', { cls: 'regex-live-stats' });
				const liveResultsEl = resultsContainer.createEl('div', { cls: 'regex-live-results' });
				
				let totalMatches = 0;
				let filesProcessed = 0;
				const displayedResults: SearchResult[] = [];

				if (this.currentFile) {
					// 单文件搜索
					liveStatsEl.textContent = '搜索中...';
					const result = await this.plugin.searchInFile(this.currentFile, pattern, flags);
					
					if (result.matches.length > 0) {
						displayedResults.push(result);
						totalMatches = result.totalMatches;
						// 显示单文件结果
						this.renderSingleResult(result, liveResultsEl);
					}
					
					liveStatsEl.textContent = totalMatches > 0 
						? `找到 ${totalMatches} 个匹配项` 
						: '未找到匹配项';
				} else {
					// 多文件搜索 - 实时显示结果
					liveStatsEl.textContent = '正在搜索...';
					
					await this.plugin.searchInVaultWithLiveResults(pattern, flags, 
						// 进度回调
						(progress) => {
							this.updateProgress(`搜索中... (${progress.current}/${progress.total})`);
							liveStatsEl.textContent = `已搜索 ${progress.current}/${progress.total} 个文件，找到 ${totalMatches} 个匹配项`;
						},
						// 结果回调 - 实时显示新结果
						(result) => {
							if (result.matches.length > 0) {
								displayedResults.push(result);
								totalMatches += result.totalMatches;
								filesProcessed++;
								
								// 实时添加到界面
								this.renderSingleResult(result, liveResultsEl);
								
								// 更新统计
								liveStatsEl.textContent = `找到 ${totalMatches} 个匹配项，分布在 ${filesProcessed} 个文件中`;
							}
						}
					);
				}

				// 搜索完成后，如果没有结果显示提示
				if (displayedResults.length === 0) {
					liveResultsEl.createEl('div', { text: '未找到匹配项', cls: 'regex-no-results' });
				}

				this.searchResults = displayedResults;
				this.transitionToState(SearchState.Idle);
			} catch (error) {
				// 如果在验证阶段失败，状态仍然是Idle，不需要转换状态
				if (error instanceof RegexValidationError) {
					new Notice(error.message);
				} else if (this.isOperating()) {
					// 只有在操作过程中的错误才需要转换到错误状态
					new Notice('搜索出错：' + error.message);
					this.transitionToState(SearchState.Error);
				} else {
					// 其他情况直接显示错误消息
					new Notice('搜索出错：' + error.message);
				}
			}
		};

		// 替换函数
		const performReplace = async () => {
			if (!this.isIdle()) return;

			const pattern = RegexUtils.sanitizeInput(this.patternInput.value);
			const replacement = RegexUtils.processEscapeSequences(this.replaceInput.value);
			
			if (!pattern) {
				new Notice('请输入正则表达式');
				return;
			}

			try {
				// 构建标志
				let flags = '';
				if (!caseSensitiveToggle.checked) flags += 'i';
				if (multilineToggle.checked) flags += 'm';
				flags += 'g';

				// 首先验证正则表达式（在状态转换之前）
				RegexUtils.validateRegex(pattern, flags);

				// 确认替换（验证成功后再确认）
				if (this.plugin.settings.confirmReplace && !this.currentFile) {
					const confirmed = await this.confirmReplace(pattern, replacement);
					if (!confirmed) return;
				}
				
				// 验证和确认成功后才转换状态
				this.transitionToState(SearchState.Replacing);

				// 执行替换
				resultsContainer.empty();

				let totalReplacements = 0;
				let filesModified = 0;

				if (this.currentFile) {
					const result = await this.plugin.replaceInFile(this.currentFile, pattern, replacement, flags);
					totalReplacements = result.replacedCount;
					filesModified = result.replacedCount > 0 ? 1 : 0;
				} else {
					const result = await this.plugin.replaceInVault(pattern, replacement, flags, (progress) => {
						this.updateProgress(`替换中... (${progress.current}/${progress.total})`);
					});
					totalReplacements = result.totalReplacements;
					filesModified = result.filesModified;
				}

				this.displayReplaceResults(totalReplacements, filesModified, resultsContainer);
				this.transitionToState(SearchState.Idle);

			} catch (error) {
				// 如果在验证阶段失败，状态仍然是Idle，不需要转换状态
				if (error instanceof RegexValidationError) {
					new Notice(error.message);
				} else if (this.isOperating()) {
					// 只有在操作过程中的错误才需要转换到错误状态
					new Notice('替换出错：' + error.message);
					this.transitionToState(SearchState.Error);
				} else {
					// 其他情况直接显示错误消息
					new Notice('替换出错：' + error.message);
				}
			}
		};

		// 取消函数
		const cancelSearch = () => {
			this.plugin.cancelCurrentSearch();
			this.transitionToState(SearchState.Cancelled);
		};

		// 清空结果
		const clearResults = () => {
			resultsContainer.empty();
			resultsContainer.classList.remove('has-content');
			// 恢复为小尺寸
			this.containerEl.classList.remove('has-results');
			this.searchResults = [];
		};

		// 绑定事件
		searchButton.addEventListener('click', () => {
			void performSearch();
		});
		replaceButton.addEventListener('click', () => {
			void performReplace();
		});
		cancelButton.addEventListener('click', cancelSearch);
		clearButton.addEventListener('click', clearResults);

		// 键盘事件
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				if (e.ctrlKey || e.metaKey) {
					e.preventDefault();
					void performReplace();
				} else {
					e.preventDefault();
					void performSearch();
				}
			} else if (e.key === 'Escape') {
				if (this.isOperating()) {
					cancelSearch();
				} else {
					this.close();
				}
			}
		};
		
		this.patternInput.addEventListener('keydown', handleKeydown);
		this.replaceInput.addEventListener('keydown', handleKeydown);
	}

	private updateButtonStates() {
		const searchButton = this.containerEl.querySelector<HTMLButtonElement>('.regex-search-button');
		const replaceButton = this.containerEl.querySelector<HTMLButtonElement>('.regex-replace-button');
		const cancelButton = this.containerEl.querySelector<HTMLButtonElement>('.regex-cancel-button');
		
		const isOperating = this.isOperating();
		if (searchButton) searchButton.disabled = isOperating;
		if (replaceButton) replaceButton.disabled = isOperating;
		if (cancelButton) {
			cancelButton.toggleClass('regex-button-visible', isOperating);
		}
	}

	private showProgress(message: string) {
		this.progressEl.textContent = message;
		this.progressEl.addClass('regex-progress-visible');
	}

	private updateProgress(message: string) {
		this.progressEl.textContent = message;
	}

	private hideProgress() {
		this.progressEl.removeClass('regex-progress-visible');
	}

	private async confirmReplace(pattern: string, replacement: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(this.app, {
				title: '确认替换',
				message: `确定要在整个库中执行替换操作吗？\n\n模式：${pattern}\n替换为：${replacement}`,
				confirmText: '确定',
				cancelText: '取消'
			}, resolve);
			modal.open();
		});
	}

	private displayReplaceResults(totalReplacements: number, filesModified: number, container: HTMLElement) {
		container.empty();
		
		// 显示结果容器并放大模态框
		container.classList.add('has-content');
		this.containerEl.classList.add('has-results');
		
		if (totalReplacements > 0) {
			const successEl = container.createEl('div', { cls: 'regex-replace-success' });
			successEl.createEl('div', { text: `✅ 替换完成！` });
			successEl.createEl('div', { text: `共替换 ${totalReplacements} 处，涉及 ${filesModified} 个文件` });
		} else {
			container.createEl('div', { 
				text: '未找到匹配的内容',
				cls: 'regex-no-results'
			});
		}
	}

	private displayResults(results: SearchResult[], container: HTMLElement) {
		container.empty();
		this.searchResults = results;

		if (results.length === 0) {
			container.createEl('div', { text: '未找到匹配项', cls: 'regex-no-results' });
			container.classList.add('has-content');
			// 即使没结果也稍微放大一点显示提示
			this.containerEl.classList.add('has-results');
			return;
		}

		// 显示结果容器并放大模态框
		container.classList.add('has-content');
		this.containerEl.classList.add('has-results');

		// 统计信息
		const totalMatches = results.reduce((sum, result) => sum + result.totalMatches, 0);
		const statsEl = container.createEl('div', { cls: 'regex-stats' });
		statsEl.createEl('span', { text: `找到 ${totalMatches} 个匹配项，分布在 ${results.length} 个文件中` });

		// 显示结果
		results.forEach((result) => {
			this.renderSingleResult(result, container);
		});
	}

	private renderSingleResult(result: SearchResult, container: HTMLElement) {
		if (result.error) {
			const errorEl = container.createEl('div', { cls: 'regex-error' });
			errorEl.createEl('strong', { text: result.file.name });
			errorEl.createEl('span', { text: ` - 错误：${result.error}` });
			return;
		}

		const fileContainer = container.createDiv('regex-file-result');
		
		// 文件标题
		const fileTitle = fileContainer.createEl('div', { cls: 'regex-file-title' });
		fileTitle.createEl('strong', { text: result.file.name });
		fileTitle.createEl('span', { text: ` (${result.totalMatches} 个匹配项)` });

		// 匹配项
		const matchesContainer = fileContainer.createDiv('regex-matches-container');
		result.matches.forEach((match) => {
			const matchEl = matchesContainer.createDiv('regex-match');
			matchEl.setAttribute('data-match-id', match.matchId);
			
			// 位置信息
			const locationEl = matchEl.createEl('div', { cls: 'regex-match-location' });
			locationEl.createEl('span', { text: `第 ${match.line} 行，第 ${match.column} 列` });
			
			// 匹配内容
			const contentEl = matchEl.createEl('div', { cls: 'regex-match-content' });
			this.renderMatchContent(contentEl, match);

			// 点击跳转
			matchEl.addEventListener('click', () => {
				void this.jumpToMatch(match);
			});
		});
	}

	private renderMatchContent(contentEl: HTMLElement, match: SearchMatch) {
		const contextLines = match.context.split('\n');
		contextLines.forEach((line) => {
			const lineEl = contentEl.createEl('div', { cls: 'regex-context-line' });
			
			// 检查是否是匹配行
			const isMatchLine = line === match.lineText;
			if (isMatchLine) {
				lineEl.addClass('regex-match-line');
				
				// 高亮匹配内容
				const beforeMatch = line.substring(0, match.column - 1);
				const matchText = match.match;
				const afterMatch = line.substring(match.column - 1 + matchText.length);
				
				lineEl.createEl('span', { text: beforeMatch });
				lineEl.createEl('span', { text: matchText, cls: 'regex-highlight' });
				lineEl.createEl('span', { text: afterMatch });
			} else {
				lineEl.createEl('span', { text: line });
			}
		});
	}

	private async jumpToMatch(match: SearchMatch) {
		try {
			// 添加加载状态
			const matchEl = this.containerEl.querySelector(`[data-match-id="${match.matchId}"]`);
			if (matchEl) {
				matchEl.addClass('loading');
			}
			
			// 关闭搜索模态窗口
			this.close();
			
			// 打开文件并跳转到具体位置
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(match.file);
			
			// 等待文件加载完成
			setTimeout(() => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.editor) {
					this.highlightMatch(activeView.editor, match);
				}
			}, 100);
		} catch (error) {
			new Notice('跳转失败：' + error.message);
		}
	}

	private highlightMatch(editor: Editor, match: SearchMatch) {
		try {
			const line = match.line - 1;
			const column = match.column - 1;
			const matchLength = match.match.length;
			
			// 设置光标位置
			editor.setCursor(line, column);
			
			// 滚动到视图中心
			editor.scrollIntoView({
				from: { line: line, ch: 0 },
				to: { line: line, ch: editor.getLine(line).length }
			}, true);
			
			// 选择匹配的文本
			editor.setSelection(
				{ line: line, ch: column },
				{ line: line, ch: column + matchLength }
			);
			
			// 3秒后清除选择
			setTimeout(() => {
				try {
					editor.setCursor(line, column);
			} catch {
				// 忽略错误，可能是编辑器已关闭
			}
			}, PLUGIN_CONFIG.HIGHLIGHT_DURATION);
		} catch (error) {
			console.error('高亮匹配文本时出错:', error);
		}
	}

	onClose() {
		// 取消当前搜索
		if (this.isOperating()) {
			this.plugin.cancelCurrentSearch();
		}
		
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 正则表达式库管理模态框
export class RegexLibraryModal extends Modal {
	plugin: RegexSearchPlugin;
	private libraryContainerEl: HTMLElement;
	private parentModal: RegexSearchModal | null;

	constructor(app: App, plugin: RegexSearchPlugin, parentModal?: RegexSearchModal) {
		super(app);
		this.plugin = plugin;
		this.parentModal = parentModal || null;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('regex-library-modal');

		// 标题
		contentEl.createEl('h2', { text: '📚 正则表达式库', cls: 'regex-library-title' });

		// 创建容器
		this.libraryContainerEl = contentEl.createDiv('regex-library-container');

		// 添加按钮区域
		const buttonContainer = contentEl.createDiv('regex-library-buttons');
		
		const addButton = buttonContainer.createEl('button', { text: '➕ 添加新表达式', cls: 'regex-library-add-btn' });
		const importButton = buttonContainer.createEl('button', { text: '📥 导入', cls: 'regex-library-import-btn' });
		const exportButton = buttonContainer.createEl('button', { text: '📤 导出', cls: 'regex-library-export-btn' });

		// 绑定事件
		addButton.addEventListener('click', () => this.showAddForm());
		importButton.addEventListener('click', () => this.showImportDialog());
		exportButton.addEventListener('click', () => this.exportLibrary());

		// 显示库内容
		this.renderLibrary();
	}

	private renderLibrary() {
		this.libraryContainerEl.empty();

		if (!this.plugin.settings.enableRegexLibrary) {
			this.libraryContainerEl.createEl('div', { 
				text: '正则表达式库已禁用，请在设置中启用。',
				cls: 'regex-library-disabled'
			});
			return;
		}

		const categories = this.plugin.getRegexLibraryByCategory();
		const categoryNames = Object.keys(categories);

		if (categoryNames.length === 0) {
			this.libraryContainerEl.createEl('div', { 
				text: '暂无保存的正则表达式，点击"添加新表达式"开始创建。',
				cls: 'regex-library-empty'
			});
			return;
		}

		categoryNames.forEach(category => {
			const categorySection = this.libraryContainerEl.createDiv('regex-library-category');
			
			// 分类标题
			const categoryHeader = categorySection.createDiv('regex-library-category-header');
			categoryHeader.createEl('h3', { text: category });
			categoryHeader.createEl('span', { 
				text: `${categories[category].length}`,
				cls: 'regex-library-category-count'
			});

			// 分类内容
			const categoryContent = categorySection.createDiv('regex-library-category-content');
			
			categories[category].forEach(item => {
				this.renderLibraryItem(categoryContent, item);
			});
		});
	}

	private renderLibraryItem(container: HTMLElement, item: RegexLibraryItem) {
		const itemEl = container.createDiv('regex-library-item');
		
		// 基本信息
		const infoEl = itemEl.createDiv('regex-library-item-info');
		
		const nameEl = infoEl.createEl('div', { cls: 'regex-library-item-name' });
		nameEl.createEl('strong', { text: item.name });

		infoEl.createEl('div', { text: item.description, cls: 'regex-library-item-description' });
		
		const patternEl = infoEl.createEl('div', { cls: 'regex-library-item-pattern' });
		patternEl.createEl('code', { text: `/${item.pattern}/${item.flags}` });

		// 操作按钮
		const actionsEl = itemEl.createDiv('regex-library-item-actions');
		
		const useButton = actionsEl.createEl('button', { text: '使用', cls: 'regex-library-use-btn' });
		const editButton = actionsEl.createEl('button', { text: '编辑', cls: 'regex-library-edit-btn' });
		const deleteButton = actionsEl.createEl('button', { text: '删除', cls: 'regex-library-delete-btn' });

		// 绑定事件
		useButton.addEventListener('click', () => {
			this.plugin.incrementRegexUsage(item.id);
			
			if (this.parentModal) {
				// 如果有父模态框，在父模态框中填入表达式
				this.parentModal.setPattern(item.pattern);
				this.close(); // 这会触发重新打开父模态框
			} else {
				// 没有父模态框，创建新的搜索模态框
				this.close();
				new RegexSearchModal(this.app, this.plugin, null, item).open();
			}
		});

		editButton.addEventListener('click', () => this.showEditForm(item));
		deleteButton.addEventListener('click', () => this.confirmDelete(item));
	}

	private showAddForm() {
		new RegexLibraryItemModal(this.app, this.plugin, null, (result) => {
			if (result) {
				this.renderLibrary();
			}
		}).open();
	}

	private showEditForm(item: RegexLibraryItem) {
		new RegexLibraryItemModal(this.app, this.plugin, item, (result) => {
			if (result) {
				this.renderLibrary();
			}
		}).open();
	}

	private confirmDelete(item: RegexLibraryItem) {
		new ConfirmModal(this.app, {
			title: '确认删除',
			message: `确定要删除正则表达式"${item.name}"吗？此操作不可撤销。`,
			confirmText: '删除',
			cancelText: '取消'
		}, (confirmed) => {
			if (confirmed) {
				this.plugin.removeFromRegexLibrary(item.id);
				this.renderLibrary();
				new Notice('已删除正则表达式');
			}
		}).open();
	}

	private showImportDialog() {
		new RegexLibraryImportModal(this.app, this.plugin, () => {
			this.renderLibrary();
		}).open();
	}

	private exportLibrary() {
		const json = this.plugin.exportRegexLibrary();
		navigator.clipboard.writeText(json)
			.then(() => {
				new Notice('正则表达式库已复制到剪贴板');
			})
			.catch((err) => {
				new Notice('复制失败：' + (err instanceof Error ? err.message : String(err)));
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		
		// 如果有父模态框，重新打开它
		if (this.parentModal) {
			setTimeout(() => {
				this.parentModal.open();
			}, 100);
		}
	}
}

// 正则表达式项编辑模态框
class RegexLibraryItemModal extends Modal {
	plugin: RegexSearchPlugin;
	item: RegexLibraryItem | null;
	callback: (success: boolean) => void;

	constructor(app: App, plugin: RegexSearchPlugin, item: RegexLibraryItem | null, callback: (success: boolean) => void) {
		super(app);
		this.plugin = plugin;
		this.item = item;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('regex-library-item-modal');

		const title = this.item ? '编辑正则表达式' : '添加正则表达式';
		contentEl.createEl('h3', { text: title });

		// 表单
		const form = contentEl.createEl('form');
		
		// 名称
		const nameContainer = form.createDiv('form-group');
		nameContainer.createEl('label', { text: '名称：' });
		const nameInput = nameContainer.createEl('input', { 
			type: 'text',
			value: this.item?.name || '',
			placeholder: '输入表达式名称...',
			cls: 'regex-form-input'
		});

		// 正则表达式
		const patternContainer = form.createDiv('form-group');
		patternContainer.createEl('label', { text: '正则表达式：' });
		const patternInput = patternContainer.createEl('input', { 
			type: 'text',
			value: this.item?.pattern || '',
			placeholder: '输入正则表达式...',
			cls: 'regex-form-input regex-pattern-input'
		});

		// 标志
		const flagsContainer = form.createDiv('form-group');
		flagsContainer.createEl('label', { text: '标志：' });
		const flagsInput = flagsContainer.createEl('input', { 
			type: 'text',
			value: this.item?.flags || 'g',
			placeholder: 'g, i, m, s...',
			cls: 'regex-form-input'
		});

		// 描述
		const descContainer = form.createDiv('form-group');
		descContainer.createEl('label', { text: '描述：' });
		const descInput = descContainer.createEl('textarea', { 
			value: this.item?.description || '',
			placeholder: '描述这个正则表达式的用途...',
			cls: 'regex-form-textarea'
		});

		// 分类
		const categoryContainer = form.createDiv('form-group');
		categoryContainer.createEl('label', { text: '分类：' });
		const categoryInput = categoryContainer.createEl('input', { 
			type: 'text',
			value: this.item?.category || '自定义',
			placeholder: '输入分类名称...',
			cls: 'regex-form-input'
		});

		// 按钮
		const buttonContainer = form.createDiv('form-buttons');
		buttonContainer.createEl('button', { text: '保存', type: 'submit', cls: 'regex-form-save-btn' });
		const cancelButton = buttonContainer.createEl('button', { text: '取消', type: 'button', cls: 'regex-form-cancel-btn' });

		// 事件处理
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			this.saveItem(nameInput.value, patternInput.value, flagsInput.value, descInput.value, categoryInput.value);
		});

		cancelButton.addEventListener('click', () => {
			this.callback(false);
			this.close();
		});

		// 自动聚焦
		setTimeout(() => nameInput.focus(), 100);
	}

	private saveItem(name: string, pattern: string, flags: string, description: string, category: string) {
		if (!name.trim() || !pattern.trim()) {
			new Notice('名称和正则表达式不能为空');
			return;
		}

		let success = false;
		
		if (this.item) {
			// 编辑现有项
			success = this.plugin.updateRegexLibraryItem(this.item.id, {
				name: name.trim(),
				pattern: pattern.trim(),
				flags: flags.trim() || 'g',
				description: description.trim(),
				category: category.trim() || '自定义'
			});
		} else {
			// 添加新项
			success = this.plugin.addToRegexLibrary(
				name.trim(),
				pattern.trim(),
				description.trim(),
				category.trim() || '自定义',
				flags.trim() || 'g'
			);
		}

		if (success) {
			new Notice(this.item ? '正则表达式已更新' : '正则表达式已添加');
			this.callback(true);
			this.close();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 导入模态框
class RegexLibraryImportModal extends Modal {
	plugin: RegexSearchPlugin;
	callback: () => void;

	constructor(app: App, plugin: RegexSearchPlugin, callback: () => void) {
		super(app);
		this.plugin = plugin;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('regex-library-import-modal');

		contentEl.createEl('h3', { text: '导入正则表达式库' });
		
		const form = contentEl.createEl('form');
		
		const textareaContainer = form.createDiv('form-group');
		textareaContainer.createEl('label', { text: '粘贴JSON数据：' });
		const textarea = textareaContainer.createEl('textarea', {
			placeholder: '在这里粘贴正则表达式库的JSON数据...',
			cls: 'regex-import-textarea'
		});

		const buttonContainer = form.createDiv('form-buttons');
		buttonContainer.createEl('button', { text: '导入', type: 'submit', cls: 'regex-form-save-btn' });
		const cancelButton = buttonContainer.createEl('button', { text: '取消', type: 'button', cls: 'regex-form-cancel-btn' });

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const success = this.plugin.importRegexLibrary(textarea.value);
			if (success) {
				this.callback();
				this.close();
			}
		});

		cancelButton.addEventListener('click', () => this.close());

		setTimeout(() => textarea.focus(), 100);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 确认对话框
export class ConfirmModal extends Modal {
	private callback: (confirmed: boolean) => void;
	private options: {
		title: string;
		message: string;
		confirmText: string;
		cancelText: string;
	};

	constructor(app: App, options: {
		title: string;
		message: string;
		confirmText: string;
		cancelText: string;
	}, callback: (confirmed: boolean) => void) {
		super(app);
		this.options = options;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('confirm-modal');

		// 标题
		contentEl.createEl('h3', { text: this.options.title });

		// 消息
		const messageEl = contentEl.createEl('div', { cls: 'confirm-message' });
		messageEl.createEl('p', { text: this.options.message });

		// 按钮
		const buttonContainer = contentEl.createDiv('confirm-buttons');
		
		const confirmButton = buttonContainer.createEl('button', { 
			text: this.options.confirmText,
			cls: 'confirm-button-confirm'
		});
		
		const cancelButton = buttonContainer.createEl('button', { 
			text: this.options.cancelText,
			cls: 'confirm-button-cancel'
		});

		// 事件处理
		confirmButton.addEventListener('click', () => {
			this.callback(true);
			this.close();
		});

		cancelButton.addEventListener('click', () => {
			this.callback(false);
			this.close();
		});

		// 键盘事件
		this.scope.register([], 'Enter', () => {
			this.callback(true);
			this.close();
		});

		this.scope.register([], 'Escape', () => {
			this.callback(false);
			this.close();
		});

		// 默认焦点
		cancelButton.focus();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// 设置页面
