export class SearchHistory {
	private history: string[] = [];
	private maxSize: number = 20;
	
	add(pattern: string): void {
		if (!pattern || pattern.length === 0) return;
		
		const index = this.history.indexOf(pattern);
		if (index > -1) {
			this.history.splice(index, 1);
		}
		
		this.history.unshift(pattern);
		
		if (this.history.length > this.maxSize) {
			this.history = this.history.slice(0, this.maxSize);
		}
	}
	
	get(): string[] {
		return [...this.history];
	}
	
	clear(): void {
		this.history = [];
	}
}
