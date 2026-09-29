---
name: create-ej-app
description: Use when the user wants to create or start a new web app, SaaS product or API project.
license: MIT
compatibility: Requires Bun, Git and internet access. Downloads the create-ej-app package from npm when it runs.
metadata:
  author: ejekanshjain
  version: '1.0.0'
---

# Create a New Project With create-ej-app

[create-ej-app](https://github.com/ejekanshjain/create-ej-app) creates new projects from a set of templates. The templates, their stacks, the CLI's options and the setup steps change over time, so **read them live every time**. Never rely on what you remember about the tool, and never guess template names or flags.

Use it only when a template fits what the user wants, and only after they agree.

## 1. Understand the Project

Ask what they want to build, for whom, and anything they already decided (framework, database, hosting, payments). A sentence or two is enough to pick a template.

## 2. Read the Current Templates

Fetch the README from the repository's default branch, with your web fetch tool or:

```bash
curl -fsSL https://raw.githubusercontent.com/ejekanshjain/create-ej-app/main/README.md
```

From it, note:

- Every template: its name, what it is for, and its stack.
- The prerequisites (runtime, database, accounts such as OAuth, email or payments).
- The setup and development steps after creating a project.

If the fetch fails, tell the user, and ask whether to continue with the CLI's help output alone (step 5) or stop.

## 3. Check the Stack Fits

Show the user the templates from the README in a short table: name, what it's for, and its main stack. Recommend the one that fits best, and say why.

Ask: "Does this stack work for you?" If the user wants something no template uses, such as another framework, language or database, or a different package manager than the README requires, say so plainly. Don't use create-ej-app; offer to set the project up another way. Continue only when the user confirms a template.

## 4. Collect the Answers

Ask for each, with a recommendation:

- **Project name:** it becomes the folder name. Suggest one from what they described, in lowercase with hyphens, such as `acme-dashboard`. The CLI rejects names it can't use and says why.
- **Description:** one sentence for the README and `package.json`.
- **Location:** the parent folder for the project. If `~/Developer` exists, suggest it as the default; otherwise suggest the current folder. Check that `LOCATION/PROJECT_NAME` doesn't exist yet.
- **Git:** recommend yes.
- **Package updates:** templates can lag behind the latest package versions. Recommend updating after creation (step 7), where the user picks which packages to update.

## 5. Check the Tools and the CLI

```bash
bun --version
git --version
git config user.name
git config user.email
```

If a tool is missing, show how to install it and wait for approval. If Git has no name or email, ask the user for them: the initial commit needs both.

Running the CLI downloads it from npm, so confirm the user is fine with that. Then read its current options:

```bash
bunx create-ej-app@latest --help
```

This is the version that will actually run. From it, note the flags for the name, description, template, Git and package updates, and the template names it accepts. If a template name in the help differs from the README, trust the help. If the help shows no flags, the CLI only asks interactively: ask the user to run `bunx create-ej-app@latest` in their own terminal with the answers from step 4, then continue at step 6.

## 6. Create the Project

From the chosen location, run the CLI with a flag for every answer, so it never waits for a question. Answer "update packages" with no here: an agent can't use the interactive update picker, so step 7 handles updates. For example, if the help shows these flags:

```bash
cd LOCATION
bunx create-ej-app@latest --name PROJECT_NAME --description "DESCRIPTION" --template TEMPLATE --git --no-update
```

If the CLI exits saying it needs more flags, add the ones it names. Show the user its output.

Then check, inside the project:

```bash
cd PROJECT_NAME
git log --oneline
git status --short
git check-ignore .env
```

**Expected:** one initial commit, no uncommitted changes, and `.env` printed (it is ignored, so its secrets were not committed). If Git is initialized but there is no commit, commit now, but only if `.env` is ignored:

```bash
git add -A
git commit -m "initial commit: bootstrap new project with create-ej-app"
```

If `.env` is not ignored, stop and tell the user before committing anything.

## 7. Update Packages

This downloads packages, so ask first. Use the package manager the project uses (the README and the lockfile say which). With Bun:

```bash
bun outdated
```

Show the list and point out major version jumps, which can include breaking changes. Ask which packages to update: all, some, or none. Then update them:

```bash
bun update --latest                      # all
bun update --latest PACKAGE_A PACKAGE_B  # only the chosen ones
```

Check the project still works with the scripts it actually has. Read `package.json` first, and run what exists, such as a type-check, lint and tests. Fix or roll back anything that breaks, with the user's agreement. Then commit the update on its own, so it is easy to undo:

```bash
git add -A
git commit -m "update dependencies to their latest versions"
```

## 8. Hand Over

Tell the user where the project is and what to do next, taken from the README's setup and development sections and the CLI's final output: which `.env` values to fill in, how to create the database, and how to start the app. Point them to the project's own `README.md` and `AGENTS.md` before building features.

Never commit `.env`, and never paste its secrets into chat.
