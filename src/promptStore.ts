import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface PromptVersion {
	title: string;
	description: string;
	prompt: string;
	category?: string;
	savedAt: string;
}

export interface Prompt {
	id: string;
	title: string;
	description: string;
	prompt: string;
	category?: string;
	favorite?: boolean;
	order?: number;
	history?: PromptVersion[];
}

export interface PromptChain {
	id: string;
	title: string;
	description: string;
	promptIds: string[];
}

const STORAGE_DIR = path.join(os.homedir(), '.prompt-vault');
const STORAGE_FILE = path.join(STORAGE_DIR, 'prompts.json');
const CHAINS_FILE = path.join(STORAGE_DIR, 'chains.json');

const DEFAULT_PROMPTS: Prompt[] = [
	{
		id: 'default-1',
		title: 'Code Reviewer',
		description: 'Ask Claude to review code for bugs and improvements',
		prompt: 'Please review the following code for bugs, performance issues, and suggest improvements:\n\n',
		category: 'Code Review',
		favorite: false,
		order: 0,
		history: []
	},
	{
		id: 'default-2',
		title: 'Documentation Generator',
		description: 'Generate clear documentation for code',
		prompt: 'Generate comprehensive documentation for the following code. Include parameters, return types, and usage examples:\n\n',
		category: 'Documentation',
		favorite: false,
		order: 0,
		history: []
	},
	{
		id: 'default-3',
		title: 'Test Case Writer',
		description: 'Create unit test cases',
		prompt: 'Write comprehensive unit tests for the following code:\n\n',
		category: 'Testing',
		favorite: false,
		order: 0,
		history: []
	}
];

let cachedPrompts: Prompt[] = [];
let cachedChains: PromptChain[] = [];

export async function initializeStorage(): Promise<void> {
	try {
		try {
			await fs.access(STORAGE_DIR);
		} catch {
			await fs.mkdir(STORAGE_DIR, { recursive: true });
		}

		let fileExists = false;
		try {
			await fs.access(STORAGE_FILE);
			fileExists = true;
		} catch {
			fileExists = false;
		}

		if (fileExists) {
			await loadPrompts();
		} else {
			await seedDefaults();
		}

		await loadChains();
	} catch (error) {
		throw new Error(`Failed to initialize storage: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function loadPrompts(): Promise<void> {
	try {
		const content = await fs.readFile(STORAGE_FILE, 'utf-8');

		if (content.trim() === '') {
			await seedDefaults();
			return;
		}

		const prompts = JSON.parse(content) as Prompt[];

		if (!Array.isArray(prompts)) {
			throw new Error('prompts.json must contain an array');
		}

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
			uniquePrompts.push({
				...prompt,
				category: prompt.category || 'Uncategorized',
				favorite: prompt.favorite ?? false,
				order: prompt.order ?? 0,
				history: prompt.history ?? [],
			});
		}

		cachedPrompts = uniquePrompts;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in prompts.json: ${error.message}`);
		}
		throw error;
	}
}

async function loadChains(): Promise<void> {
	try {
		await fs.access(CHAINS_FILE);
		const content = await fs.readFile(CHAINS_FILE, 'utf-8');
		if (content.trim() === '') {
			cachedChains = [];
			return;
		}
		const parsed = JSON.parse(content);
		if (!Array.isArray(parsed)) {
			cachedChains = [];
			return;
		}
		cachedChains = parsed.filter(
			(c: PromptChain) => c.id && c.title && Array.isArray(c.promptIds)
		);
	} catch {
		cachedChains = [];
	}
}

