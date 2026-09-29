# AGENTS.md: Skills Repository

This repo publishes open-source agent skills in the [Agent Skills](https://agentskills.io/specification) format. People install them with `npx skills add ejekanshjain/skills`, which discovers every `skills/<name>/SKILL.md`.

## Layout

- One skill per folder: `skills/<name>/SKILL.md`, plus optional `scripts/`, `references/` and `assets/`.
- Don't nest a skill inside another skill's folder: the installer shadows the deeper one.
- `setup/` holds the author's personal agent setup. It is not a skill; don't reference it from skills.

## SKILL.md Rules

- `name`: lowercase letters, digits and single hyphens, at most 64 characters, equal to the folder name.
- `description`: one or two plain sentences saying when to use the skill, starting with "Use when". No jargon; details belong in the body.
- `license: MIT`. Add `compatibility` only for real requirements (runtimes, system tools). Put `author` and `version` under `metadata`.
- Keep the body under 500 lines. Move long material to `references/` and link it one level deep, with paths relative to the skill folder.
- Refer to the skill's own folder as `SKILL_DIR`, never an absolute path.
- Write for any agent: no tool names specific to one product, no assumptions about its UI.

## Scripts

- Prefer Node.js 22+ `.mjs` with no dependencies. They must also run under Bun.
- When a dependency is unavoidable, declare it in the skill's `package.json` and tell the agent to install it into `SKILL_DIR`, with the user's approval.
- Scripts print results and exit. Errors name what failed and what to do next.
- Support Linux, macOS and Windows paths when you look for executables.
- Style: double quotes, semicolons, trailing commas, 2-space indent. Comment non-obvious lines only.

## Before You Commit

1. Run `node scripts/validate.mjs`: it checks frontmatter, names, links and script syntax.
2. Exercise changed scripts against a real target. For product-video, record a short tour and run `scripts/check.mjs` on it.
3. Update the skill's `metadata.version` and the table in `README.md` when behavior changes.

## Writing

Active voice, present tense, address the reader as "you". Sentences under 20 words. No filler words, no em dashes. Title Case for headings.
