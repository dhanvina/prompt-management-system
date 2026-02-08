# Prompt Vault

Save and manage AI prompts directly inside VS Code. Local storage, zero setup.

## Problem

You use AI tools daily. ChatGPT, Claude, Copilot, Cursor. Each time you write a
good prompt, you copy-paste it from a notes app or browser history. You've
bookmarked good prompts in a Google Doc. You ask the same questions repeatedly.

Prompt Vault solves this: keep your best prompts inside VS Code, where you
already are.

## Features

- **Local storage** - Prompts live in `~/.prompt-vault/` as JSON. No cloud account required.
- **Fast access** - Sidebar + keyboard shortcut to insert prompts while coding.
- **Edit & organize** - Add, edit, and delete prompts without leaving VS Code.
- **Simple format** - Prompts are stored as plain JSON. Easy to backup, sync, or version control.
- **Zero telemetry** - No tracking, no analytics, no external requests.
- **Lightweight** - Single sidebar panel. No complex UI. Minimal overhead.

## Screenshots

[Screenshot: Prompt Vault sidebar with list of prompts]

[Screenshot: Adding a new prompt using the form panel]

[Screenshot: Right-click context menu showing Insert, Edit, Delete actions]

[Screenshot: Prompt being inserted into editor with clipboard indicator]

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Prompt Vault"
4. Click Install

The extension will activate automatically on startup.

### Manual Installation (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/prompt-vault.git
   cd prompt-vault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

4. Press F5 in VS Code to launch the extension in debug mode.

5. To build for release:
   ```bash
   npm run vscode:prepublish
   ```

## How to Use

### Adding a Prompt

1. Open the Prompt Vault sidebar (Activity Bar on the left)
2. Click the **+** button in the "Prompts" panel header
3. Fill in the form:
   - **Prompt ID**: A unique identifier (e.g., `code-review`, `write-docstring`)
   - **Title**: Short human-readable name
   - **Description**: What this prompt does
   - **Prompt Body**: The actual prompt text
4. Click **Create**

Alternatively, use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
```
Prompt Vault: Add Prompt
```

### Editing a Prompt

1. In the Prompt Vault sidebar, right-click any prompt
2. Click **Edit**
3. Update the fields in the form panel
4. Click **Update**

Or use Command Palette:
```
Prompt Vault: Edit Prompt
```

### Deleting a Prompt

1. In the sidebar, right-click any prompt
2. Click **Delete**
3. Confirm the deletion

Or use Command Palette:
```
Prompt Vault: Delete Prompt
```

### Inserting a Prompt

**While editing code:**

1. Click in your editor where you want the prompt
2. In the Prompt Vault sidebar, right-click a prompt
3. Click **Insert**

The prompt is automatically copied to your clipboard and inserted at the cursor.

**Using keyboard shortcut:**
```
Ctrl+Alt+P (Windows/Linux)
Cmd+Alt+P (Mac)
```

Opens a quick picker to select and insert a prompt.

Alternatively, use Command Palette:
```
Prompt Vault: Insert Prompt
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+P` (Windows/Linux) | Insert prompt via quick picker |
| `Cmd+Alt+P` (Mac) | Insert prompt via quick picker |

To customize these, edit your VS Code `keybindings.json` (Ctrl+K Ctrl+S):

```json
{
  "command": "promptVault.insertPrompt",
  "key": "your-preferred-key-combo"
}
```

## Project Structure

```
prompt-vault/
├── src/
│   ├── extension.ts         # Main extension entry point, command handlers
│   └── promptStore.ts       # Storage abstraction layer (CRUD operations)
├── out/                     # Compiled JavaScript (generated)
├── package.json             # Extension manifest
├── README.md
└── tsconfig.json
```

### Key Files

- **extension.ts** (600+ lines)
  - Implements TreeDataProvider for the sidebar UI
  - Registers all commands
  - Manages WebView form for Add/Edit operations
  - Handles prompt insertion and clipboard operations

- **promptStore.ts** (130+ lines)
  - Manages local JSON storage
  - Implements getPrompts, addPrompt, updatePrompt, deletePrompt
  - Handles file I/O and validation

## Design Decisions

### Local-First Storage

Prompts are stored as JSON in `~/.prompt-vault/prompts.json`. No database, no
server, no login. This means:

- Your prompts are always available, online or offline
- You own your data completely
- Easy to version control or sync with third-party tools (Git, Syncthing, etc.)
- Minimal attack surface (no server credentials to leak)

### No Cloud Sync

We intentionally do not offer cloud synchronization. If you need prompts across
machines, use:

- Git (commit `~/.prompt-vault/prompts.json`)
- Syncthing
- Dropbox / OneDrive (symlink your prompt vault)
- Manual export/import via the file system

This approach avoids complexity, costs, and privacy concerns.

### No Telemetry

We do not track usage, send data, or collect analytics. The extension makes no
external network requests. Your prompts never leave your machine.

### Minimal UI

The sidebar uses VS Code's native TreeView API, matching the look and feel of
the Explorer and Source Control panels. No custom styling, no bloat. The form
for editing is a basic WebView with standard inputs.

## Roadmap

### Short Term (0.1.x)

- [x] Add / Edit / Delete prompts
- [x] TreeView sidebar
- [x] Insert prompt into editor
- [x] Keyboard shortcut

### Medium Term (0.2.x)

- [ ] Export prompts to JSON file
- [ ] Import prompts from JSON file
- [ ] Search/filter prompts in sidebar
- [ ] Favorite/pin prompts

### Long Term (0.3.x)

- [ ] Prompt tagging/categorization
- [ ] Snippet-style variable interpolation
- [ ] Community prompt library (read-only, local)

No features depend on external services or cloud infrastructure.

## Contributing

We welcome contributions. The codebase is intentionally kept small and readable.

### Guidelines

1. **Keep it minimal** - Every feature should be justified. No scope creep.
2. **Local-only** - Do not add cloud features, telemetry, or external dependencies.
3. **No major frameworks** - Use VS Code's native APIs.
4. **TypeScript** - Code is written in TypeScript with strict type checking.
5. **Test before submitting** - Run `npm run compile` and test in F5 debug mode.

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Compile and test locally (`npm run compile`, then F5)
5. Commit with clear messages
6. Push to your fork
7. Open a pull request with a description of your changes

### Areas We're Looking For Help

- Documentation improvements
- Bug reports and fixes
- Small feature additions (with prior discussion)
- Accessibility improvements

## License

MIT License. See [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this software for any purpose, as
long as you include the license and copyright notice.
