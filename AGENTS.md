# AGENTS.md - Obsidian Regex Search Plugin

## Project Overview

An Obsidian plugin for cross-file and single-file regex search with batch replace capabilities.
- **Language**: TypeScript (single-file: `main.ts`)
- **Build**: esbuild
- **Target**: ES6/ES2018
- **Obsidian API Version**: 0.15.0+

---

## Build / Lint / Test Commands

```bash
# Development build (watch mode)
npm run dev

# Production build (minified, no sourcemaps)
npm run build

# Lint all files
npx eslint .

# Lint specific file
npx eslint main.ts

# Type check only (no emit)
npx tsc -noEmit -skipLibCheck
```

**Note**: No test framework is currently configured. Add tests with Vitest or Jest if needed.

---

## Project Structure

```
obsidian-regex-search/
├── main.ts          # All plugin code (single-file architecture)
├── styles.css       # UI styles (Apple-inspired design)
├── manifest.json    # Plugin metadata
├── esbuild.config.mjs   # Build configuration
├── package.json
├── tsconfig.json
└── eslint.config.mjs    # ESLint flat config
```

---

## Code Style Guidelines

### TypeScript Configuration

- **Module**: ESNext
- **Target**: ES6
- **Strict**: `noImplicitAny: true`
- **Source Maps**: Inline (dev only)

### Formatting

- **Indentation**: Tabs (not spaces)
- **Line endings**: CRLF (Windows)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `RegexSearchPlugin`, `SearchTask` |
| Interfaces | PascalCase | `SearchMatch`, `RegexLibraryItem` |
| Enums | PascalCase | `SearchState` |
| Constants | SCREAMING_SNAKE_CASE | `PLUGIN_CONFIG`, `DEFAULT_SETTINGS` |
| Functions/Methods | camelCase | `searchInFile`, `validateRegex` |
| Private methods | camelCase (prefix with comment or `private`) | `private filterFiles()` |
| CSS classes | kebab-case with `regex-` prefix | `.regex-search-modal` |

### Imports

```typescript
// Always import from 'obsidian' first
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownView, debounce, Menu } from 'obsidian';

// No other external dependencies - keep it minimal
```

### Class Organization

Follow this order within classes:
1. Properties (public, then private)
2. Constructor
3. Lifecycle methods (`onload`, `onunload`, `onOpen`, `onClose`)
4. Public methods
5. Private methods

### Error Handling

```typescript
// Use custom error classes
class RegexValidationError extends Error {
    constructor(message: string, public readonly pattern: string) {
        super(message);
        this.name = 'RegexValidationError';
    }
}

// Always catch and provide user feedback
try {
    // risky operation
} catch (error) {
    new Notice('Error message: ' + error.message);
    return { error: error.message };
}
```

### Async Patterns

```typescript
// Use async/await, not raw Promises
async searchInFile(file: TFile, pattern: string, flags: string): Promise<SearchResult> {
    // ...
}

// Use AbortController for cancellation
private abortController: AbortController;
if (signal?.aborted) {
    throw new Error('Search cancelled');
}

// Yield to UI thread in loops
if (processedLines % 200 === 0) {
    await new Promise(resolve => setTimeout(resolve, 0));
}
```

### Constants

Define all magic numbers and strings in `PLUGIN_CONFIG`:

```typescript
const PLUGIN_CONFIG = {
    MAX_REGEX_COMPLEXITY: 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    BATCH_SIZE: 8,
    DEBOUNCE_DELAY: 150,
    TIMEOUT_DURATION: 15000,
    // ...
};
```

### Interface Definitions

```typescript
// Place interfaces after constants, before class definitions
interface SearchMatch {
    file: TFile;
    line: number;
    column: number;
    match: string;
    context: string;
    lineText: string;
    matchId: string;
}
```

### UI/Modal Patterns

```typescript
class MyModal extends Modal {
    plugin: RegexSearchPlugin;
    
    constructor(app: App, plugin: RegexSearchPlugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('my-modal-class');
        // Build UI...
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

### CSS Conventions

- Use Obsidian CSS variables (`var(--background-primary)`, `var(--text-normal)`)
- Prefix all classes with `regex-` to avoid conflicts
- Support both light and dark themes
- Use `cubic-bezier(0.16, 1, 0.3, 1)` for smooth animations

---

## ESLint Rules

From `eslint.config.mjs`:

```javascript
rules: {
    "no-undef": "off",  // TypeScript handles this
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
}
```

**Ignored**: `main.js`, `dist/`, `.git/`, `node_modules/`

---

## Common Patterns

### Settings Management

```typescript
const DEFAULT_SETTINGS: RegexSearchSettings = {
    defaultPattern: '',
    caseSensitive: false,
    // ...
};

async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
    await this.saveData(this.settings);
}
```

### State Machine Pattern

Use enums and explicit state transitions for complex operations:

```typescript
enum SearchState {
    Idle = 'idle',
    Searching = 'searching',
    Replacing = 'replacing',
    Cancelled = 'cancelled',
    Error = 'error'
}
```

### File Operations

```typescript
// Read file
const content = await this.app.vault.read(file);

// Write file
await this.app.vault.modify(file, newContent);

// Get all files
const files = this.app.vault.getFiles();

// Filter by extension
const mdFiles = files.filter(f => f.extension === 'md');
```

---

## Performance Guidelines

1. **Batch processing**: Process files in batches of 8-20
2. **Early termination**: Stop when max results reached
3. **File size limits**: Skip files > 10MB
4. **Debounce**: Use 150ms debounce for live search
5. **Timeouts**: 15s max for search operations
6. **Async yields**: Yield to UI every 200 lines

---

## Key Files to Modify

| Task | File |
|------|------|
| Core logic | `main.ts` |
| UI styling | `styles.css` |
| Build config | `esbuild.config.mjs` |
| Plugin metadata | `manifest.json` |
| TypeScript config | `tsconfig.json` |
| Lint config | `eslint.config.mjs` |

---

## Debugging

Enable debug logging in settings:
```typescript
if (this.plugin.settings.enableDebugLogging) {
    console.log('Debug message');
}
```

Production build strips `console.*` and `debugger` statements.
