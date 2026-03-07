import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import {
	initializeStorage, getPrompts, getCategories, addPrompt, updatePrompt,
	deletePrompt, toggleFavorite, importPrompts, exportPrompts,
	getHistory, revertToVersion, movePromptToCategory, reorderPrompt,
	getChains, addChain, updateChain, deleteChain,
	Prompt, PromptVersion, PromptChain
} from './promptStore';

let statusBar: vscode.StatusBarItem;
let treeDataProvider: PromptTreeDataProvider;
let formWebviewProvider: FormViewProvider;
let formWebviewView: vscode.WebviewView | undefined;

// ============ TREE VIEW ============

type VaultItemType = 'prompt' | 'favorites-group' | 'category-group' | 'chains-group' | 'chain' | 'chain-step';

class VaultTreeItem extends vscode.TreeItem {
	constructor(
		public readonly prompt: Prompt | undefined,
		public readonly groupName: string | undefined,
		public readonly itemType: VaultItemType,
		public readonly chain: PromptChain | undefined,
		public readonly stepIndex: number | undefined,
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState,
	) {
		super(label, collapsibleState);

		if (itemType === 'prompt') {
			this.description = prompt!.description;
			this.tooltip = `${prompt!.description}\n\nCategory: ${prompt!.category || 'Uncategorized'}${prompt!.favorite ? '\nFavorite' : ''}`;
			this.contextValue = 'prompt';
			this.iconPath = new vscode.ThemeIcon(prompt!.favorite ? 'star-full' : 'document');
		} else if (itemType === 'favorites-group') {
			this.contextValue = 'favorites-group';
			this.iconPath = new vscode.ThemeIcon('star-full');
		} else if (itemType === 'category-group') {
			this.contextValue = 'category-group';
			this.iconPath = new vscode.ThemeIcon('folder');
		} else if (itemType === 'chains-group') {
			this.contextValue = 'chains-group';
			this.iconPath = new vscode.ThemeIcon('list-ordered');
		} else if (itemType === 'chain') {
			this.contextValue = 'chain';
			this.iconPath = new vscode.ThemeIcon('link');
			this.description = chain!.description;
			this.tooltip = `${chain!.description}\n${chain!.promptIds.length} prompts in chain`;
		} else if (itemType === 'chain-step') {
			this.contextValue = 'chain-step';
			this.iconPath = new vscode.ThemeIcon('circle-outline');
		}
	}
}

const DRAG_MIME = 'application/vnd.code.tree.promptvaulttree';

class PromptDragAndDropController implements vscode.TreeDragAndDropController<VaultTreeItem> {
	readonly dropMimeTypes = [DRAG_MIME];
	readonly dragMimeTypes = [DRAG_MIME];

	handleDrag(source: readonly VaultTreeItem[], dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): void {
		const draggable = source.filter(s => s.itemType === 'prompt' && s.prompt);
		if (draggable.length === 0) return;
		dataTransfer.set(DRAG_MIME, new vscode.DataTransferItem(
			draggable.map(s => s.prompt!.id).join(',')
		));
	}

	async handleDrop(target: VaultTreeItem | undefined, dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
		const data = dataTransfer.get(DRAG_MIME);
		if (!data || !target) return;

		const ids = (data.value as string).split(',');

		if (target.itemType === 'category-group' && target.groupName) {
			// Drop on a category header → move prompts to that category
			for (const id of ids) {
				await movePromptToCategory(id, target.groupName);
			}
			treeDataProvider.refresh();
		} else if (target.itemType === 'prompt' && target.prompt) {
			// Drop on another prompt → reorder + move to same category
			for (const id of ids) {
				if (id === target.prompt.id) continue;
				const targetCategory = target.prompt.category || 'Uncategorized';
				await movePromptToCategory(id, targetCategory);
				await reorderPrompt(id, target.prompt.id);
			}
			treeDataProvider.refresh();
		}
	}
}

