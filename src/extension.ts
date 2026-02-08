import * as vscode from 'vscode';
import { initializeStorage, getPrompts, addPrompt, updatePrompt, deletePrompt, Prompt } from './promptStore';

let statusBar: vscode.StatusBarItem;
let treeDataProvider: PromptTreeDataProvider;
let formWebviewProvider: FormViewProvider;
let formWebviewView: vscode.WebviewView | undefined;

// ============ TREE VIEW ============

class PromptTreeItem extends vscode.TreeItem {
	constructor(
		public readonly prompt: Prompt,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
	) {
		super(prompt.title, collapsibleState);
		this.description = prompt.description;
		this.tooltip = prompt.description;
		this.contextValue = 'prompt';
		this.iconPath = new vscode.ThemeIcon('document');
	}
}

class PromptTreeDataProvider implements vscode.TreeDataProvider<PromptTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PromptTreeItem | undefined | null | void> = new vscode.EventEmitter<PromptTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PromptTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	getTreeItem(element: PromptTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PromptTreeItem): Thenable<PromptTreeItem[]> {
		if (element) {
			return Promise.resolve([]);
		}
		const prompts = getPrompts();
		if (prompts.length === 0) {
			return Promise.resolve([]);
		}
		return Promise.resolve(prompts.map(p => new PromptTreeItem(p)));
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
}

class FormViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'promptVault.form';

	constructor(private readonly context: vscode.ExtensionContext) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		console.log('Prompt Vault: Form view resolved');
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

		// Initially empty (form is hidden)
		webviewView.webview.html = '';
	}

	public showAddForm() {
		if (!formWebviewView) return;
		const formData: FormData = { mode: 'add', title: '', description: '', prompt: '' };
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
		const formData: FormData = { mode: 'edit', id: promptId, title: prompt.title, description: prompt.description, prompt: prompt.prompt };
		formWebviewView.webview.html = this.getFormHtml(formData);
		formWebviewView.show?.(true);
	}

	private async handleSave(data: FormData) {
		try {
			if (!data.title.trim() || !data.description.trim() || !data.prompt.trim()) {
				vscode.window.showErrorMessage('All fields are required');
				return;
			}

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
				});
				vscode.window.showInformationMessage(`✓ Prompt "${data.title}" added`);
			} else {
				await updatePrompt(data.id!, {
					title: data.title.trim(),
					description: data.description.trim(),
					prompt: data.prompt.trim(),
				});
				vscode.window.showInformationMessage(`✓ Prompt updated`);
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
						<label for="prompt">Prompt Body *</label>
						<textarea id="prompt" name="prompt" placeholder="Your prompt text here..." required>${escapeHtml(data.prompt)}</textarea>
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
								${isEdit ? `id: '${data.id}',` : 'id: document.getElementById("id").value,'}
								title: document.getElementById('title').value,
								description: document.getElementById('description').value,
								prompt: document.getElementById('prompt').value,
							}
						});
					});

					document.getElementById('cancelBtn').addEventListener('click', () => {
						vscode.postMessage({ command: 'cancel' });
					});

					// Focus first input
					document.getElementById('${!isEdit ? 'id' : 'title'}').focus();
				</script>
			</body>
			</html>`;
	}
}

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

export async function activate(context: vscode.ExtensionContext) {
	console.log('Prompt Vault: Activating...');

	try {
		await initializeStorage();
		console.log('Prompt Vault: Storage initialized');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Prompt Vault: Storage initialization failed:', message);
		vscode.window.showErrorMessage(`Prompt Vault: Storage initialization failed - ${message}`);
		return;
	}

	// Register TreeView provider
	treeDataProvider = new PromptTreeDataProvider();
	vscode.window.registerTreeDataProvider('promptVault.tree', treeDataProvider);
	console.log('Prompt Vault: TreeView provider registered');

	// Register FormView provider
	formWebviewProvider = new FormViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(FormViewProvider.viewType, formWebviewProvider)
	);
	console.log('Prompt Vault: Form provider registered');

	// Create status bar
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.text = '$(bookmark) Prompt Vault: Ready';
	statusBar.tooltip = 'Prompt Vault is active';
	statusBar.show();
	context.subscriptions.push(statusBar);

	const disposables = [
		vscode.commands.registerCommand('promptVault.hello', () => {
			vscode.window.showInformationMessage('Prompt Vault is active');
		}),
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
		vscode.commands.registerCommand('promptVault.insertFromTree', async (item: PromptTreeItem) => {
			try {
				const prompt = item.prompt;
				await vscode.env.clipboard.writeText(prompt.prompt);
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					await editor.edit(editBuilder => {
						editBuilder.insert(editor.selection.active, prompt.prompt);
					});
				}
				vscode.window.showInformationMessage('Prompt inserted and copied to clipboard');
				treeDataProvider.refresh();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to insert prompt - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.editFromTree', async (item: PromptTreeItem) => {
			try {
				formWebviewProvider.showEditForm(item.prompt.id);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to edit - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.deleteFromTree', async (item: PromptTreeItem) => {
			try {
				const confirmed = await vscode.window.showWarningMessage(
					`Delete "${item.prompt.title}"?`,
					'Delete',
					'Cancel'
				);
				if (confirmed !== 'Delete') return;
				await deletePrompt(item.prompt.id);
				vscode.window.showInformationMessage('✓ Prompt deleted');
				treeDataProvider.refresh();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Prompt Vault: Failed to delete - ${message}`);
			}
		}),
		vscode.commands.registerCommand('promptVault.addPrompt', addPromptCommand),
		vscode.commands.registerCommand('promptVault.listPrompts', listPromptsCommand),
		vscode.commands.registerCommand('promptVault.editPrompt', editPromptCommand),
		vscode.commands.registerCommand('promptVault.deletePrompt', deletePromptCommand),
		vscode.commands.registerCommand('promptVault.insertPrompt', insertPromptCommand),
	];

	disposables.forEach(d => context.subscriptions.push(d));
	console.log('Prompt Vault: Activation complete');
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
				return '';
			}
		});

		if (id === undefined) return; // User cancelled

		const title = await vscode.window.showInputBox({
			prompt: 'Enter prompt title',
			placeHolder: 'My Awesome Prompt',
			validateInput: (value) => !value.trim() ? 'Title cannot be empty' : ''
		});

		if (title === undefined) return;

		const description = await vscode.window.showInputBox({
			prompt: 'Enter prompt description',
			placeHolder: 'A brief description of what this prompt does',
			validateInput: (value) => !value.trim() ? 'Description cannot be empty' : ''
		});

		if (description === undefined) return;

		const promptBody = await vscode.window.showInputBox({
			prompt: 'Enter prompt body (use \\n for newlines)',
			placeHolder: 'Your prompt text here',
			validateInput: (value) => !value.trim() ? 'Prompt body cannot be empty' : ''
		});

		if (promptBody === undefined) return;

		await addPrompt({
			id: id.trim(),
			title: title.trim(),
			description: description.trim(),
			prompt: promptBody.trim()
		});

		vscode.window.showInformationMessage(`✓ Prompt "${title}" added successfully`);
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
				label: p.title,
				description: p.description,
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
				label: p.title,
				description: p.description,
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
			validateInput: (value) => !value.trim() ? 'Title cannot be empty' : ''
		});

		if (newTitle === undefined) return;

		const newDescription = await vscode.window.showInputBox({
			prompt: 'Edit description',
			value: prompt.description,
			validateInput: (value) => !value.trim() ? 'Description cannot be empty' : ''
		});

		if (newDescription === undefined) return;

		const newPromptBody = await vscode.window.showInputBox({
			prompt: 'Edit prompt body (use \\n for newlines)',
			value: prompt.prompt,
			validateInput: (value) => !value.trim() ? 'Prompt body cannot be empty' : ''
		});

		if (newPromptBody === undefined) return;

		await updatePrompt(prompt.id, {
			title: newTitle.trim(),
			description: newDescription.trim(),
			prompt: newPromptBody.trim()
		});

		vscode.window.showInformationMessage(`✓ Prompt updated successfully`);
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
				label: p.title,
				description: p.description,
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

		vscode.window.showInformationMessage(`✓ Prompt deleted successfully`);
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
				label: p.title,
				description: p.description,
				detail: `ID: ${p.id}`,
				prompt: p
			})),
			{ placeHolder: 'Select a prompt to insert' }
		);

		if (!selected) return;

		// Copy to clipboard
		await vscode.env.clipboard.writeText(selected.prompt.prompt);

		// Insert into active editor if available
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			await editor.edit(editBuilder => {
				editBuilder.insert(editor.selection.active, selected.prompt.prompt);
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
