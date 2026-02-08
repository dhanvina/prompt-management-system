# Prompt Vault

Save your favorite AI prompts inside VS Code and use them with one click.

## What This Does

- **Save prompts** - Keep your best AI prompts organized in VS Code instead of scattered in notes or browser tabs
- **Quick access** - Insert any saved prompt into your code with a button click or keyboard shortcut
- **Easy management** - Add, edit, and delete prompts without leaving VS Code
- **Completely local** - Your prompts stay on your computer. No accounts, no cloud, no tracking

## Who This Is For

Anyone who:
- Uses AI tools (ChatGPT, Claude, Copilot) while coding
- Has favorite prompts they use over and over
- Wants quick access to their prompts right in VS Code

## How to Install

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
3. Search for **"Prompt Vault"**
4. Click **Install**

That's it! The extension is ready to use.

## How to Use

### Add Your First Prompt

1. Look at the left sidebar - you'll see a bookmark icon labeled **"Prompt Vault"**
2. Click on it (if not already open)
3. Click the **+** button at the top of the "Prompts" section
4. Fill in the form:
   - **Prompt ID**: A short name like `code-review` (no spaces)
   - **Title**: What you want to call it (e.g., "Code Reviewer")
   - **Description**: What this prompt does
   - **Prompt Body**: Your actual prompt text
5. Click **Create**

### Use a Saved Prompt

**Option 1: Using the sidebar**
1. Click in your code editor where you want to insert the prompt
2. In the Prompt Vault panel on the left, right-click any prompt
3. Click **Insert**
4. The prompt appears in your editor and is copied to your clipboard

**Option 2: Using the keyboard shortcut (faster!)**
1. Click in your code editor where you want the prompt
2. Press `Ctrl+Alt+P` (Windows/Linux) or `Cmd+Alt+P` (Mac)
3. A list appears - pick the prompt you want
4. Done! It's inserted into your editor

### Edit a Prompt

1. In the Prompt Vault sidebar, right-click any prompt
2. Click **Edit**
3. Update the fields
4. Click **Update**

### Delete a Prompt

1. In the Prompt Vault sidebar, right-click any prompt
2. Click **Delete**
3. Confirm when asked

## Example Use Case

You ask Claude to review code many times a day. Instead of typing the same request each time:

1. Save this as a prompt:
   - **Title**: "Code Reviewer"
   - **Prompt Body**: "Please review the following code for bugs, performance issues, and improvements:"

2. Now whenever you want code reviewed, press `Ctrl+Alt+P`, pick "Code Reviewer", and it's inserted automatically

3. You just paste the code after it and ask Claude

## Keyboard Shortcuts

- `Ctrl+Alt+P` (Windows/Linux) - Insert a prompt
- `Cmd+Alt+P` (Mac) - Insert a prompt

To change these shortcuts, go to VS Code Settings → Keyboard Shortcuts and search for "Prompt Vault".

## Features

- Save unlimited prompts
- Organize prompts with descriptions
- Insert prompts with one click
- Fast keyboard shortcut access
- Built-in default prompts to get started
- No setup required

## Configuration

No configuration needed. The extension works right out of the box.

Your prompts are saved locally in your home folder (`~/.prompt-vault/`).

## License

MIT License - Free to use and modify.
