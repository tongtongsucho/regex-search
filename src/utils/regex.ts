import { RegexValidationError } from './errors';
import { PLUGIN_CONFIG } from '../constants';

export class RegexUtils {
	static validateRegex(pattern: string, flags: string): RegExp {
		if (!pattern || pattern.length === 0) {
			throw new RegexValidationError('正则表达式不能为空', pattern);
		}
		
		if (pattern.length > PLUGIN_CONFIG.MAX_SEARCH_LENGTH) {
			throw new RegexValidationError(`正则表达式过长（最大${PLUGIN_CONFIG.MAX_SEARCH_LENGTH}字符）`, pattern);
		}
		
		const complexityScore = this.calculateComplexity(pattern);
		if (complexityScore > PLUGIN_CONFIG.MAX_REGEX_COMPLEXITY) {
			throw new RegexValidationError('正则表达式过于复杂，可能导致性能问题', pattern);
		}
		
		try {
			return new RegExp(pattern, flags);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new RegexValidationError(`正则表达式语法错误: ${message}`, pattern);
		}
	}
	
	static calculateComplexity(pattern: string): number {
		let complexity = 0;
		
		complexity += pattern.length;
		complexity += (pattern.match(/[*+?{]/g) || []).length * 10;
		complexity += (pattern.match(/\(/g) || []).length * 5;
		complexity += (pattern.match(/\[/g) || []).length * 3;
		complexity += (pattern.match(/\?=/g) || []).length * 20;
		
		return complexity;
	}
	
	static sanitizeInput(input: string): string {
		const trimmed = input.trim();
		let sanitized = '';
		for (let i = 0; i < trimmed.length; i++) {
			const code = trimmed.charCodeAt(i);
			if (code > 31 && code !== 127) {
				sanitized += trimmed[i];
			}
		}
		return sanitized;
	}
	
	static escapeRegex(text: string): string {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	static processEscapeSequences(text: string): string {
		return text.replace(/\\(.)/g, (match, char) => {
			switch (char) {
				case 'n': return '\n';
				case 't': return '\t';
				case 'r': return '\r';
				case '\\': return '\\';
				case '0': return '\0';
				default: return match;
			}
		});
	}
}