class PromptTreeDataProvider implements vscode.TreeDataProvider<VaultTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<VaultTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
	private searchFilter: string = '';

	setSearchFilter(filter: string): void {
		this.searchFilter = filter.toLowerCase();
		this._onDidChangeTreeData.fire(null);
	}

	clearSearchFilter(): void {
		this.searchFilter = '';
		this._onDidChangeTreeData.fire(null);
	}

	getTreeItem(element: VaultTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: VaultTreeItem): VaultTreeItem[] {
		let prompts = getPrompts();
		const chains = getChains();

		// Apply search filter
		if (this.searchFilter) {
			const filter = this.searchFilter;
			prompts = prompts.filter(p =>
				p.title.toLowerCase().includes(filter) ||
				p.description.toLowerCase().includes(filter) ||
				p.prompt.toLowerCase().includes(filter) ||
				(p.category || '').toLowerCase().includes(filter)
			);
		}

		if (!element) {
			const items: VaultTreeItem[] = [];

			// Favorites group
			const favorites = prompts.filter(p => p.favorite);
			if (favorites.length > 0) {
				items.push(new VaultTreeItem(
					undefined, 'Favorites', 'favorites-group', undefined, undefined,
					`Favorites (${favorites.length})`,
					vscode.TreeItemCollapsibleState.Expanded
				));
			}

			// Chains group
			if (chains.length > 0) {
				items.push(new VaultTreeItem(
					undefined, 'Chains', 'chains-group', undefined, undefined,
					`Chains (${chains.length})`,
					vscode.TreeItemCollapsibleState.Collapsed
				));
			}

			// Category groups
			const categories = new Map<string, Prompt[]>();
			for (const p of prompts) {
				const cat = p.category || 'Uncategorized';
				if (!categories.has(cat)) {
					categories.set(cat, []);
				}
				categories.get(cat)!.push(p);
			}

			const sortedCategories = Array.from(categories.keys()).sort();
			for (const cat of sortedCategories) {
				const count = categories.get(cat)!.length;
				items.push(new VaultTreeItem(
					undefined, cat, 'category-group', undefined, undefined,
					`${cat} (${count})`,
					vscode.TreeItemCollapsibleState.Expanded
				));
			}

			return items;
		}

		// Children of favorites
		if (element.itemType === 'favorites-group') {
			return prompts
				.filter(p => p.favorite)
				.map(p => new VaultTreeItem(p, undefined, 'prompt', undefined, undefined, p.title, vscode.TreeItemCollapsibleState.None));
		}

		// Children of chains group
		if (element.itemType === 'chains-group') {
			return chains.map(c => new VaultTreeItem(
				undefined, undefined, 'chain', c, undefined,
				c.title,
				vscode.TreeItemCollapsibleState.Collapsed
			));
		}

		// Children of a chain (show steps)
		if (element.itemType === 'chain' && element.chain) {
			return element.chain.promptIds.map((pid, idx) => {
				const p = prompts.find(pr => pr.id === pid);
				const label = p ? `${idx + 1}. ${p.title}` : `${idx + 1}. [missing: ${pid}]`;
				return new VaultTreeItem(p, undefined, 'chain-step', element.chain, idx, label, vscode.TreeItemCollapsibleState.None);
			});
		}

		// Children of a category
		if (element.itemType === 'category-group') {
			return prompts
				.filter(p => (p.category || 'Uncategorized') === element.groupName)
				.map(p => new VaultTreeItem(p, undefined, 'prompt', undefined, undefined, p.title, vscode.TreeItemCollapsibleState.None));
		}

		return [];
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(null);
	}
}

// ============ FORM WEBVIEW ============

interface FormData {
	mode: 'add' | 'edit';
	id?: string;
	title: string;
	description: string;
	prompt: string;
	category: string;
}

class FormViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'promptVault.form';

	constructor(private readonly context: vscode.ExtensionContext) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		formWebviewView = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [],
		};

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case 'save':
					await this.handleSave(message.data);
					break;
				case 'cancel':
					await vscode.commands.executeCommand('promptVault.closeForm');
					break;
			}
		});

		webviewView.webview.html = '';
	}

	public showAddForm() {
		if (!formWebviewView) return;
		const formData: FormData = { mode: 'add', title: '', description: '', prompt: '', category: '' };
		formWebviewView.webview.html = this.getFormHtml(formData);
		formWebviewView.show?.(true);
	}

	public showEditForm(promptId: string) {
		if (!formWebviewView) return;
		const prompt = getPrompts().find(p => p.id === promptId);
		if (!prompt) {
			vscode.window.showErrorMessage('Prompt not found');
			return;
		}
		const formData: FormData = {
			mode: 'edit', id: promptId,
			title: prompt.title, description: prompt.description,
			prompt: prompt.prompt, category: prompt.category || 'Uncategorized'
		};
		formWebviewView.webview.html = this.getFormHtml(formData);
		formWebviewView.show?.(true);
	}

	private async handleSave(data: FormData) {
		try {
			if (!data.title.trim() || !data.description.trim() || !data.prompt.trim()) {
				vscode.window.showErrorMessage('Title, description, and prompt body are required');
				return;
			}

			const category = data.category?.trim() || 'Uncategorized';

			if (data.mode === 'add') {
				if (!data.id || !data.id.trim() || getPrompts().some(p => p.id === data.id)) {
					vscode.window.showErrorMessage('Invalid or duplicate prompt ID');
					return;
				}
				await addPrompt({
					id: data.id.trim(),
					title: data.title.trim(),
					description: data.description.trim(),
					prompt: data.prompt.trim(),
					category,
					favorite: false,
				});
				vscode.window.showInformationMessage(`Prompt "${data.title}" added`);
			} else {
				await updatePrompt(data.id!, {
					title: data.title.trim(),
					description: data.description.trim(),
					prompt: data.prompt.trim(),
					category,
				});
				vscode.window.showInformationMessage(`Prompt updated`);
			}

			treeDataProvider.refresh();
			await vscode.commands.executeCommand('promptVault.closeForm');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to save: ${message}`);
		}
	}

	private getFormHtml(data: FormData): string {
		const isEdit = data.mode === 'edit';
		const categories = getCategories();
		const categoryOptions = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');

		const idFieldHtml = !isEdit ? `
			<div class="form-group">
				<label for="id">Prompt ID *</label>
				<input type="text" id="id" name="id" value="" placeholder="e.g., code-reviewer" required>
			</div>
		` : '';

		return `<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<style>
					body {
						margin: 0;
						padding: 16px;
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						background: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
					}
					.form-group {
						margin-bottom: 16px;
						display: flex;
						flex-direction: column;
					}
					label {
						margin-bottom: 6px;
						font-size: 12px;
						font-weight: 500;
						color: var(--vscode-descriptionForeground);
					}
					input[type="text"],
					textarea {
						padding: 8px 12px;
						border: 1px solid var(--vscode-input-border);
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						font-family: 'Courier New', monospace;
						border-radius: 4px;
						font-size: 13px;
						box-sizing: border-box;
					}
					input[type="text"]:focus,
					textarea:focus {
						outline: none;
						border-color: var(--vscode-focusBorder);
					}
					textarea {
						min-height: 120px;
						resize: vertical;
						font-family: 'Courier New', monospace;
					}
					.button-group {
						display: flex;
						gap: 8px;
						margin-top: 20px;
					}
					button {
						flex: 1;
						padding: 8px 16px;
						border: none;
						border-radius: 4px;
						font-size: 13px;
						font-weight: 500;
						cursor: pointer;
						transition: all 0.2s;
					}
					.btn-primary {
						background: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
					}
					.btn-primary:hover {
						background: var(--vscode-button-hoverBackground);
					}
					.btn-secondary {
						background: var(--vscode-button-secondaryBackground);
						color: var(--vscode-button-secondaryForeground);
					}
					.btn-secondary:hover {
						background: var(--vscode-button-secondaryHoverBackground);
					}
				</style>
			</head>
			<body>
				<form id="promptForm">
					${idFieldHtml}
					<div class="form-group">
						<label for="title">Title *</label>
						<input type="text" id="title" name="title" value="${escapeHtml(data.title)}" placeholder="My Prompt" required>
					</div>
					<div class="form-group">
						<label for="description">Description *</label>
						<input type="text" id="description" name="description" value="${escapeHtml(data.description)}" placeholder="What this prompt does" required>
					</div>
					<div class="form-group">
						<label for="category">Category</label>
						<input type="text" id="category" name="category" list="categoryList" value="${escapeHtml(data.category)}" placeholder="e.g., Code Review">
						<datalist id="categoryList">${categoryOptions}</datalist>
					</div>
					<div class="form-group">
						<label for="prompt">Prompt Body *</label>
						<textarea id="prompt" name="prompt" placeholder="Your prompt text here... Use {{variable}} for template variables" required>${escapeHtml(data.prompt)}</textarea>
					</div>
					<div class="button-group">
						<button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Create'}</button>
						<button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
					</div>
				</form>
				<script>
					const vscode = acquireVsCodeApi();

					document.getElementById('promptForm').addEventListener('submit', (e) => {
						e.preventDefault();
						vscode.postMessage({
							command: 'save',
							data: {
								mode: '${data.mode}',
								${isEdit ? `id: '${escapeHtml(data.id!).replace(/'/g, "\\'")}',` : 'id: document.getElementById("id").value,'}
								title: document.getElementById('title').value,
								description: document.getElementById('description').value,
								prompt: document.getElementById('prompt').value,
								category: document.getElementById('category').value,
							}
						});
					});

					document.getElementById('cancelBtn').addEventListener('click', () => {
						vscode.postMessage({ command: 'cancel' });
					});

					document.getElementById('${!isEdit ? 'id' : 'title'}').focus();
				</script>
			</body>
			</html>`;
	}
}

// ============ TEMPLATE VARIABLES ============

async function resolveTemplateVariables(text: string): Promise<string | undefined> {
	const variablePattern = /\{\{(\w+)\}\}/g;
	const variables = new Set<string>();
	let match;
	while ((match = variablePattern.exec(text)) !== null) {
		variables.add(match[1]);
	}

	if (variables.size === 0) return text;

	const values = new Map<string, string>();
	for (const varName of variables) {
		const value = await vscode.window.showInputBox({
			prompt: `Enter value for {{${varName}}}`,
			placeHolder: varName,
		});
		if (value === undefined) return undefined;
		values.set(varName, value);
	}

	return text.replace(variablePattern, (_, name) => values.get(name) || '');
}

// ============ MARKDOWN PREVIEW ============

function showPromptPreview(prompt: Prompt) {
	const panel = vscode.window.createWebviewPanel(
		'promptPreview',
		`Preview: ${prompt.title}`,
		vscode.ViewColumn.Beside,
		{ enableScripts: false }
	);

	const promptHtml = escapeHtml(prompt.prompt).replace(/\n/g, '<br>');
	const categoryHtml = escapeHtml(prompt.category || 'Uncategorized');
	const descHtml = escapeHtml(prompt.description);
	const historyCount = (prompt.history || []).length;

	panel.webview.html = `<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<style>
				body {
					margin: 0; padding: 24px;
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
					background: var(--vscode-editor-background);
					color: var(--vscode-editor-foreground);
					line-height: 1.6;
				}
				h1 { margin: 0 0 8px 0; font-size: 20px; }
				.meta { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 20px; }
				.badge {
					display: inline-block; padding: 2px 8px; border-radius: 10px;
					background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
					font-size: 11px; margin-right: 8px;
				}
				.prompt-body {
					padding: 16px; background: var(--vscode-textBlockQuote-background);
					border-left: 3px solid var(--vscode-textBlockQuote-border);
					border-radius: 4px; font-family: 'Courier New', monospace;
					font-size: 13px; white-space: pre-wrap; word-wrap: break-word;
				}
				.section-label {
					font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
					color: var(--vscode-descriptionForeground); margin-bottom: 8px;
				}
				.template-var {
					background: var(--vscode-editor-selectionBackground);
					padding: 1px 4px; border-radius: 3px;
				}
			</style>
		</head>
		<body>
			<h1>${escapeHtml(prompt.title)}</h1>
			<div class="meta">
				<span class="badge">${categoryHtml}</span>
				${prompt.favorite ? '<span class="badge">Favorite</span>' : ''}
				${historyCount > 0 ? `<span class="badge">${historyCount} version${historyCount > 1 ? 's' : ''}</span>` : ''}
				<span>${descHtml}</span>
			</div>
			<div class="section-label">Prompt Body</div>
			<div class="prompt-body">${highlightTemplateVars(promptHtml)}</div>
		</body>
		</html>`;
}

function highlightTemplateVars(html: string): string {
	return html.replace(/\{\{(\w+)\}\}/g, '<span class="template-var">{{$1}}</span>');
}

// ============ HISTORY VIEWER ============

async function showHistoryCommand(item: VaultTreeItem) {
	if (!item.prompt) return;

	const history = getHistory(item.prompt.id);
	if (history.length === 0) {
		vscode.window.showInformationMessage(`"${item.prompt.title}" has no edit history`);
		return;
	}

	const items = history.map((v, idx) => {
		const date = new Date(v.savedAt);
		const dateStr = date.toLocaleString();
		return {
			label: `v${idx + 1}: ${v.title}`,
			description: dateStr,
			detail: `${v.description} | Category: ${v.category || 'Uncategorized'}`,
			versionIndex: idx,
			version: v,
		};
	}).reverse(); // newest first

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: `History for "${item.prompt.title}" (${history.length} versions)`,
	});

	if (!selected) return;

	// Show options for the selected version
	const action = await vscode.window.showQuickPick(
		[
			{ label: '$(history) Revert to this version', action: 'revert' },
			{ label: '$(eye) Preview this version', action: 'preview' },
		],
		{ placeHolder: `${selected.label} - ${selected.description}` }
	);

	if (!action) return;

	if (action.action === 'revert') {
		const confirmed = await vscode.window.showWarningMessage(
			`Revert "${item.prompt.title}" to version ${selected.versionIndex + 1}? Current version will be saved to history.`,
			'Revert',
			'Cancel'
		);
		if (confirmed !== 'Revert') return;

		await revertToVersion(item.prompt.id, selected.versionIndex);
		vscode.window.showInformationMessage(`Reverted to version ${selected.versionIndex + 1}`);
		treeDataProvider.refresh();
	} else if (action.action === 'preview') {
		// Show the old version in a preview panel
		const fakePrompt: Prompt = {
			id: item.prompt.id,
			title: `${selected.version.title} (v${selected.versionIndex + 1})`,
			description: selected.version.description,
			prompt: selected.version.prompt,
			category: selected.version.category,
			favorite: false,
			history: [],
		};
		showPromptPreview(fakePrompt);
	}
}

// ============ CHAIN COMMANDS ============

async function createChainCommand() {
	const prompts = getPrompts();
	if (prompts.length === 0) {
		vscode.window.showInformationMessage('No prompts available to create a chain');
		return;
	}

	const id = await vscode.window.showInputBox({
		prompt: 'Enter chain ID (unique identifier)',
		placeHolder: 'e.g., full-review',
		validateInput: (value) => {
			if (!value.trim()) return 'ID cannot be empty';
			if (getChains().some(c => c.id === value.trim())) return 'This ID already exists';
			return null;
		}
	});
	if (id === undefined) return;

	const title = await vscode.window.showInputBox({
		prompt: 'Enter chain title',
		placeHolder: 'e.g., Full Code Review Pipeline',
		validateInput: (value) => !value.trim() ? 'Title cannot be empty' : null
	});
	if (title === undefined) return;

	const description = await vscode.window.showInputBox({
		prompt: 'Enter chain description',
		placeHolder: 'What this chain does',
		validateInput: (value) => !value.trim() ? 'Description cannot be empty' : null
	});
	if (description === undefined) return;

	// Multi-select prompts for the chain
	const selected = await vscode.window.showQuickPick(
		prompts.map(p => ({
			label: p.title,
			description: `[${p.category || 'Uncategorized'}]`,
			detail: `ID: ${p.id}`,
			picked: false,
			promptId: p.id,
		})),
		{
			placeHolder: 'Select prompts for this chain (in order)',
			canPickMany: true,
		}
	);

	if (!selected || selected.length === 0) {
		vscode.window.showErrorMessage('A chain must contain at least one prompt');
		return;
	}

	await addChain({
		id: id.trim(),
		title: title.trim(),
		description: description.trim(),
		promptIds: selected.map(s => s.promptId),
	});

	vscode.window.showInformationMessage(`Chain "${title}" created with ${selected.length} prompts`);
	treeDataProvider.refresh();
}

async function editChainCommand(item: VaultTreeItem) {
	if (!item.chain) return;
	const chain = item.chain;
	const prompts = getPrompts();

	const title = await vscode.window.showInputBox({
		prompt: 'Edit chain title',
		value: chain.title,
		validateInput: (value) => !value.trim() ? 'Title cannot be empty' : null
	});
	if (title === undefined) return;

	const description = await vscode.window.showInputBox({
		prompt: 'Edit chain description',
		value: chain.description,
		validateInput: (value) => !value.trim() ? 'Description cannot be empty' : null
	});
	if (description === undefined) return;

	const selected = await vscode.window.showQuickPick(
		prompts.map(p => ({
			label: p.title,
			description: `[${p.category || 'Uncategorized'}]`,
			detail: `ID: ${p.id}`,
			picked: chain.promptIds.includes(p.id),
			promptId: p.id,
		})),
		{
			placeHolder: 'Select prompts for this chain (in order)',
			canPickMany: true,
		}
	);

	if (!selected || selected.length === 0) {
		vscode.window.showErrorMessage('A chain must contain at least one prompt');
		return;
	}

	await updateChain(chain.id, {
		title: title.trim(),
		description: description.trim(),
		promptIds: selected.map(s => s.promptId),
	});

	vscode.window.showInformationMessage(`Chain "${title}" updated`);
	treeDataProvider.refresh();
}

async function deleteChainCommand(item: VaultTreeItem) {
	if (!item.chain) return;

	const confirmed = await vscode.window.showWarningMessage(
		`Delete chain "${item.chain.title}"?`,
		'Delete',
		'Cancel'
	);
	if (confirmed !== 'Delete') return;

	await deleteChain(item.chain.id);
	vscode.window.showInformationMessage('Chain deleted');
	treeDataProvider.refresh();
}

async function runChainCommand(item: VaultTreeItem) {
	if (!item.chain) return;

	const prompts = getPrompts();
	const parts: string[] = [];

	for (let i = 0; i < item.chain.promptIds.length; i++) {
		const pid = item.chain.promptIds[i];
		const prompt = prompts.find(p => p.id === pid);
		if (!prompt) {
			vscode.window.showWarningMessage(`Skipping missing prompt: ${pid}`);
			continue;
		}

		const resolved = await resolveTemplateVariables(prompt.prompt);
		if (resolved === undefined) {
			// User cancelled during variable input
			vscode.window.showInformationMessage('Chain execution cancelled');
			return;
		}
		parts.push(resolved);
	}

	if (parts.length === 0) {
		vscode.window.showErrorMessage('No valid prompts in this chain');
		return;
	}

	const combined = parts.join('\n\n---\n\n');

	await vscode.env.clipboard.writeText(combined);
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		await editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, combined);
		});
	}

	vscode.window.showInformationMessage(`Chain "${item.chain.title}" executed (${parts.length} prompts)`);
}

// ============ HELPERS ============

function escapeHtml(text: string): string {
	const map: { [key: string]: string } = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============ ACTIVATION ============

export async function activate(context: vscode.ExtensionContext) {
	try {
		await initializeStorage();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Prompt Vault: Storage initialization failed:', message);
		vscode.window.showErrorMessage(`Prompt Vault: Storage initialization failed - ${message}`);
		return;
	}

	// Register TreeView with drag and drop
	treeDataProvider = new PromptTreeDataProvider();
	const dragAndDropController = new PromptDragAndDropController();
	const treeView = vscode.window.createTreeView('promptVault.tree', {
		treeDataProvider,
		dragAndDropController,
		canSelectMany: false,
	});
	context.subscriptions.push(treeView);

	// Register FormView provider
	formWebviewProvider = new FormViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FormViewProvider.viewType, formWebviewProvider)
	);

	// Create status bar
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.text = '$(bookmark) Prompt Vault: Ready';
	statusBar.tooltip = 'Prompt Vault is active';
	statusBar.show();
	context.subscriptions.push(statusBar);

	const disposables = [
		// ---- Form commands ----
		vscode.commands.registerCommand('promptVault.addPromptFromView', async () => {
			formWebviewProvider.showAddForm();
		}),
		vscode.commands.registerCommand('promptVault.openAddForm', async () => {
			formWebviewProvider.showAddForm();
		}),
		vscode.commands.registerCommand('promptVault.closeForm', async () => {
			if (formWebviewView) {
				formWebviewView.webview.html = '';
			}
			treeDataProvider.refresh();
		}),

		// ---- Tree context commands ----
		vscode.commands.registerCommand('promptVault.insertFromTree', async (item: VaultTreeItem) => {
			try {
				if (!item.prompt) return;
				const resolved = await resolveTemplateVariables(item.prompt.prompt);
				if (resolved === undefined) return;
				await vscode.env.clipboard.writeText(resolved);
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					await editor.edit(editBuilder => {
						editBuilder.insert(editor.selection.active, resolved);
					});
				}
				vscode.window.showInformationMessage('Prompt inserted and copied to clipboard');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to insert prompt - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.editFromTree', async (item: VaultTreeItem) => {
			try {
				if (!item.prompt) return;
				formWebviewProvider.showEditForm(item.prompt.id);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to edit - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.deleteFromTree', async (item: VaultTreeItem) => {
			try {
				if (!item.prompt) return;
				const confirmed = await vscode.window.showWarningMessage(
					`Delete "${item.prompt.title}"?`,
					'Delete',
					'Cancel'
				);
				if (confirmed !== 'Delete') return;
				await deletePrompt(item.prompt.id);
				vscode.window.showInformationMessage('Prompt deleted');
				treeDataProvider.refresh();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to delete - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.toggleFavorite', async (item: VaultTreeItem) => {
			try {
				if (!item.prompt) return;
				const isFav = await toggleFavorite(item.prompt.id);
				vscode.window.showInformationMessage(
					isFav ? `"${item.prompt.title}" added to favorites` : `"${item.prompt.title}" removed from favorites`
				);
				treeDataProvider.refresh();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to toggle favorite - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.previewPrompt', async (item: VaultTreeItem) => {
			if (!item.prompt) return;
			showPromptPreview(item.prompt);
		}),

		// ---- History commands ----
		vscode.commands.registerCommand('promptVault.viewHistory', async (item: VaultTreeItem) => {
			try {
				await showHistoryCommand(item);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to view history - ${message}`);
			}
		}),

		// ---- Chain commands ----
		vscode.commands.registerCommand('promptVault.createChain', createChainCommand),
		vscode.commands.registerCommand('promptVault.editChain', async (item: VaultTreeItem) => {
			try {
				await editChainCommand(item);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to edit chain - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.deleteChain', async (item: VaultTreeItem) => {
			try {
				await deleteChainCommand(item);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to delete chain - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.runChain', async (item: VaultTreeItem) => {
			try {
				await runChainCommand(item);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to run chain - ${message}`);
			}
		}),

		// ---- Search commands ----
		vscode.commands.registerCommand('promptVault.searchPrompts', async () => {
			const query = await vscode.window.showInputBox({
				prompt: 'Search prompts by title, description, content, or category',
				placeHolder: 'Type to search...',
			});
			if (query === undefined) return;
			if (query.trim() === '') {
				treeDataProvider.clearSearchFilter();
				vscode.window.showInformationMessage('Search cleared');
			} else {
				treeDataProvider.setSearchFilter(query.trim());
				vscode.window.showInformationMessage(`Filtering prompts by: "${query.trim()}"`);
			}
		}),
		vscode.commands.registerCommand('promptVault.clearSearch', async () => {
			treeDataProvider.clearSearchFilter();
			vscode.window.showInformationMessage('Search cleared');
		}),

		// ---- Import/Export commands ----
		vscode.commands.registerCommand('promptVault.exportPrompts', async () => {
			try {
				const uri = await vscode.window.showSaveDialog({
					defaultUri: vscode.Uri.file('prompts-export.json'),
					filters: { 'JSON Files': ['json'] },
				});
				if (!uri) return;
				const data = exportPrompts();
				await fs.writeFile(uri.fsPath, data, 'utf-8');
				vscode.window.showInformationMessage(`Prompts exported to ${uri.fsPath}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Export failed: ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.importPrompts', async () => {
			try {
				const uris = await vscode.window.showOpenDialog({
					canSelectMany: false,
					filters: { 'JSON Files': ['json'] },
				});
				if (!uris || uris.length === 0) return;
				const content = await fs.readFile(uris[0].fsPath, 'utf-8');
				let parsed: unknown;
				try {
					parsed = JSON.parse(content);
				} catch {
					vscode.window.showErrorMessage('Invalid JSON file');
					return;
				}
				if (!Array.isArray(parsed)) {
					vscode.window.showErrorMessage('JSON file must contain an array of prompts');
					return;
				}
				const result = await importPrompts(parsed as Prompt[]);
				vscode.window.showInformationMessage(
					`Import complete: ${result.added} added, ${result.skipped} skipped`
				);
				treeDataProvider.refresh();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Import failed: ${message}`);
			}
		}),

		// ---- Command palette commands ----
		vscode.commands.registerCommand('promptVault.addPrompt', addPromptCommand),
		vscode.commands.registerCommand('promptVault.listPrompts', listPromptsCommand),
		vscode.commands.registerCommand('promptVault.editPrompt', editPromptCommand),
		vscode.commands.registerCommand('promptVault.deletePrompt', deletePromptCommand),
		vscode.commands.registerCommand('promptVault.insertPrompt', insertPromptCommand),
	];

	disposables.forEach(d => context.subscriptions.push(d));
}

async function addPromptCommand() {
	try {
		const id = await vscode.window.showInputBox({
			prompt: 'Enter prompt ID (unique identifier, e.g., my-prompt)',
			placeHolder: 'my-prompt',
			validateInput: (value) => {
				if (!value.trim()) return 'ID cannot be empty';
				if (getPrompts().some(p => p.id === value.trim())) {
					return 'This ID already exists';
				}
				return null;
			}
		});
		if (id === undefined) return;

		const title = await vscode.window.showInputBox({
			prompt: 'Enter prompt title',
			placeHolder: 'My Awesome Prompt',
			validateInput: (value) => !value.trim() ? 'Title cannot be empty' : null
		});
		if (title === undefined) return;

		const description = await vscode.window.showInputBox({
			prompt: 'Enter prompt description',
			placeHolder: 'A brief description of what this prompt does',
			validateInput: (value) => !value.trim() ? 'Description cannot be empty' : null
		});
		if (description === undefined) return;

		const category = await vscode.window.showInputBox({
			prompt: 'Enter category (or leave empty for Uncategorized)',
			placeHolder: 'e.g., Code Review, Documentation, Testing',
		});
		if (category === undefined) return;

		const promptBody = await vscode.window.showInputBox({
			prompt: 'Enter prompt body (use \\n for newlines, {{var}} for template variables)',
			placeHolder: 'Your prompt text here',
			validateInput: (value) => !value.trim() ? 'Prompt body cannot be empty' : null
		});
		if (promptBody === undefined) return;

		await addPrompt({
			id: id.trim(),
			title: title.trim(),
			description: description.trim(),
			prompt: promptBody.trim(),
			category: category.trim() || 'Uncategorized',
			favorite: false,
		});

		vscode.window.showInformationMessage(`Prompt "${title}" added successfully`);
		treeDataProvider.refresh();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Could not add prompt - ${message}`);
	}
}

async function listPromptsCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('Prompt Vault: No prompts available yet');
			return;
		}

		const selected = await vscode.window.showQuickPick(
			prompts.map(p => ({
				label: `${p.favorite ? '$(star-full) ' : ''}${p.title}`,
				description: `[${p.category || 'Uncategorized'}] ${p.description}`,
				detail: `ID: ${p.id}`,
				prompt: p
			})),
			{ placeHolder: 'Select a prompt to view' }
		);

		if (!selected) return;

		vscode.window.showInformationMessage(`Prompt: ${selected.prompt.title}\n\n${selected.prompt.description}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Could not list prompts - ${message}`);
	}
}

