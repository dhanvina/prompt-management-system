import * as vscode from 'vscode';
import { initializeStorage, getPrompts, addPrompt, updatePrompt, deletePrompt } from './promptStore';

export async function activate(context: vscode.ExtensionContext) {
	try {
		await initializeStorage();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Failed to initialize storage - ${message}`);
		return;
	}

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
		vscode.window.showErrorMessage(`Failed to add prompt: ${message}`);
	}
}

async function listPromptsCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('No prompts available');
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
		vscode.window.showErrorMessage(`Failed to list prompts: ${message}`);
	}
}

async function editPromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('No prompts available to edit');
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
		vscode.window.showErrorMessage(`Failed to edit prompt: ${message}`);
	}
}

async function deletePromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showInformationMessage('No prompts available to delete');
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
		vscode.window.showErrorMessage(`Failed to delete prompt: ${message}`);
	}
}

async function insertPromptCommand() {
	try {
		const prompts = getPrompts();

		if (prompts.length === 0) {
			vscode.window.showErrorMessage('No prompts available');
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
		vscode.window.showErrorMessage(`Failed to insert prompt: ${message}`);
	}
}

export function deactivate() {}
