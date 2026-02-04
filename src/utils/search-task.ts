import { PLUGIN_CONFIG } from '../constants';

export class SearchTask {
	private abortController: AbortController;
	private timeoutId: number | undefined;
	private isCompleted: boolean = false;
	
	constructor(private timeoutMs: number = PLUGIN_CONFIG.TIMEOUT_DURATION) {
		this.abortController = new AbortController();
	}
	
	get signal(): AbortSignal {
		return this.abortController.signal;
	}
	
	startTimeout(): void {
		this.timeoutId = window.setTimeout(() => {
			if (!this.isCompleted) {
				this.cancel();
			}
		}, this.timeoutMs);
	}
	
	cancel(): void {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}
		this.abortController.abort();
	}
	
	complete(): void {
		this.isCompleted = true;
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}
	}
}
