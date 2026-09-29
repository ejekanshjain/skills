---
name: product-video
description: Make a polished, silent product tour video of a web app by scripting a headless browser, with a fake cursor, captions, title cards and smooth fades, exported as MP4, WebM and a poster. Also makes short seamless hero loops. Use when the user wants a demo video, product tour, walkthrough, marketing video, explainer, screen recording or website hero video of their own app, or wants to re-record one after UI changes. Covers preparing realistic sample data, storyboarding, recording, quality checks and embedding the video on a website.
license: MIT
compatibility: Requires Node.js 22+ (or Bun), ffmpeg, and Chrome, Chromium, Brave or Edge. Records a web app the agent can run locally or reach on staging.
metadata:
  author: ejekanshjain
  version: "1.0.0"
---

# Product Video

Record a web app as a narrated-by-captions product tour: numbered title cards, a gliding cursor, caption badges and smooth fades, rendered at 1080p. Everything is scripted, so re-recording after a UI change takes minutes.

`SKILL_DIR` is the directory that contains this file. Scripts need no npm install.

| Script | Use |
| --- | --- |
| `scripts/make.mjs` | Record scenes from a config and export the video |
| `scripts/check.mjs` | Find flashes and harsh jumps, write a contact sheet |
| `scripts/snap.mjs` | Screenshot app pages at the recording size, for planning |
| `assets/tour.config.mjs` | Config template to copy into the project |

## 1. Agree on the Plan

Ask the user before building, and recommend an answer for each:

- **Data:** use existing demo data, or build a fictional sample dataset (recommended when screens are empty or hold real customers). Building one may mean wiping a local database: get explicit approval and confirm it isn't production.
- **Format:** a 60 to 90 second tour with cursor and captions (recommended), a 20 to 30 second silent loop for a hero section, or both.
- **Story:** the 5 to 8 screens that show the product's core loop.
- **Placement:** where the video goes on the site, and whether it autoplays (loops only) or waits for play (tours).

## 2. Check Tools

Run `node --version` (22+ needed, or use `bun`), `ffmpeg -version`, and confirm a Chromium-based browser exists (`CHROMIUM_PATH` overrides detection). Don't install anything without the user's approval.

## 3. Prepare the Data

Follow [references/sample-data.md](references/sample-data.md). In short: invent the brand and competitors, tell a believable story over time, derive totals with the app's own code, leave no spinners or empty states, and never touch production or real people's data.

## 4. Plan the Scenes

1. Copy `assets/tour.config.mjs` into the project, for example `video/tour.config.mjs`.
2. Fill in `baseUrl`, `signIn` (a demo account), `theme` (brand dark color and accent), `hide` (dev overlay selectors), `prepare` (page tweaks no selector reaches, such as dismissing banners), and the intro and outro cards.
3. Screenshot candidate screens: `node SKILL_DIR/scripts/snap.mjs video/tour.config.mjs /dashboard /reports --full`, then look at the images.
4. Write one scene per step, following [references/storyboard.md](references/storyboard.md). Aim the cursor with `s.find("visible text")`. Preselect items with URL parameters.

Scene API inside `act: async (s) => { … }`:

- `s.move(x, y, ms)`, `s.click(x?, y?)`, `s.scroll(dy, ms, containerSelector?)`, `s.pause(ms)`
- `s.find(text)` returns `{ x, y }` of the smallest visible element starting with that text
- `s.page.eval(js)`, `s.page.goto(url)` for anything else

## 5. Record

Start the app, then:

```bash
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs            # every scene
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs answers    # re-record one
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs --loop     # the hero loop
```

It records each scene into the system temp folder, encodes it with fades drawn at a steady 30 fps, joins the clips, and writes `<name>.mp4`, `<name>.webm` and `<name>-poster.jpg` to `output.dir`. A full tour takes 3 to 4 minutes; re-recording one scene reuses the others.

Never click anything in a scene that changes data, sends messages or spends money.

## 6. Check

```bash
node SKILL_DIR/scripts/check.mjs public/video/product-tour.mp4
```

It exits 1 when it finds a one-frame flash, and prints the path of a contact sheet. Look at the contact sheet: every step should show its key moment with no spinner, error or debug overlay. Fix scenes and re-record only those.

Then play the file in the user's real browser, not headless: press play, wait 8 seconds, seek to the middle. Headless Chromium decodes in software and can pass files a real GPU decoder rejects. See [references/pitfalls.md](references/pitfalls.md) when anything looks wrong.

## 7. Publish

Follow [references/embedding.md](references/embedding.md): tours wait for play with `preload="none"` and a poster, loops autoplay muted only near the viewport and respect reduced motion. Say on the page that the video shows sample data.

## 8. Leave It Repeatable

Keep the config and the seed script in the project. Add package scripts (for example `video` and `db:seed:demo`) and document them in the project's README or agent instructions, including the demo login and "reseed before recording, so dates look fresh".

## Report to the User

Describe what the viewer sees, not the scripts: the video's length, its steps, where it appears, file sizes, and anything you couldn't verify. Mention real bugs you noticed in the app while filming.