async function editPromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('Prompt Vault: No prompts available to edit');
			return;
		}

		const selected = await vscode.window.showQuickPick(
			prompts.map(p => ({
				label: `${p.favorite ? '$(star-full) ' : ''}${p.title}`,
				description: `[${p.category || 'Uncategorized'}] ${p.description}`,
				detail: `ID: ${p.id}`,
				prompt: p
			})),
			{ placeHolder: 'Select a prompt to edit' }
		);

		if (!selected) return;

		const prompt = selected.prompt;

		const newTitle = await vscode.window.showInputBox({
			prompt: 'Edit title',
			value: prompt.title,
			validateInput: (value) => !value.trim() ? 'Title cannot be empty' : null
		});
		if (newTitle === undefined) return;

		const newDescription = await vscode.window.showInputBox({
			prompt: 'Edit description',
			value: prompt.description,
			validateInput: (value) => !value.trim() ? 'Description cannot be empty' : null
		});
		if (newDescription === undefined) return;

		const newCategory = await vscode.window.showInputBox({
			prompt: 'Edit category',
			value: prompt.category || 'Uncategorized',
		});
		if (newCategory === undefined) return;

		const newPromptBody = await vscode.window.showInputBox({
			prompt: 'Edit prompt body (use \\n for newlines, {{var}} for template variables)',
			value: prompt.prompt,
			validateInput: (value) => !value.trim() ? 'Prompt body cannot be empty' : null
		});
		if (newPromptBody === undefined) return;

		await updatePrompt(prompt.id, {
			title: newTitle.trim(),
			description: newDescription.trim(),
			prompt: newPromptBody.trim(),
			category: newCategory.trim() || 'Uncategorized',
		});

		vscode.window.showInformationMessage(`Prompt updated successfully`);
		treeDataProvider.refresh();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Could not update prompt - ${message}`);
	}
}

async function deletePromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('Prompt Vault: No prompts available to delete');
			return;
		}

		const selected = await vscode.window.showQuickPick(
			prompts.map(p => ({
				label: `${p.favorite ? '$(star-full) ' : ''}${p.title}`,
				description: `[${p.category || 'Uncategorized'}] ${p.description}`,
				detail: `ID: ${p.id}`,
				prompt: p
			})),
			{ placeHolder: 'Select a prompt to delete' }
		);

		if (!selected) return;

		const confirmed = await vscode.window.showWarningMessage(
			`Are you sure you want to delete "${selected.prompt.title}"?`,
			'Delete',
			'Cancel'
		);

		if (confirmed !== 'Delete') return;

		await deletePrompt(selected.prompt.id);

		vscode.window.showInformationMessage(`Prompt deleted successfully`);
		treeDataProvider.refresh();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Could not delete prompt - ${message}`);
	}
}

async function insertPromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('Prompt Vault: No prompts available yet');
			return;
		}

		const selected = await vscode.window.showQuickPick(
			prompts.map(p => ({
				label: `${p.favorite ? '$(star-full) ' : ''}${p.title}`,
				description: `[${p.category || 'Uncategorized'}] ${p.description}`,
				detail: `ID: ${p.id}`,
				prompt: p
			})),
			{ placeHolder: 'Select a prompt to insert' }
		);

		if (!selected) return;

		const resolved = await resolveTemplateVariables(selected.prompt.prompt);
		if (resolved === undefined) return;

		await vscode.env.clipboard.writeText(resolved);

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			await editor.edit(editBuilder => {
				editBuilder.insert(editor.selection.active, resolved);
			});
		}

		vscode.window.showInformationMessage('Prompt inserted and copied to clipboard');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Failed to insert prompt - ${message}`);
	}
}

export function deactivate() {
	if (statusBar) {
		statusBar.dispose();
	}
}
