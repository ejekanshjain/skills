# Agent Skills

Open-source skills for coding agents. They follow the [Agent Skills](https://agentskills.io) format, so they work in Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Grok, OpenCode and any other agent that reads `SKILL.md` files.

| Skill | What it does |
| --- | --- |
| [product-video](skills/product-video) | Records a polished, silent product tour of your web app: title cards, a gliding cursor, captions and smooth fades, exported as MP4, WebM and a poster. Also makes seamless hero loops. |
| [use-my-browser](skills/use-my-browser) | Drives your real Chrome, Chromium or Brave profile, with your signed-in sessions, over the DevTools Protocol. |

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

Ask your agent for **a demo video of this app**, **a product tour**, or **a hero video for the homepage**.

The agent plans the story with you, prepares realistic sample data, writes a scene config in your project, records it with a headless browser, checks every frame for flashes, and publishes it to your site. Re-recording one scene after a UI change takes about 1.5 minutes.

**Use when:**

- You want a marketing, demo or onboarding video of your own web app
- Your UI changed and the existing video is out of date
- You need a short autoplaying loop for a landing page

**Requires:** Node.js 22+ or Bun, ffmpeg, and Chrome, Chromium, Brave or Edge. The scripts have no npm dependencies.

**Includes:**

- `scripts/make.mjs`: records the scenes and exports the video
- `scripts/check.mjs`: finds one-frame flashes and harsh fades, writes a contact sheet
- `scripts/snap.mjs`: screenshots app pages at the recording size, for planning
- `assets/tour.config.mjs`: the scene config template
- `references/`: guides for sample data, storyboarding, recording pitfalls and embedding

## use-my-browser

Say **use my browser**, **use my chrome** or **use my brave**.

The agent detects your installed Chromium browsers and profiles, launches the one you pick with remote debugging on `127.0.0.1:9222`, and drives the live tab with Playwright. Known multi-step flows run in one batched script instead of one click per turn.

**Use when:**

- A task needs your signed-in sessions, such as an admin panel or a dashboard
- You want screenshots or clicks in your real browser, not a headless one

**Requires:** Node.js and Chrome, Chromium or Brave. The skill installs `playwright-core` into its own folder on first use. It downloads no browser.

**Security:** anything on your machine that can reach port 9222 can control the browser, including cookies and signed-in sessions. Never expose that port or bind it to `0.0.0.0`.

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
