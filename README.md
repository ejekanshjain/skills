# Agent Skills

Open-source skills for coding agents. They follow the [Agent Skills](https://agentskills.io) format, so they work in Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Grok, OpenCode and any other agent that reads `SKILL.md` files.

| Skill | Use it when |
| --- | --- |
| [product-video](skills/product-video) | You want a demo or promo video of your app, or a voice-over script for one. |
| [use-my-browser](skills/use-my-browser) | You want the agent to work in your own signed-in browser. |
| [git-history-cleanup](skills/git-history-cleanup) | Your Git repository is slow to clone because of big files committed long ago. |
| [create-ej-app](skills/create-ej-app) | You want to start a new web app, SaaS product or API. |
| [global-instructions](skills/global-instructions) | You want your personal instructions and favorite skills set up for every coding agent on your computer. |

## Install

Install every skill for the agents on your machine:

```bash
npx skills add ejekanshjain/skills -g
```

Install one skill:

```bash
npx skills add ejekanshjain/skills -s product-video -g
```

`bunx` works in place of `npx`. Add `-a claude-code` (or `codex`, `cursor` and so on) to pick an agent, or `--list` to see the skills without installing. Drop `-g` to install into the current project instead of your user folder.

### Claude Code Plugin

```text
/plugin marketplace add ejekanshjain/skills
/plugin install product-video@ejekanshjain-skills
```

### Manual

Copy a skill folder into your agent's skills directory:

```bash
git clone https://github.com/ejekanshjain/skills.git
cp -R skills/skills/product-video ~/.claude/skills/   # or ~/.agents/skills, ~/.codex/skills, ~/.grok/skills
```

## product-video

Ask your agent for **a demo video of this app**, **a launch trailer**, **a narrated walkthrough** or **a hero video for the homepage**.

The agent works out the goal, style, length and voice with you, then picks the approach that fits. There are no fixed formats. It can prepare realistic sample data, write a voice-over script timed to the footage, and produce narration audio with the voice you choose. It adds music and captions, checks every frame for flashes, and publishes the video to your site.

The bundled toolkit is optional and easy to extend. It records your real app in a headless browser, with scenes written as plain JavaScript and a gliding cursor. Title cards, captions and fades are all optional. Scenes stretch to fit their narration. Re-recording one scene after a UI change takes about 1.5 minutes.

**Use when:**

- You want a marketing, demo, tutorial or onboarding video of your own web app
- You need a voice-over script or narration timed to your product's screens
- Your UI changed and the existing video is out of date
- You need a short autoplaying loop for a landing page

**Toolkit requires:** Node.js 22.18+ or Bun, ffmpeg, and Chrome, Chromium, Brave or Edge. No npm dependencies.

The agent copies the toolkit into your project, in your project's language and folder layout, and adds package scripts and a README. Teammates without the skill can rebuild the video or make new ones from the repository.

**Includes:**

- `assets/toolkit/`: TypeScript reference code that records segments, exports the video, poster, captions and audio mix, screenshots pages and checks for flashes
- `assets/tour.config.ts`: the config template, with every option explained
- `assets/video-readme.md`: the template for your video folder's README
- `references/`: guides for story and pacing, voice-over, sample data, recording pitfalls and embedding

## use-my-browser

Say **use my browser**, **use my chrome** or **use my brave**.

The agent detects your installed Chromium browsers and profiles, launches the one you pick with remote debugging on `127.0.0.1:9222`, and drives the live tab with Playwright. Known multi-step flows run in one batched script instead of one click per turn.

**Use when:**

- A task needs your signed-in sessions, such as an admin panel or a dashboard
- You want screenshots or clicks in your real browser, not a headless one

**Requires:** Node.js and Chrome, Chromium or Brave. The skill installs `playwright-core` into its own folder on first use. It downloads no browser.

**Security:** anything on your machine that can reach port 9222 can control the browser, including cookies and signed-in sessions. Never expose that port or bind it to `0.0.0.0`.

## git-history-cleanup

Say **my repo is huge because of old videos**, or **remove big files from Git history**.

The agent walks you through removing large files that were deleted long ago but still bloat every clone. It uses `git filter-repo`, one step at a time, and stops after every command to show you the result. You review the list of files to delete yourself, and nothing is rewritten or pushed until you type `rewrite` and `push`. Before and after, it proves that every branch and tag keeps exactly the same files. It keeps a full backup, so you can restore the original history.

**Use when:**

- Fresh clones are slow because of videos, images, archives or binaries deleted long ago
- You want to shrink a repository without changing any current files

**Requires:** `git` and `git-filter-repo`. The whole skill is one file of shell commands for Bash, Zsh and Fish.

**Warning:** this rewrites history. Everyone who uses the repository must stop pushing during the cleanup and re-clone afterwards.

## global-instructions

Say **set up my global agent instructions**.

The agent writes one personal instructions file for Claude Code, Codex, Gemini CLI and OpenCode: how to report to you, coding preferences, formatting rules and writing rules. It suggests your name from your Git profile or computer and asks you to confirm it. It lets you adjust the About Me section and any rules, and shows the final text before writing. Existing files are backed up first, and you choose to replace, merge or skip each one. Then it offers popular skills for documents, design, React, AI features, auth, payments and email, and installs only the ones you pick.

**Use when:**

- You set up a new computer and want your agents to work your way from day one
- You changed your preferences and want every agent updated

## create-ej-app

Say **start a new project** or **create a SaaS app**.

The agent asks what you're building, reads the templates [create-ej-app](https://github.com/ejekanshjain/create-ej-app) offers today straight from its repository, and shows you each stack. It uses the tool only after you confirm the stack fits. It suggests a name and a location (`~/Developer` by default when it exists), creates the project with its initial commit, and offers to update the packages you pick to their latest versions.

**Use when:**

- You're starting a new web app, SaaS product or API, and one of create-ej-app's templates fits

**Requires:** Bun, Git and internet access.

## Repository Layout

```text
skills/
  <skill-name>/
    SKILL.md        # instructions and frontmatter the agent reads
    scripts/        # code the agent runs
    references/     # guides the agent reads when needed
    assets/         # templates the agent copies
scripts/validate.mjs  # checks every skill against the Agent Skills spec
setup/                # the author's personal agent setup, not part of the skills
```

## Contributing

Read [AGENTS.md](AGENTS.md) for the conventions, then run `node scripts/validate.mjs` before you open a pull request.

## License

[MIT](LICENSE)
