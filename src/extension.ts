import * as vscode from 'vscode';
import { initializeStorage } from './promptStore';

export async function activate(context: vscode.ExtensionContext) {
	try {
		await initializeStorage();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`Prompt Vault: Failed to initialize storage - ${message}`);
		return;
	}

	const disposable = vscode.commands.registerCommand('promptVault.hello', () => {
		vscode.window.showInformationMessage('Prompt Vault is active');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
