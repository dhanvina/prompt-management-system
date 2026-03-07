# Prompt Vault - Marketplace Ready Checklist

**Status: PRODUCTION READY v0.3.0**

## Command & View Validation

### All Commands Implemented and Referenced Correctly:

#### Command Palette Commands
- promptVault.addPrompt - Add Prompt via input boxes
- promptVault.listPrompts - List Prompts via quick pick
- promptVault.editPrompt - Edit Prompt via input boxes
- promptVault.deletePrompt - Delete Prompt with confirmation
- promptVault.insertPrompt - Insert Prompt via quick pick + keyboard shortcut (Ctrl+Alt+P)

#### Sidebar Title Bar
- promptVault.addPromptFromView - Add button (+) in tree title
- promptVault.searchPrompts - Search button in tree title + Ctrl+Alt+F
- promptVault.clearSearch - Clear search button in tree title
- promptVault.createChain - Create Chain (overflow menu)
- promptVault.importPrompts - Import Prompts (overflow menu)
- promptVault.exportPrompts - Export Prompts (overflow menu)

#### Prompt Context Menu (inline icons on prompt items)
- promptVault.insertFromTree - Insert (play icon)
- promptVault.toggleFavorite - Toggle Favorite (star icon)
- promptVault.editFromTree - Edit (pencil icon)
- promptVault.deleteFromTree - Delete (trash icon)
- promptVault.previewPrompt - Preview (right-click context menu)
- promptVault.viewHistory - View History (right-click context menu)

#### Chain Context Menu (inline icons on chain items)
- promptVault.runChain - Run Chain (play-all icon)
- promptVault.editChain - Edit Chain (pencil icon)
- promptVault.deleteChain - Delete Chain (trash icon)

#### Internal Commands
- promptVault.openAddForm - Opens add form (used internally)
- promptVault.closeForm - Clears form webview (used internally)

### Views Registered:
- promptVault (View Container in Activity Bar with bookmark icon)
- promptVault.tree (TreeView - Prompts with drag & drop support)
- promptVault.form (WebView - Editor, hidden by default)

## Feature Checklist

### Core (v0.1.0)
- Save, edit, delete prompts
- Sidebar tree view with inline actions
- Webview form editor
- Command palette commands
- Insert into editor + clipboard
- Keyboard shortcut Ctrl+Alt+P
- 3 built-in default prompts
- Local storage (~/.prompt-vault/prompts.json)
- Status bar indicator

### v0.2.0
- Categories with collapsible groups
- Favorites with dedicated section
- Search / filter across all fields
- Import / export as JSON
- Template variables ({{var}} syntax)
- Preview panel with styled webview

### v0.3.0
- Drag & drop reorder and move between categories
- Prompt version history (auto-saved on edit)
- View / preview / revert history versions
- Prompt chains (create, edit, delete, run)
- Chain storage in ~/.prompt-vault/chains.json

## Marketplace Compliance

- No telemetry, analytics, or tracking
- No cloud dependencies or accounts required
- Local-first, privacy-preserving design
- Proper error handling throughout
- Clean console output (errors only)
- Icon and metadata complete
- TypeScript compiles with zero errors
- All commands declared in package.json match registered commands

## Publishing Steps

1. Run `npm run compile` to build
2. Run `vsce package` to create VSIX
3. Run `vsce publish` to publish to Marketplace
