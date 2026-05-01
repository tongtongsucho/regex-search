import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type RegexSearchPlugin from '../plugin';
import { PLUGIN_CONFIG } from '../constants';
import { RegexUtils } from '../utils';

export class RegexSearchSettingTab extends PluginSettingTab {
	plugin: RegexSearchPlugin;
	
	constructor(app: App, plugin: RegexSearchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

		display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 基本设置
		this.createBasicSettings(containerEl);
		
		// 高级设置
		this.createAdvancedSettings(containerEl);
		
		// 性能设置
		this.createPerformanceSettings(containerEl);
		
		// 用户体验设置
		this.createUserExperienceSettings(containerEl);
	}

	private createBasicSettings(containerEl: HTMLElement) {
		new Setting(containerEl).setName('⚙️ 基本设置').setHeading();

		new Setting(containerEl)
			.setName('默认搜索模式')
			.setDesc('打开搜索时的默认正则表达式模式')
			.addText(text => text
				.setPlaceholder('输入默认正则表达式...')
				.setValue(this.plugin.settings.defaultPattern)
				.onChange(async (value) => {
					this.plugin.settings.defaultPattern = RegexUtils.sanitizeInput(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('区分大小写')
			.setDesc('默认启用区分大小写搜索')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.caseSensitive)
				.onChange(async (value) => {
					this.plugin.settings.caseSensitive = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('多行模式')
			.setDesc('默认启用多行模式（^ 和 $ 匹配行首行尾）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.multiline)
				.onChange(async (value) => {
					this.plugin.settings.multiline = value;
					await this.plugin.saveSettings();
				}));

		// 添加多行模式详细说明
		const multilineHelp = containerEl.createEl('div', { cls: 'setting-item-description regex-multiline-help' });
		
		// 使用 DOM API 创建帮助内容
		multilineHelp.createEl('span', { cls: 'help-title', text: '💡 多行模式说明：' });
		
		const singleLineItem = multilineHelp.createEl('div', { cls: 'help-item' });
		singleLineItem.createEl('span', { text: '• ' });
		singleLineItem.createEl('strong', { text: '单行模式' });
		singleLineItem.createEl('span', { text: '：' });
		singleLineItem.createEl('span', { cls: 'help-code', text: '^' });
		singleLineItem.createEl('span', { text: ' 和 ' });
		singleLineItem.createEl('span', { cls: 'help-code', text: '$' });
		singleLineItem.createEl('span', { text: ' 匹配整个文本的开始和结束' });
		
		const multiLineItem = multilineHelp.createEl('div', { cls: 'help-item' });
		multiLineItem.createEl('span', { text: '• ' });
		multiLineItem.createEl('strong', { text: '多行模式' });
		multiLineItem.createEl('span', { text: '：' });
		multiLineItem.createEl('span', { cls: 'help-code', text: '^' });
		multiLineItem.createEl('span', { text: ' 和 ' });
		multiLineItem.createEl('span', { cls: 'help-code', text: '$' });
		multiLineItem.createEl('span', { text: ' 匹配每一行的开始和结束' });
		
		const exampleItem = multilineHelp.createEl('div', { cls: 'help-example' });
		exampleItem.createEl('span', { text: '例如：在多行模式下，' });
		exampleItem.createEl('span', { cls: 'help-code', text: '^第' });
		exampleItem.createEl('span', { text: ' 可以匹配每一行开头的"第"字' });

		new Setting(containerEl)
			.setName('文件扩展名')
			.setDesc('要搜索的文件扩展名（用逗号分隔）')
			.addText(text => text
        // eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder('例如：md, txt, json, js, ts')
				.setValue(this.plugin.settings.fileExtensions.join(','))
				.onChange(async (value) => {
					const extensions = value.split(',').map(ext => ext.trim()).filter(ext => ext.length > 0);
					this.plugin.settings.fileExtensions = extensions;
					await this.plugin.saveSettings();
				}));
	}

	private createAdvancedSettings(containerEl: HTMLElement) {
		new Setting(containerEl).setName('🔧 高级设置').setHeading();

		new Setting(containerEl)
			.setName('包含隐藏文件')
			.setDesc('在搜索中包含隐藏文件（以 . 开头的文件）')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeHiddenFiles)
				.onChange(async (value) => {
					this.plugin.settings.includeHiddenFiles = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('排除模式')
			.setDesc('要排除的文件路径模式（用逗号分隔，支持正则表达式）')
			.addText(text => text
				.setPlaceholder('node_modules,\\.git,temp')
				.setValue(this.plugin.settings.excludePatterns.join(','))
				.onChange(async (value) => {
					const patterns = value.split(',').map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
					this.plugin.settings.excludePatterns = patterns;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('确认替换')
			.setDesc('在执行全库替换操作前显示确认对话框')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmReplace)
				.onChange(async (value) => {
					this.plugin.settings.confirmReplace = value;
					await this.plugin.saveSettings();
				}));
	}

	private createPerformanceSettings(containerEl: HTMLElement) {
		new Setting(containerEl).setName('⚡ 性能设置').setHeading();

		new Setting(containerEl)
			.setName('每个文件最大结果数')
			.setDesc('限制每个文件显示的最大搜索结果数量')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(this.plugin.settings.maxResultsPerFile.toString())
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0 && num <= PLUGIN_CONFIG.MAX_RESULTS_PER_FILE) {
						this.plugin.settings.maxResultsPerFile = num;
						await this.plugin.saveSettings();
					}
				}));
	}

	private createUserExperienceSettings(containerEl: HTMLElement) {
		new Setting(containerEl).setName('🎨 用户体验设置').setHeading();

		new Setting(containerEl)
			.setName('启用搜索历史')
			.setDesc('保存和显示搜索历史记录')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableSearchHistory)
				.onChange(async (value) => {
					this.plugin.settings.enableSearchHistory = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用正则表达式库')
			.setDesc('启用内置的正则表达式库功能，可以保存和重复使用常用正则表达式')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableRegexLibrary)
				.onChange(async (value) => {
					this.plugin.settings.enableRegexLibrary = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用进度指示器')
			.setDesc('在搜索和替换过程中显示进度指示器')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableProgressIndicator)
				.onChange(async (value) => {
					this.plugin.settings.enableProgressIndicator = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('启用后会在开发者控制台显示状态转换日志')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDebugLogging)
				.onChange(async (value) => {
					this.plugin.settings.enableDebugLogging = value;
					await this.plugin.saveSettings();
				}));

		// 清空搜索历史按钮
		new Setting(containerEl)
			.setName('清空搜索历史')
			.setDesc('删除所有保存的搜索历史记录')
			.addButton(button => button
				.setButtonText('🗑️ 清空历史')
				.setWarning()
			.onClick(() => {
				this.plugin.clearSearchHistory();
				new Notice('搜索历史已清空');
			}));
	}
}
