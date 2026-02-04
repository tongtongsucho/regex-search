// @ts-check
import eslint from '@eslint/js';
import obsidianmd from 'eslint-plugin-obsidianmd';
import tsparser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';

const OBSIDIAN_RULES = {
	'obsidianmd/commands/no-command-in-command-id': 'error',
	'obsidianmd/commands/no-command-in-command-name': 'error',
	'obsidianmd/commands/no-default-hotkeys': 'error',
	'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
	'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
	'obsidianmd/settings-tab/no-manual-html-headings': 'error',
	'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
	'obsidianmd/vault/iterate': 'error',
	'obsidianmd/detach-leaves': 'error',
	'obsidianmd/hardcoded-config-path': 'error',
	'obsidianmd/no-forbidden-elements': 'error',
	'obsidianmd/no-plugin-as-component': 'error',
	'obsidianmd/no-sample-code': 'error',
	'obsidianmd/no-tfile-tfolder-cast': 'error',
	'obsidianmd/no-view-references-in-plugin': 'error',
	'obsidianmd/no-static-styles-assignment': 'error',
	'obsidianmd/object-assign': 'error',
	'obsidianmd/platform': 'error',
	'obsidianmd/prefer-file-manager-trash-file': 'warn',
	'obsidianmd/prefer-abstract-input-suggest': 'error',
	'obsidianmd/regex-lookbehind': 'error',
	'obsidianmd/sample-names': 'error',
	'obsidianmd/validate-manifest': 'error',
	'obsidianmd/validate-license': ['error'],
	'obsidianmd/ui/sentence-case': ['error', { enforceCamelCaseLower: true }]
};

export default [
	{
		ignores: ['main.js', 'dist/', '.git/', 'node_modules/']
	},

	eslint.configs.recommended,
	...tseslint.configs.recommended,

	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		plugins: {
			obsidianmd
		},
		rules: {
			...OBSIDIAN_RULES
		}
	},

	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
			globals: {
				browser: true
			}
		},
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off'
		}
	},

	{
		files: ['**/*.js', '**/*.mjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				node: true,
				browser: true,
				console: 'readonly',
				module: 'readonly',
				require: 'readonly',
				process: 'readonly'
			}
		}
	}
];
