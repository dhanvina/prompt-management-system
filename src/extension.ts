import * as vscode from 'vscode';
import { initializeStorage, getPrompts, addPrompt, updatePrompt, deletePrompt } from './promptStore';

let statusBar: vscode.StatusBarItem;
let viewProvider: PromptVaultViewProvider;

class PromptVaultViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'promptVault.view';

	constructor(private readonly context: vscode.ExtensionContext) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		console.log('Prompt Vault: resolveWebviewView called');
		try {
			webviewView.webview.options = {
				enableScripts: true,
				localResourceRoots: [],
			};

			this.updateWebview(webviewView.webview);
			console.log('Prompt Vault: Webview HTML set');

			webviewView.webview.onDidReceiveMessage(async (message) => {
				switch (message.command) {
					case 'insertPrompt':
						await this.handleInsertPrompt(message.id, webviewView.webview);
						break;
					case 'addPrompt':
						await this.handleAddPrompt(webviewView.webview);
						break;
					case 'editPrompt':
						await this.handleEditPrompt(message.id, webviewView.webview);
						break;
					case 'deletePrompt':
						await this.handleDeletePrompt(message.id, webviewView.webview);
						break;
					case 'refresh':
						this.updateWebview(webviewView.webview);
						break;
				}
			});
		} catch (error) {
			console.error('Prompt Vault: Failed to resolve webview:', error);
			webviewView.webview.html = '<div style="padding: 16px; color: #d32f2f;">Failed to load Prompt Vault. Please reload.</div>';
		}
	}

	private updateWebview(webview: vscode.Webview) {
		try {
			const prompts = getPrompts();
			const html = this.getHtmlContent(prompts);
			webview.html = html;
			console.log(`Prompt Vault: Webview updated with ${prompts.length} prompts`);
		} catch (error) {
			console.error('Prompt Vault: Failed to update webview:', error);
			webview.html = '<div style="padding: 16px; color: #d32f2f;">Error loading prompts. Please reload.</div>';
		}
	}

	private async handleInsertPrompt(id: string, webview: vscode.Webview) {
		try {
			const prompts = getPrompts();
			const prompt = prompts.find(p => p.id === id);
			if (!prompt) {
				vscode.window.showErrorMessage('Prompt Vault: Prompt not found');
				return;
			}

			// Copy to clipboard
			await vscode.env.clipboard.writeText(prompt.prompt);

			// Insert into active editor if available
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				await editor.edit(editBuilder => {
					editBuilder.insert(editor.selection.active, prompt.prompt);
				});
			}

			vscode.window.showInformationMessage('Prompt inserted and copied to clipboard');
			this.updateWebview(webview);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Prompt Vault: Failed to insert prompt - ${message}`);
		}
	}

	private async handleAddPrompt(webview: vscode.Webview) {
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

			if (id === undefined) return;

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
			this.updateWebview(webview);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Prompt Vault: Could not add prompt - ${message}`);
		}
	}

	private async handleEditPrompt(id: string, webview: vscode.Webview) {
		try {
			const prompts = getPrompts();
			const prompt = prompts.find(p => p.id === id);
			if (!prompt) {
				vscode.window.showErrorMessage('Prompt Vault: Prompt not found');
				return;
			}

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
			this.updateWebview(webview);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Prompt Vault: Could not update prompt - ${message}`);
		}
	}

	private async handleDeletePrompt(id: string, webview: vscode.Webview) {
		try {
			const prompts = getPrompts();
			const prompt = prompts.find(p => p.id === id);
			if (!prompt) {
				vscode.window.showErrorMessage('Prompt Vault: Prompt not found');
				return;
			}

			const confirmed = await vscode.window.showWarningMessage(
				`Are you sure you want to delete "${prompt.title}"?`,
				'Delete',
				'Cancel'
			);

			if (confirmed !== 'Delete') return;

			await deletePrompt(id);

			vscode.window.showInformationMessage(`✓ Prompt deleted successfully`);
			this.updateWebview(webview);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Prompt Vault: Could not delete prompt - ${message}`);
		}
	}

	private getHtmlContent(prompts: any[]): string {
		const promptsList = prompts.length === 0
			? '<div style="padding: 16px; text-align: center; color: #999;">No prompts yet. Add one to get started.</div>'
			: prompts.map(p => `
				<div style="border-bottom: 1px solid #e0e0e0; padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; hover-bg: #f5f5f5;" onmouseover="this.style.backgroundColor='#f5f5f5'" onmouseout="this.style.backgroundColor='transparent'">
					<div style="flex: 1; min-width: 0;">
						<div style="font-weight: 500; color: #333; margin-bottom: 4px; word-break: break-word;">${escapeHtml(p.title)}</div>
						<div style="font-size: 12px; color: #666; word-break: break-word;">${escapeHtml(p.description)}</div>
					</div>
					<div style="display: flex; gap: 4px; flex-shrink: 0;">
						<button onclick="insertPrompt('${escapeHtml(p.id)}')" style="padding: 4px 8px; font-size: 11px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 2px;">Insert</button>
						<button onclick="editPrompt('${escapeHtml(p.id)}')" style="padding: 4px 8px; font-size: 11px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 2px;">Edit</button>
						<button onclick="deletePrompt('${escapeHtml(p.id)}')" style="padding: 4px 8px; font-size: 11px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 2px; color: #d32f2f;">Delete</button>
					</div>
				</div>
			`).join('');

		return `<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<style>
					body {
						margin: 0;
						padding: 0;
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
						background: #fff;
						color: #333;
					}
					button {
						font-family: inherit;
					}
					#addButton {
						width: 100%;
						padding: 12px;
						background: #007acc;
						color: white;
						border: none;
						cursor: pointer;
						font-size: 13px;
						font-weight: 500;
						border-radius: 0;
						transition: background 0.2s;
					}
					#addButton:hover {
						background: #005a9e;
					}
					#promptsList {
						margin-top: 0;
					}
				</style>
			</head>
			<body>
				<button id="addButton" onclick="addPrompt()">+ Add Prompt</button>
				<div id="promptsList">
					${promptsList}
				</div>
				<script>
					const vscode = acquireVsCodeApi();

					function insertPrompt(id) {
						vscode.postMessage({ command: 'insertPrompt', id: id });
					}

					function addPrompt() {
						vscode.postMessage({ command: 'addPrompt' });
					}

					function editPrompt(id) {
						vscode.postMessage({ command: 'editPrompt', id: id });
					}

					function deletePrompt(id) {
						vscode.postMessage({ command: 'deletePrompt', id: id });
					}
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
	console.log('Prompt Vault: viewType =', PromptVaultViewProvider.viewType);
	
	// Register the WebView provider FIRST, synchronously
	try {
		viewProvider = new PromptVaultViewProvider(context);
		console.log('Prompt Vault: Provider instance created');
		
		const disposable = vscode.window.registerWebviewViewProvider(
			PromptVaultViewProvider.viewType,
			viewProvider
		);
		console.log('Prompt Vault: registerWebviewViewProvider returned:', disposable);
		
		context.subscriptions.push(disposable);
		console.log('Prompt Vault: Disposable pushed to subscriptions');
		console.log('Prompt Vault: WebView provider registered successfully');
	} catch (error) {
		console.error('Prompt Vault: FAILED to register WebView provider:', error);
		throw error;
	}

	try {
		await initializeStorage();
		console.log('Prompt Vault: Storage initialized');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('Prompt Vault: Storage initialization failed:', message);
		vscode.window.showErrorMessage(`Prompt Vault: Storage initialization failed - ${message}`);
		return;
	}

	// Create status bar indicator
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.text = '$(bookmark) Prompt Vault: Ready';
	statusBar.tooltip = 'Prompt Vault is active';
	statusBar.show();
	context.subscriptions.push(statusBar);

	const disposables = [
		vscode.commands.registerCommand('promptVault.hello', () => {
			vscode.window.showInformationMessage('Prompt Vault is active');
		}),
		vscode.commands.registerCommand('promptVault.addPrompt', addPromptCommand),
		vscode.commands.registerCommand('promptVault.listPrompts', listPromptsCommand),
		vscode.commands.registerCommand('promptVault.editPrompt', editPromptCommand),
		vscode.commands.registerCommand('promptVault.deletePrompt', deletePromptCommand),
		vscode.commands.registerCommand('promptVault.insertPrompt', insertPromptCommand),
	];

	disposables.forEach(d => context.subscriptions.push(d));
	console.log('Prompt Vault: Activation complete, subscriptions count:', context.subscriptions.length);
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
