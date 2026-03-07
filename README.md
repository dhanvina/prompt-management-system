# Prompt Vault

Save, organize, and reuse your AI prompts directly inside VS Code.

## Features

- **Categories** - Organize prompts into folders like "Code Review", "Documentation", "Testing"
- **Favorites** - Pin your most-used prompts to the top for instant access
- **Template Variables** - Use `{{variable}}` placeholders that get filled in at insert time
- **Prompt Chains** - Combine multiple prompts into a single workflow and run them in sequence
- **Version History** - Every edit is tracked so you can preview or revert to any previous version
- **Drag & Drop** - Reorder prompts or move them between categories by dragging
- **Search & Filter** - Quickly find prompts by title, description, content, or category
- **Import / Export** - Share prompts with your team or back them up as JSON files
- **Preview Panel** - View prompts in a styled read-only panel with highlighted template variables
- **Completely Local** - No accounts, no cloud, no tracking. Your prompts stay on your machine

## Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
3. Search for **"Prompt Vault"**
4. Click **Install**

## Quick Start

### Add a Prompt

1. Click the **bookmark icon** ("Prompt Vault") in the left sidebar
2. Click the **+** button at the top of the panel
3. Fill in the form:
   - **Prompt ID**: A short identifier like `code-review`
   - **Title**: Display name (e.g., "Code Reviewer")
   - **Description**: What this prompt does
   - **Category**: Group it belongs to (e.g., "Code Review")
   - **Prompt Body**: Your prompt text. Use `{{language}}` syntax for template variables
4. Click **Create**

### Insert a Prompt

**Sidebar**: Click the play button next to any prompt in the tree view.

**Keyboard**: Press `Ctrl+Alt+P` (or `Cmd+Alt+P` on Mac), pick a prompt, and it's inserted at your cursor and copied to your clipboard.

If the prompt contains template variables like `{{language}}` or `{{filename}}`, you'll be prompted to fill in each value before insertion.

### Organize with Categories

Prompts are grouped by category in the sidebar tree view. You can:
- Set a category when creating or editing a prompt
- **Drag and drop** a prompt onto a different category header to move it
- Drop a prompt onto another prompt to reorder within the same category

### Favorite Prompts

Click the **star icon** on any prompt to add it to favorites. Favorited prompts appear in a dedicated "Favorites" section at the top of the tree.

### Template Variables

Use `{{variableName}}` in your prompt body to create reusable templates:

```
Review the following {{language}} code for {{concern}}:
```

When you insert this prompt, you'll be asked to enter values for `language` and `concern`.

### Prompt Chains

Combine multiple prompts into a workflow:

1. Open the sidebar overflow menu (**...**) and select **Create Chain**
2. Give it a name and description
3. Select the prompts to include (in order)
4. Run the chain with the **play button** - all prompts execute in sequence

Chains resolve template variables for each step and join results with `---` separators.

### Version History

Every time you edit a prompt, the previous version is automatically saved.

- Right-click a prompt and select **View History**
- Browse all previous versions with timestamps
- **Preview** any old version in a side panel
- **Revert** to restore a previous version (current version is preserved in history)

### Import & Export

- **Export**: Sidebar overflow menu > Export Prompts > Save as JSON
- **Import**: Sidebar overflow menu > Import Prompts > Select a JSON file

Duplicate prompt IDs are skipped during import. Use this to share prompts with teammates or back up your collection.

### Search

Click the **search icon** in the sidebar title bar (or press `Ctrl+Alt+F` when the tree is focused) to filter prompts by title, description, content, or category. Click the **clear icon** to reset.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+P` / `Cmd+Alt+P` | Insert a prompt via quick pick |
| `Ctrl+Alt+F` / `Cmd+Alt+F` | Search prompts (when tree is focused) |

Customize shortcuts in VS Code Settings > Keyboard Shortcuts > search "Prompt Vault".

## Built-in Prompts

Prompt Vault ships with 3 starter prompts to get you going:

- **Code Reviewer** - Review code for bugs and improvements
- **Documentation Generator** - Generate docs with parameters and examples
- **Test Case Writer** - Write comprehensive unit tests

## Data Storage

All data is stored locally in your home directory:

- Prompts: `~/.prompt-vault/prompts.json`
- Chains: `~/.prompt-vault/chains.json`

No configuration needed. The extension works out of the box.

## Requirements

- VS Code 1.85.0 or later

## License

MIT License - Free to use and modify.
