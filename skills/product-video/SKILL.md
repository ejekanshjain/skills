---
name: product-video
description: Make product demo videos of a web app, in whatever style the user wants (guided tours, launch trailers, feature clips, social cuts, hero loops, onboarding walkthroughs), with optional voice-over script, narration audio, music and captions. Includes an optional toolkit that records a real app in a headless browser with a gliding cursor, title cards and smooth fades, and exports MP4, WebM, poster, captions and a timed voice-over sheet. Use when the user wants a demo video, product tour, walkthrough, explainer, promo, screen recording, voice-over script or website video of their own app, or wants to update one after UI changes.
license: MIT
compatibility: The bundled toolkit needs Node.js 22+ (or Bun), ffmpeg, and Chrome, Chromium, Brave or Edge. Any other tools are up to the agent and the user.
metadata:
  author: ejekanshjain
  version: '1.0.0'
---

# Product Video

Help the user make a video that shows their product at its best. There is no required length, structure or style: a 15-second feature clip, a 3-minute narrated walkthrough, a vertical social cut and a silent homepage loop are all good answers to different requests. Decide with the user, then choose the approach that serves the video.

`SKILL_DIR` is the directory that contains this file.

## Work With the User

Before building, agree on what matters, and offer a recommendation for each:

- **Goal and audience:** who watches, where (homepage, sales call, social feed, docs, app store), and what they should do after.
- **Format:** length, aspect ratio, pacing, sound on or off, captions, languages.
- **Style:** calm product tour, energetic launch trailer, step-by-step tutorial, before-and-after story, or something else they describe. Reference videos they like help.
- **Story:** which moments of the product prove the value. Start from the customer's problem, not the feature list.
- **Voice:** silent with on-screen text, a narration script only, or finished narration audio. Ask who records or generates the voice.
- **Data:** what appears on screen. Real customer data never should.

Confirm anything destructive (wiping a database, overwriting published files) and anything that costs money or sends data to a third party (paid voice services, stock music) before doing it.

## Choose How to Make It

The bundled toolkit is one way, not the only way. Pick what fits the request:

- **The toolkit** (below): records the real app with a scripted cursor, title cards, captions and fades, then adds narration and music. Fast to re-record after UI changes.
- **Extend the toolkit:** the scripts are small and readable. Add animations, zooms, overlays, transitions, extra ffmpeg filters or new scene helpers when the idea needs them. Copy them into the project if you change them a lot.
- **Other tools** the user already has or approves: Playwright, a motion graphics or video framework, a screen recorder, a video editor project, design exports. Combine them: for example, record screens with the toolkit and compose them elsewhere.

Whatever you use, make the result reproducible: keep the config, scripts and assets in the project so the video can be rebuilt after the product changes.

## The Toolkit

| File                     | What it does                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/make.mjs`       | Records segments from a config, then exports the video, poster, captions, audio mix, timeline and voice-over sheet |
| `scripts/snap.mjs`       | Screenshots app pages at the recording size, for planning and checking data                                        |
| `scripts/check.mjs`      | Finds one-frame flashes and harsh brightness jumps, writes a contact sheet                                         |
| `assets/tour.config.mjs` | Config template with every option explained                                                                        |

The scripts need no npm install. Typical use:

```bash
node SKILL_DIR/scripts/snap.mjs video/tour.config.mjs /dashboard --full   # look before you script
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs                     # record everything, export
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs pricing              # re-record one segment
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs --export            # new narration or music, no re-recording
node SKILL_DIR/scripts/make.mjs video/tour.config.mjs --loop              # the silent loop
node SKILL_DIR/scripts/check.mjs public/video/product-tour.mp4
```

What a config controls, all optional beyond `baseUrl` and `scenes`:

- **Look:** viewport and output size (any aspect ratio, such as a phone viewport for vertical video), theme colors and font, `theme.css` to restyle cards, captions and cursor completely.
- **Segments:** an optional intro and outro card, then scenes. Each scene can have a title card or none (`card: null`), a caption or none, the cursor or none (`cursor: false`), and a minimum screen time.
- **Action:** each scene's `act(s, page)` is plain async JavaScript. Use the helpers (`s.move`, `s.click`, `s.scroll`, `s.find`, `s.pause`, `s.caption`) or anything the browser allows through `page.eval` and `page.send` (raw DevTools Protocol): type into forms, open menus, trigger animations, inject overlays, highlight elements.
- **Sound:** `narration` text per segment, `voiceover` audio per segment (the scene holds until it ends), one whole-video voice-over file, background music.
- **Timing:** `pace`, `cardMs` and `fadeMs` tune the rhythm. The config template explains each.

Every export also writes, next to the config, a timeline of each segment's start and end, and a voice-over sheet with each segment's speaking window and word budget. Read [references/voiceover.md](references/voiceover.md) when the video has narration.

Never click anything during recording that changes real data, sends messages or spends money.

## Guides

Read these when they apply. They collect what worked, not rules:

- [references/sample-data.md](references/sample-data.md): building a believable fictional dataset safely.
- [references/storyboard.md](references/storyboard.md): story shapes, scene ideas and pacing for different kinds of video.
- [references/voiceover.md](references/voiceover.md): writing narration to the timeline, producing audio, music and captions.
- [references/pitfalls.md](references/pitfalls.md): recording problems already solved (decode errors, flashes, stutter, blur) and how.
- [references/embedding.md](references/embedding.md): publishing on a website: autoplay rules, posters, sound, captions.

## Check Before Calling It Done

- Watch it, or look at `check.mjs`'s contact sheet: no spinners, empty states, errors, debug overlays or real people's data.
- `check.mjs` reports no one-frame flashes. Harsh jumps are fine when they are deliberate cuts.
- Every claim on screen and in the narration is true of the product.
- Play the published file in a real browser, not only headless: press play, seek, and listen if it has sound.

## Report to the User

Describe what the viewer sees and hears: length, story, where it appears, file sizes, anything you couldn't verify, and how to rebuild it. Mention real bugs you noticed in the product while filming.