async function seedDefaults(): Promise<void> {
	try {
		await fs.writeFile(STORAGE_FILE, JSON.stringify(DEFAULT_PROMPTS, null, 2), 'utf-8');
		cachedPrompts = DEFAULT_PROMPTS.map(p => ({ ...p }));
	} catch (error) {
		throw new Error(`Failed to seed defaults: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export function getPrompts(): Prompt[] {
	return cachedPrompts.map(p => ({ ...p, history: [...(p.history || [])] }));
}

export function getCategories(): string[] {
	const categories = new Set<string>();
	for (const p of cachedPrompts) {
		categories.add(p.category || 'Uncategorized');
	}
	return Array.from(categories).sort();
}

export async function addPrompt(prompt: Prompt): Promise<void> {
	if (cachedPrompts.some(p => p.id === prompt.id)) {
		throw new Error(`Prompt with ID "${prompt.id}" already exists`);
	}
	cachedPrompts.push({
		...prompt,
		category: prompt.category || 'Uncategorized',
		favorite: prompt.favorite ?? false,
		order: prompt.order ?? 0,
		history: prompt.history ?? [],
	});
	await savePrompts();
}

export async function updatePrompt(id: string, updates: Partial<Omit<Prompt, 'id' | 'history'>>): Promise<void> {
	const prompt = cachedPrompts.find(p => p.id === id);
	if (!prompt) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}

	// Save current version to history before updating
	const hasContentChange =
		(updates.title !== undefined && updates.title !== prompt.title) ||
		(updates.description !== undefined && updates.description !== prompt.description) ||
		(updates.prompt !== undefined && updates.prompt !== prompt.prompt) ||
		(updates.category !== undefined && updates.category !== prompt.category);

	if (hasContentChange) {
		if (!prompt.history) {
			prompt.history = [];
		}
		prompt.history.push({
			title: prompt.title,
			description: prompt.description,
			prompt: prompt.prompt,
			category: prompt.category,
			savedAt: new Date().toISOString(),
		});
	}

	Object.assign(prompt, updates);
	await savePrompts();
}

export async function deletePrompt(id: string): Promise<void> {
	const index = cachedPrompts.findIndex(p => p.id === id);
	if (index === -1) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}
	cachedPrompts.splice(index, 1);
	await savePrompts();
}

export async function toggleFavorite(id: string): Promise<boolean> {
	const prompt = cachedPrompts.find(p => p.id === id);
	if (!prompt) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}
	prompt.favorite = !prompt.favorite;
	await savePrompts();
	return prompt.favorite;
}

export function getHistory(id: string): PromptVersion[] {
	const prompt = cachedPrompts.find(p => p.id === id);
	if (!prompt) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}
	return [...(prompt.history || [])];
}

export async function revertToVersion(id: string, versionIndex: number): Promise<void> {
	const prompt = cachedPrompts.find(p => p.id === id);
	if (!prompt) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}
	if (!prompt.history || versionIndex < 0 || versionIndex >= prompt.history.length) {
		throw new Error('Invalid version index');
	}

	const version = prompt.history[versionIndex];

	// Save current as a new history entry before reverting
	prompt.history.push({
		title: prompt.title,
		description: prompt.description,
		prompt: prompt.prompt,
		category: prompt.category,
		savedAt: new Date().toISOString(),
	});

	prompt.title = version.title;
	prompt.description = version.description;
	prompt.prompt = version.prompt;
	prompt.category = version.category;

	await savePrompts();
}

export async function movePromptToCategory(id: string, newCategory: string): Promise<void> {
	const prompt = cachedPrompts.find(p => p.id === id);
	if (!prompt) {
		throw new Error(`Prompt with ID "${id}" not found`);
	}
	prompt.category = newCategory || 'Uncategorized';
	await savePrompts();
}

export async function reorderPrompt(id: string, targetId: string): Promise<void> {
	const sourceIndex = cachedPrompts.findIndex(p => p.id === id);
	const targetIndex = cachedPrompts.findIndex(p => p.id === targetId);
	if (sourceIndex === -1 || targetIndex === -1) return;

	const [moved] = cachedPrompts.splice(sourceIndex, 1);
	cachedPrompts.splice(targetIndex, 0, moved);
	await savePrompts();
}

export async function importPrompts(prompts: Prompt[]): Promise<{ added: number; skipped: number }> {
	let added = 0;
	let skipped = 0;
	for (const prompt of prompts) {
		if (!prompt.id || !prompt.title || !prompt.description || !prompt.prompt) {
			skipped++;
			continue;
		}
		if (cachedPrompts.some(p => p.id === prompt.id)) {
			skipped++;
			continue;
		}
		cachedPrompts.push({
			...prompt,
			category: prompt.category || 'Uncategorized',
			favorite: prompt.favorite ?? false,
			order: prompt.order ?? 0,
			history: prompt.history ?? [],
		});
		added++;
	}
	if (added > 0) {
		await savePrompts();
	}
	return { added, skipped };
}

export function exportPrompts(): string {
	return JSON.stringify(cachedPrompts, null, 2);
}

// ============ CHAINS ============

export function getChains(): PromptChain[] {
	return cachedChains.map(c => ({ ...c, promptIds: [...c.promptIds] }));
}

export async function addChain(chain: PromptChain): Promise<void> {
	if (cachedChains.some(c => c.id === chain.id)) {
		throw new Error(`Chain with ID "${chain.id}" already exists`);
	}
	cachedChains.push({ ...chain });
	await saveChains();
}

export async function updateChain(id: string, updates: Partial<Omit<PromptChain, 'id'>>): Promise<void> {
	const chain = cachedChains.find(c => c.id === id);
	if (!chain) {
		throw new Error(`Chain with ID "${id}" not found`);
	}
	Object.assign(chain, updates);
	await saveChains();
}

export async function deleteChain(id: string): Promise<void> {
	const index = cachedChains.findIndex(c => c.id === id);
	if (index === -1) {
		throw new Error(`Chain with ID "${id}" not found`);
	}
	cachedChains.splice(index, 1);
	await saveChains();
}

async function savePrompts(): Promise<void> {
	try {
		await fs.writeFile(STORAGE_FILE, JSON.stringify(cachedPrompts, null, 2), 'utf-8');
	} catch (error) {
		throw new Error(`Failed to save prompts: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function saveChains(): Promise<void> {
	try {
		await fs.writeFile(CHAINS_FILE, JSON.stringify(cachedChains, null, 2), 'utf-8');
	} catch (error) {
		throw new Error(`Failed to save chains: ${error instanceof Error ? error.message : String(error)}`);
	}
}
