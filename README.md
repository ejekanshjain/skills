# Agent Skills

Open-source skills for coding agents. They follow the [Agent Skills](https://agentskills.io) format, so they work in Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Grok, OpenCode and any other agent that reads `SKILL.md` files.

| Skill | What it does |
| --- | --- |
| [product-video](skills/product-video) | Helps your agent make product demo videos of your web app in any style: guided tours, launch trailers, feature clips, social cuts or hero loops. Includes voice-over scripts, narration audio, music and captions, plus a toolkit that records your real app with a scripted cursor, cards and smooth fades. |
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

Ask your agent for **a demo video of this app**, **a launch trailer**, **a narrated walkthrough** or **a hero video for the homepage**.

The agent works out the goal, style, length and voice with you, then picks the approach that fits. There are no fixed formats. It can prepare realistic sample data, write a voice-over script timed to the footage, and produce narration audio with the voice you choose. It adds music and captions, checks every frame for flashes, and publishes the video to your site.

The bundled toolkit is optional and easy to extend. It records your real app in a headless browser, with scenes written as plain JavaScript and a gliding cursor. Title cards, captions and fades are all optional. Scenes stretch to fit their narration. Re-recording one scene after a UI change takes about 1.5 minutes.

**Use when:**

- You want a marketing, demo, tutorial or onboarding video of your own web app
- You need a voice-over script or narration timed to your product's screens
- Your UI changed and the existing video is out of date
- You need a short autoplaying loop for a landing page

**Toolkit requires:** Node.js 22+ or Bun, ffmpeg, and Chrome, Chromium, Brave or Edge. The scripts have no npm dependencies.

**Includes:**

- `scripts/make.mjs`: records segments and exports the video, poster, captions, audio mix and a timed voice-over sheet
- `scripts/check.mjs`: finds one-frame flashes and harsh fades, writes a contact sheet
- `scripts/snap.mjs`: screenshots app pages at the recording size, for planning
- `assets/tour.config.mjs`: the config template, with every option explained
- `references/`: guides for story and pacing, voice-over, sample data, recording pitfalls and embedding

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
