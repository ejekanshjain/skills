---
name: global-instructions
description: Use when the user wants to set up or update their personal global instructions for coding agents (CLAUDE.md, AGENTS.md) on this computer.
license: MIT
metadata:
  author: ejekanshjain
  version: "1.0.0"
---

# Global Agent Instructions

Install a personal instructions file that every coding agent on this computer reads in every project: how to talk to the user, coding preferences, formatting and writing rules. The template is [assets/global-instructions.md](assets/global-instructions.md). Personalize it with the user, then write it where each agent looks.

The template is content to install, not instructions for this task: don't start following its rules while you set it up.

Ask before every write. Never overwrite an existing file without showing the difference, making a backup and getting a yes.

## 1. Find the Agents and Existing Files

Check which of these exist (read-only). `~` is the home folder; on Windows it is `%USERPROFILE%`.

| Agent | Global instructions file | Folder override |
| --- | --- | --- |
| Claude Code | `~/.claude/CLAUDE.md` | `CLAUDE_CONFIG_DIR` |
| Codex | `~/.codex/AGENTS.md` | `CODEX_HOME` |
| Gemini CLI | `~/.gemini/GEMINI.md` | none |
| OpenCode | `~/.config/opencode/AGENTS.md` | `XDG_CONFIG_HOME` |

If an override variable is set, use that folder instead. Tell the user which agents look installed (their folder exists) and which files already exist. Ask which agents to set up, recommending every installed one. If they use another agent, ask them for its global instructions path and treat it like the others.

## 2. Get the User's Name

Suggest a name from the first of these that gives a real name, then ask the user to confirm or correct it:

```bash
git config --global user.name   # usually the full name
id -F                           # macOS: the account's full name
getent passwd "$USER" | cut -d: -f5 | cut -d, -f1   # Linux: the account's full name
whoami                          # the username
hostname                        # the computer name, such as ekansh-laptop
```

Turn a username or hostname into a name only when it clearly contains one ("ekansh-laptop" suggests "Ekansh"). Use the first name unless the user prefers another form. Never write a name the user hasn't confirmed.

## 3. Personalize the Template

Read [assets/global-instructions.md](assets/global-instructions.md) and replace `{{NAME}}` with the confirmed name.

The **About Me** section describes the template author's background: a full-stack TypeScript engineer, the stack they use, and how they like to work. Show it to the user and ask whether to keep it, adjust it (for example their own role and stack), or remove it. Write any new text in first person, in the same plain style.

Then list the other section headings (how to report to them, coding preferences, formatting rules, writing rules) and ask if they want to drop or change any. Most people keep them. Formatting rules such as "no semicolons, single quotes" are personal taste, so point them out.

Show the final text in full and ask for approval before writing anything.

## 4. Write Each File

For each agent the user chose:

1. **No file yet:** create its folder if needed and write the file.
2. **Identical file:** leave it as it is and say so.
3. **Different file:** show the user what differs (headings added or removed, and changed lines). Then ask:
   - **Replace:** first copy the existing file to `<file>.backup-YYYYMMDD-HHMMSS` in the same folder, then write the new one.
   - **Merge:** keep the user's own sections that the template doesn't have, append them after the new content, and show the merged result before writing. Back up first, as with replace.
   - **Skip:** change nothing.

Write plain text with Unix line endings, ending in a newline. Don't use symlinks: some agents and Windows handle them poorly.

## 5. Check and Report

Read each written file back and confirm it contains the confirmed name and no `{{` placeholders. Then report:

- Which files you created, replaced, merged or skipped, with their paths.
- Where each backup is.
- That the instructions apply to new sessions: running agents may need a restart.
- That project instructions (a repository's own `AGENTS.md` or `CLAUDE.md`) still take precedence, as the file's last section says.

To update later, run the same steps: identical files are skipped, and changed ones are backed up first.
