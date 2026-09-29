# Recording Pitfalls

Each problem below happened while building this method. The scripts handle all of them; this file explains the symptoms in case you change the scripts or debug a new app.

## The Video Won't Play in Some Browsers

**Symptom:** the video starts, then stops at 0:00. The console shows `PIPELINE_ERROR_DECODE: video decode error`, often only in one browser.

**Cause:** screencast frames are full-range JPEGs. Encoding them as-is tags the video as full range, and some GPU decoders reject that. The browser doesn't fall back to the next `<source>` once a file has started loading.

**Fix:** convert to limited-range BT.709 while encoding (`out_range=tv`, `out_color_matrix=bt709`) and tag the output. `make.mjs` does this. Verify with `ffprobe -show_entries stream=color_range,color_space`: expect `tv` and `bt709`.

## A One-Frame Flash of the App Before a Step

**Symptom:** a bright frame blinks between two dark cards.

**Cause:** the screencast's first frame is the last frame painted before the card covered the page.

**Fix:** wait two animation frames after showing the card, then start the screencast and drop its first frame. `Stage.record` does both.

## Harsh or Stuttering Fades

**Symptom:** the move from the dark card to a bright screen feels like a flicker. `check.mjs` reports jumps of 30 or more brightness levels during a fade.

**Cause:** the browser drops frames when it fades a full-screen overlay at high resolution, so brightness jumps in uneven steps.

**Fix:** switch the card instantly while recording, note the moment, and draw the fade with ffmpeg afterwards at a steady frame rate. `Stage.curtain` records the moments; `make.mjs` draws the fades.

## Blurry Text

**Cause:** screencast frames arrive at 1x CSS pixels unless the browser is launched with `--force-device-scale-factor`.

**Fix:** `browser.mjs` passes the pixel ratio at launch and in device emulation. Frames arrive at 2880x1620 for a 1440x810 viewport and are downscaled to 1920x1080.

## Choppy Motion

The screencast only sends frames when the page repaints, at irregular times. `stage.mjs` keeps a 1px element repainting every frame and writes an ffmpeg concat list with each frame's real duration, so motion keeps its real timing. Expect 40 to 60 captured frames per second, resampled to 30.

## Dev Overlays in the Shot

Framework dev tools (the Next.js button, screen-size badges) appear in development builds. Add their selectors to `hide` in the config, or record against a production build of the app on a local database.

## Spinners and Half-Loaded Screens

Set `busy` to a selector that matches loading UI. `goto` waits until nothing matches, fonts are ready, then settles for 900 ms.

## A Broken File While a Page Is Open

Overwriting a video while a browser streams it breaks playback, because the byte ranges no longer match. `make.mjs` writes each output under a temporary name and renames it into place. After re-exporting, hard-refresh any open page.

## Verifying Playback

Headless Chromium decodes in software, so it can pass files a real browser's GPU decoder rejects. After exporting, play the video in the user's real browser (for example with the use-my-browser skill): press play, wait 8 seconds, seek to the middle, and confirm `currentTime` advances with no `video.error`.
