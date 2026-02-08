import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface Prompt {
	id: string;
	title: string;
	description: string;
	prompt: string;
}

const STORAGE_DIR = path.join(os.homedir(), '.prompt-vault');
const STORAGE_FILE = path.join(STORAGE_DIR, 'prompts.json');

const DEFAULT_PROMPTS: Prompt[] = [
	{
		id: 'default-1',
		title: 'Code Reviewer',
		description: 'Ask Claude to review code for bugs and improvements',
		prompt: 'Please review the following code for bugs, performance issues, and suggest improvements:\n\n'
	},
	{
		id: 'default-2',
		title: 'Documentation Generator',
		description: 'Generate clear documentation for code',
		prompt: 'Generate comprehensive documentation for the following code. Include parameters, return types, and usage examples:\n\n'
	},
	{
		id: 'default-3',
		title: 'Test Case Writer',
		description: 'Create unit test cases',
		prompt: 'Write comprehensive unit tests for the following code:\n\n'
	}
];

let cachedPrompts: Prompt[] = [];

export async function initializeStorage(): Promise<void> {
	try {
		// Check if storage directory exists
		try {
			await fs.access(STORAGE_DIR);
		} catch {
			// Create directory if it doesn't exist
			await fs.mkdir(STORAGE_DIR, { recursive: true });
		}

		// Check if prompts.json exists
		let fileExists = false;
		try {
			await fs.access(STORAGE_FILE);
			fileExists = true;
		} catch {
			fileExists = false;
		}

		if (fileExists) {
			// Load existing prompts
			await loadPrompts();
		} else {
			// Create file with defaults
			await seedDefaults();
		}
	} catch (error) {
		throw new Error(`Failed to initialize storage: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function loadPrompts(): Promise<void> {
	try {
		const content = await fs.readFile(STORAGE_FILE, 'utf-8');
		
		if (content.trim() === '') {
			// Empty file, seed defaults
			await seedDefaults();
			return;
		}

		const prompts = JSON.parse(content) as Prompt[];
		
		if (!Array.isArray(prompts)) {
			throw new Error('prompts.json must contain an array');
		}

		// Filter out duplicates, keeping first occurrence
		const seen = new Set<string>();
		const uniquePrompts: Prompt[] = [];

		for (const prompt of prompts) {
			if (!prompt.id || !prompt.title || !prompt.description || !prompt.prompt) {
				console.warn(`Skipping invalid prompt: missing required fields`);
				continue;
			}

			if (seen.has(prompt.id)) {
				console.warn(`Duplicate prompt ID detected: ${prompt.id}. Ignoring.`);
				continue;
			}

			seen.add(prompt.id);
			uniquePrompts.push(prompt);
		}

		cachedPrompts = uniquePrompts;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in prompts.json: ${error.message}`);
		}
		throw error;
	}
}

async function seedDefaults(): Promise<void> {
	try {
		await fs.writeFile(STORAGE_FILE, JSON.stringify(DEFAULT_PROMPTS, null, 2), 'utf-8');
		cachedPrompts = DEFAULT_PROMPTS;
	} catch (error) {
		throw new Error(`Failed to seed defaults: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export function getPrompts(): Prompt[] {
	return [...cachedPrompts];
}

export function getPromptById(id: string): Prompt | undefined {
	return cachedPrompts.find(p => p.id === id);
}
