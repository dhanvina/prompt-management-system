# Changelog

## [0.3.0] - 2026-03-07

### Added
- **Drag & Drop**: Reorder prompts or move them between categories by dragging in the tree view
- **Prompt Versioning**: Every edit auto-saves the previous version to history
- **View History**: Browse, preview, and revert to any previous version of a prompt
- **Prompt Chains**: Combine multiple prompts into ordered workflows
- **Create / Edit / Delete / Run Chain**: Full chain management from the sidebar

### Changed
- Tree view now uses `createTreeView` API to support drag & drop
- Chains stored separately in `~/.prompt-vault/chains.json`
- Version bumped to 0.3.0

## [0.2.0] - 2026-03-07

### Added
- **Categories**: Prompts organized into collapsible category groups in the tree view
- **Favorites**: Pin prompts to a dedicated "Favorites" section at the top
- **Search / Filter**: Filter the tree view by title, description, content, or category
- **Import / Export**: Save and load prompts as JSON files
- **Template Variables**: Use `{{variable}}` syntax in prompts for dynamic values at insert time
- **Preview Panel**: View prompts in a styled read-only webview with highlighted template variables
- Category field in add/edit forms with autocomplete from existing categories

### Changed
- Version bumped to 0.2.0
- Quick pick lists now show category badges and favorite indicators

## [0.1.1] - 2026-03-07

### Fixed
- `validateInput` returns `null` instead of empty string for valid input (correct VS Code API usage)
- Escaped prompt ID in webview JavaScript to prevent injection
- Removed unused `getPromptById()` export
- Removed `onStartupFinished` activation event (extension now activates only when needed)

## [0.1.0] - Initial Release

### Added
- Save, edit, and delete prompts
- Sidebar tree view with inline action buttons
- Webview form for adding/editing prompts
- Command palette commands for all operations
- Insert prompts into editor + clipboard
- Keyboard shortcut `Ctrl+Alt+P` / `Cmd+Alt+P`
- 3 built-in default prompts
- Local storage in `~/.prompt-vault/prompts.json`
- Status bar indicator
