#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Browser, sleep } from "./browser.mjs";
import { Stage } from "./stage.mjs";

const USAGE = `Record a product video from a running web app.

  node make.mjs <config.mjs> [segment keys...] [--export] [--loop]

  <config.mjs>    video config (start from assets/tour.config.mjs)
  segment keys    re-record only these (intro, outro or scene keys), reuse the rest
  --export        skip recording; rebuild the timeline, script, captions, audio
                  mix and video files from the clips already recorded
  --loop          record and export the silent loop instead of the tour

Besides the video, every export writes next to the config:
  <name>.timeline.json   when each segment's card and screen start and end
  <name>.script.md       voice-over sheet: time windows, word budgets, narration
Recorded clips stay in the system temp folder between runs.`;

const DEFAULTS = {
  viewport: { width: 1440, height: 810 },
  pixelRatio: 2,
  output: {
    dir: "video",
    name: "product-tour",
    width: 1920,
    height: 1080,
    formats: ["mp4", "webm"],
    posterAt: 2.2,
  },
  theme: {
    background: "#111827",
    text: "#ffffff",
    accent: "#a3e635",
    font: "Inter, ui-sans-serif, system-ui, sans-serif",
    colorScheme: "light",
    captionPosition: "bottom-left",
    css: "",
  },
  audio: {},
  hide: ["nextjs-portal"],
  busy: '[aria-busy="true"]',
  pace: 0.75,
  fadeMs: 900,
  cardMs: 1000,
};

/** Speaking rate used for word budgets: about 145 words a minute. */
const WORDS_PER_SECOND = 2.4;

// Encoder settings. Lower CRF means higher quality and larger files.
// Screencast frames are full-range JPEGs; convert them to the limited-range
// BT.709 color every web video uses, or some GPU decoders reject the file.
const COLOR_TAGS = "-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv".split(" ");
const clipFilter = (o) =>
  `fps=30,scale=${o.width}:${o.height}:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`;
const CLIP_FLAGS = ["-c:v", "libx264", "-crf", "10", "-preset", "fast", ...COLOR_TAGS];
const FORMATS = {
  mp4: {
    video: "-c:v libx264 -profile:v high -crf 23 -preset veryslow -tune stillimage -pix_fmt yuv420p -movflags +faststart",
    audio: "-c:a aac -b:a 160k",
  },
  webm: {
    video: "-c:v libvpx-vp9 -crf 44 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p",
    audio: "-c:a libopus -b:a 128k",
  },
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error) throw new Error(`${cmd} is not installed, so the video cannot be built.`);
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr.trim()}`);
  return r.stdout;
}
const ffmpeg = (args) => run("ffmpeg", ["-v", "error", "-y", ...args]);
const duration = (file) =>
  Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]));

/** Merges user config over defaults, one level deep for nested groups. */
function resolveConfig(user, configPath) {
  const config = { ...DEFAULTS, ...user };
  for (const key of ["viewport", "output", "theme", "audio"])
    config[key] = { ...DEFAULTS[key], ...user[key] };
  if (!config.baseUrl) throw new Error("The config needs a baseUrl, such as http://localhost:3000.");
  if (!config.scenes?.length && !config.loop)
    throw new Error("The config needs at least one scene.");
  const keys = new Set(["intro", "outro"]);
  for (const scene of config.scenes ?? []) {
    if (!/^[a-z0-9-]+$/.test(scene.key ?? ""))
      throw new Error(`Scene key "${scene.key}" must use lowercase letters, digits and hyphens.`);
    if (keys.has(scene.key)) throw new Error(`The scene key "${scene.key}" is taken.`);
    keys.add(scene.key);
  }
  config.dir = path.dirname(configPath);
  config.output.dir = path.resolve(config.dir, config.output.dir);
  return config;
}

const url = (config, pathname = "/") => new URL(pathname, config.baseUrl).href;
const fromConfig = (config, file) => (file ? path.resolve(config.dir, file) : undefined);

/** The intro, scenes and outro in order, as segments with a shared shape. */
function segments(config) {
  return [
    ...(config.intro ? [{ key: "intro", kind: "card", ...config.intro }] : []),
    ...config.scenes.map((s) => ({ kind: "scene", ...s })),
    ...(config.outro ? [{ key: "outro", kind: "card", ...config.outro }] : []),
  ];
}

/** Seconds a segment must stay up so its voice-over finishes, if it has one. */
function holdSeconds(config, segment) {
  const audio = fromConfig(config, segment.voiceover);
  if (audio && !existsSync(audio)) throw new Error(`Voice-over file ${audio} does not exist.`);
  return Math.max(segment.minSeconds ?? 0, audio ? duration(audio) + 0.6 : 0);
}

/**
 * Normalizes a recorded clip to the output size and draws its fades: in
 * where the curtain opened, out so the screen is dark where it closed.
 */
function encodeClip(config, dir, marks, file, limitSeconds) {
  const base = clipFilter(config.output);
  const color = `0x${config.theme.background.replace("#", "")}`;
  const d = config.fadeMs / 1000;
  let graph = `[0:v]${base}[v]`;
  if (marks?.open !== undefined) {
    const out =
      marks.close !== undefined
        ? `,fade=t=out:st=${Math.max(0, marks.close - marks.open - d).toFixed(3)}:d=${d}:color=${color}`
        : "";
    graph = [
      `[0:v]${base},split=2[a][b]`,
      `[a]trim=end=${marks.open.toFixed(3)},setpts=PTS-STARTPTS[card]`,
      `[b]trim=start=${marks.open.toFixed(3)},setpts=PTS-STARTPTS,fade=t=in:st=0:d=${d}:color=${color}${out}[screen]`,
      "[card][screen]concat=n=2:v=1:a=0[v]",
    ].join(";");
  }
  ffmpeg([
    ...["-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt")],
    ...["-filter_complex", graph, "-map", "[v]"],
    ...(limitSeconds ? ["-t", String(limitSeconds)] : []),
    ...CLIP_FLAGS,
    file,
  ]);
}

async function openStage(config, workDir) {
  const page = await Browser.launch({
    viewport: config.viewport,
    pixelRatio: config.pixelRatio,
    profileDir: path.join(workDir, "profile"),
  });
  await page.colorScheme(config.theme.colorScheme);
  const stage = new Stage(page, {
    theme: config.theme,
    hide: config.hide,
    pace: config.pace,
    pixelRatio: config.pixelRatio,
    viewport: config.viewport,
  });
  if (config.signIn) await config.signIn({ page, baseUrl: config.baseUrl });
  return { page, stage };
}

async function recordTour(config, keys, workDir) {
  const { page, stage } = await openStage(config, workDir);
  const goto = async (pathname) => {
    await page.goto(url(config, pathname), { busy: config.busy });
    if (config.prepare) await config.prepare(page);
  };
  try {
    for (const segment of segments(config).filter((s) => keys.includes(s.key))) {
      const dir = path.join(workDir, "clips", segment.key);
      const hold = holdSeconds(config, segment) * 1000;
      if (segment.kind === "card") {
        await goto(segment.path);
        await stage.inject({ cursor: false });
        await stage.record(dir);
        await stage.curtain(false, segment, 300);
        const shown = Date.now();
        await stage.curtainText(true, segment.holdMs ?? (segment.key === "intro" ? 2800 : 3400));
        await sleep(hold - (Date.now() - shown));
        if (segment.key === "intro") await stage.curtainText(false, 500);
      } else {
        await goto(segment.path);
        await stage.inject({ cursor: segment.cursor !== false });
        await stage.record(dir);
        if (segment.card) {
          await stage.curtain(false, segment.card, 250);
          await stage.curtainText(true, config.cardMs);
          await stage.curtainText(false, 350);
        } else {
          // No card: start on the background color and fade straight in
          await stage.curtain(false, { title: "" }, 250);
        }
        // The export fades in over this wait and out over the one after the
        // caption hides, so keep both still
        const opened = Date.now();
        await stage.curtain(true, undefined, config.fadeMs);
        if (segment.caption)
          await stage.caption({ ...segment.card, subtitle: segment.caption });
        await segment.act(stage, page);
        // Hold the last frame until the voice-over or minimum time is done
        await sleep(hold - (Date.now() - opened) - config.fadeMs);
        await stage.caption(null);
        await sleep(config.fadeMs);
        await stage.curtain(false, { title: "" }, 150);
      }
      const { seconds, marks } = await stage.stop();
      const file = path.join(workDir, "encoded", `${segment.key}.mp4`);
      encodeClip(config, dir, marks, file);
      const length = duration(file);
      // Where the screen shows, in seconds of this clip, for the timeline
      writeFileSync(
        file.replace(/\.mp4$/, ".json"),
        JSON.stringify({ seconds: length, screenStart: marks.open ?? 0, screenEnd: marks.close ?? length }),
      );
      console.log(`Recorded ${segment.key}: ${seconds.toFixed(1)}s`);
    }
  } finally {
    await page.close();
  }
}

const words = (text) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

/** When every segment starts and ends in the finished video. */
function buildTimeline(config, workDir) {
  let at = 0;
  return segments(config).map((segment) => {
    const metaFile = path.join(workDir, "encoded", `${segment.key}.json`);
    if (!existsSync(metaFile))
      throw new Error(`No recording for ${segment.key}. Run without --export and keys to record everything.`);
    const meta = JSON.parse(readFileSync(metaFile, "utf8"));
    const entry = {
      key: segment.key,
      title: segment.card?.title ?? segment.title ?? "",
      start: at,
      screenStart: at + (segment.kind === "card" ? 0 : meta.screenStart),
      screenEnd: at + (segment.kind === "card" ? meta.seconds : meta.screenEnd),
      end: at + meta.seconds,
      narration: segment.narration ?? "",
      voiceover: fromConfig(config, segment.voiceover),
    };
    // Narration starts once the screen shows, or with the card on cards
    entry.speakFrom = segment.kind === "card" ? entry.start + 0.4 : entry.screenStart + 0.3;
    entry.budgetWords = Math.floor((entry.screenEnd - entry.speakFrom) * WORDS_PER_SECOND);
    at = entry.end;
    return entry;
  });
}

const clock = (s) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor(ms / 60_000) % 60).padStart(2, "0");
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
};

/** A voice-over sheet: each segment's window, word budget and narration. */
function writeScript(config, timeline, total) {
  const rows = timeline.map((t) => {
    const used = words(t.narration);
    const status = !t.narration
      ? "not written"
      : t.voiceover
        ? "audio set; the scene holds until it ends"
        : used > t.budgetWords
          ? `over by ${used - t.budgetWords} words: trim, or set minSeconds or a voiceover file`
          : "fits";
    return [
      `## ${t.key}${t.title ? `: ${t.title}` : ""}`,
      "",
      `- Segment: ${clock(t.start)} to ${clock(t.end)}`,
      `- Speak from ${clock(t.speakFrom)} to ${clock(t.screenEnd)}, about ${t.budgetWords} words`,
      `- Narration: ${used} words, ${status}`,
      "",
      t.narration ? `> ${t.narration}` : "> (write narration here, then copy it into the config)",
      "",
    ].join("\n");
  });
  const file = path.join(config.dir, `${config.output.name}.script.md`);
  writeFileSync(
    file,
    [
      `# Voice-Over Script: ${config.output.name}`,
      "",
      `Total length ${clock(total)}. Budgets assume about ${Math.round(WORDS_PER_SECOND * 60)} words a minute.`,
      "Generated by make.mjs: edit narration in the config, not here.",
      "",
      ...rows,
    ].join("\n"),
  );
  writeFileSync(path.join(config.dir, `${config.output.name}.timeline.json`), JSON.stringify(timeline, null, 2));
  return file;
}

/** WebVTT captions for the narration, one cue per sentence. */
function writeCaptions(config, timeline) {
  const cues = [];
  for (const t of timeline.filter((x) => x.narration)) {
    const length = t.voiceover
      ? duration(t.voiceover)
      : Math.min(words(t.narration) / WORDS_PER_SECOND, t.end - t.speakFrom);
    const sentences = t.narration.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g).map((s) => s.trim());
    const chars = sentences.reduce((sum, s) => sum + s.length, 0);
    let from = t.speakFrom;
    for (const sentence of sentences) {
      const to = from + (length * sentence.length) / chars;
      cues.push(`${clock(from)} --> ${clock(to)}\n${sentence}`);
      from = to;
    }
  }
  if (!cues.length) return null;
  const file = path.join(config.output.dir, `${config.output.name}.vtt`);
  writeFileSync(file, `WEBVTT\n\n${cues.join("\n\n")}\n`);
  console.log(file);
  return file;
}

/**
 * Mixes the soundtrack: each segment's voice-over at its speaking time, an
 * optional single voice-over file, and optional looped background music.
 * Returns null when the video has no audio.
 */
function mixAudio(config, timeline, total, workDir) {
  const voices = timeline.filter((t) => t.voiceover).map((t) => ({ file: t.voiceover, at: t.speakFrom }));
  const single = fromConfig(config, config.audio.voiceover);
  if (single) voices.push({ file: single, at: config.audio.voiceoverAt ?? 0 });
  const music = fromConfig(config, config.audio.music);
  if (!voices.length && !music) return null;
  for (const f of [...voices.map((v) => v.file), music].filter(Boolean))
    if (!existsSync(f)) throw new Error(`Audio file ${f} does not exist.`);

  const inputs = ["-f", "lavfi", "-t", total.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"];
  const chains = [];
  const labels = ["[0]"];
  voices.forEach((v, i) => {
    inputs.push("-i", v.file);
    const ms = Math.round(v.at * 1000);
    chains.push(`[${i + 1}]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
    labels.push(`[v${i}]`);
  });
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", music);
    const volume = config.audio.musicVolume ?? (voices.length ? 0.15 : 0.35);
    const fadeAt = Math.max(0, total - 2.5).toFixed(3);
    chains.push(
      `[${voices.length + 1}]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total.toFixed(3)},volume=${volume},afade=t=in:d=1.5,afade=t=out:st=${fadeAt}:d=2.5[m]`,
    );
    labels.push("[m]");
  }
  chains.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=first,atrim=0:${total.toFixed(3)}[a]`);
  const file = path.join(workDir, "mix.wav");
  ffmpeg([...inputs, "-filter_complex", chains.join(";"), "-map", "[a]", file]);
  return file;
}

/**
 * Writes one output under a temporary name, then swaps it in, so a page that
 * is open during an export never loads a half-written video.
 */
function writeOutput(file, args) {
  const partial = path.join(path.dirname(file), `.partial-${path.basename(file)}`);
  ffmpeg([...args, partial]);
  renameSync(partial, file);
  console.log(`${file}  ${(statSync(file).size / 1e6).toFixed(1)} MB`);
}

function exportFiles(config, master, name, audio) {
  mkdirSync(config.output.dir, { recursive: true });
  const base = path.join(config.output.dir, name);
  for (const format of config.output.formats) {
    const flags = FORMATS[format];
    if (!flags) throw new Error(`Unknown output format "${format}". Use mp4 or webm.`);
    writeOutput(`${base}.${format}`, [
      "-i", master,
      ...(audio ? ["-i", audio, "-map", "0:v", "-map", "1:a", ...flags.audio.split(" "), "-shortest"] : ["-an"]),
      ...flags.video.split(" "),
      ...COLOR_TAGS,
    ]);
  }
  writeOutput(`${base}-poster.jpg`, [
    ...["-ss", String(config.output.posterAt), "-i", master],
    ...["-frames:v", "1", "-q:v", "3"],
  ]);
  return `${base}.${config.output.formats[0]}`;
}

function exportTour(config, workDir) {
  const timeline = buildTimeline(config, workDir);
  const list = path.join(workDir, "order.txt");
  writeFileSync(
    list,
    timeline.map((t) => `file '${path.join(workDir, "encoded", `${t.key}.mp4`)}'`).join("\n"),
  );
  const master = path.join(workDir, "tour-master.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", master]);
  const total = duration(master);
  const script = writeScript(config, timeline, total);
  mkdirSync(config.output.dir, { recursive: true });
  writeCaptions(config, timeline);
  const audio = mixAudio(config, timeline, total, workDir);
  const file = exportFiles(config, master, config.output.name, audio);
  console.log(`\nVoice-over sheet: ${script}`);
  return file;
}

async function recordLoop(config, keys, workDir) {
  const { page, stage } = await openStage(config, workDir);
  const seconds = config.loop.seconds ?? 6;
  try {
    for (const clip of config.loop.clips.filter((c) => !keys.length || keys.includes(c.key))) {
      const dir = path.join(workDir, "loop", clip.key);
      await page.goto(url(config, clip.path), { busy: config.busy });
      if (config.prepare) await config.prepare(page);
      await stage.inject({ cursor: false });
      await page.eval(`__pv.curtain.remove(), window.scrollTo(0, ${clip.scrollFrom ?? 0}), true`);
      await stage.record(dir);
      await sleep(700);
      if (clip.act) await clip.act(stage, page);
      else await stage.scroll(clip.scrollBy ?? 300, ((seconds - 1.6) * 1000) / config.pace);
      await sleep(900);
      const result = await stage.stop();
      if (result.seconds < seconds)
        throw new Error(`Loop clip ${clip.key} is ${result.seconds.toFixed(1)}s, shorter than ${seconds}s.`);
      encodeClip(config, dir, null, path.join(workDir, "loop", `${clip.key}.mp4`), seconds);
      console.log(`Recorded loop ${clip.key}`);
    }
  } finally {
    await page.close();
  }
}

/**
 * Crossfades the loop clips in order, then back into the first one, and
 * trims so the last frame leads straight into the first.
 */
function exportLoop(config, workDir) {
  const seconds = config.loop.seconds ?? 6;
  const fade = config.loop.crossfade ?? 0.8;
  const clips = config.loop.clips.map((c) => path.join(workDir, "loop", `${c.key}.mp4`));
  const missing = config.loop.clips.filter((_, i) => !existsSync(clips[i]));
  if (missing.length)
    throw new Error(`No loop recording for ${missing.map((c) => c.key).join(", ")}. Run with --loop and no keys.`);
  const inputs = [...clips, clips[0]];
  const steps = [];
  let label = "0";
  for (let i = 1; i < inputs.length; i++) {
    const offset = (seconds - fade) * i;
    steps.push(`[${label}][${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[x${i}]`);
    label = `x${i}`;
  }
  const end = (seconds - fade) * (inputs.length - 1) + fade;
  steps.push(`[${label}]trim=start=${fade}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[v]`);
  const master = path.join(workDir, "loop-master.mp4");
  ffmpeg([
    ...inputs.flatMap((file) => ["-i", file]),
    ...["-filter_complex", steps.join(";"), "-map", "[v]"],
    ...CLIP_FLAGS,
    master,
  ]);
  return exportFiles(config, master, config.loop.name ?? `${config.output.name}-loop`, null);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log(USAGE);
    process.exit(args.length ? 0 : 1);
  }
  const loop = args.includes("--loop");
  const exportOnly = args.includes("--export");
  const [configArg, ...keys] = args.filter((a) => !a.startsWith("--"));
  const configPath = path.resolve(configArg);
  if (!existsSync(configPath)) throw new Error(`No config file at ${configPath}.`);
  const mod = await import(pathToFileURL(configPath).href);
  const config = resolveConfig(mod.default ?? mod, configPath);

  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  const workDir = path.join(os.tmpdir(), "product-video", `${path.basename(config.dir)}-${hash}`);
  mkdirSync(path.join(workDir, "encoded"), { recursive: true });

  if (!exportOnly) {
    const alive = await fetch(config.baseUrl).then((r) => r.status < 500, () => false);
    if (!alive) throw new Error(`Nothing answers at ${config.baseUrl}. Start the app first.`);
  }

  if (loop) {
    if (!config.loop?.clips?.length) throw new Error("The config has no loop.clips to record.");
    if (!exportOnly) await recordLoop(config, keys, workDir);
    const file = exportLoop(config, workDir);
    console.log(`Check it: node ${path.join(import.meta.dirname, "check.mjs")} ${file}`);
    return;
  }

  const order = segments(config).map((s) => s.key);
  const unknown = keys.filter((k) => !order.includes(k));
  if (unknown.length) throw new Error(`Unknown segments: ${unknown.join(", ")}. Use: ${order.join(", ")}.`);
  if (!exportOnly) await recordTour(config, keys.length ? keys : order, workDir);
  const file = exportTour(config, workDir);
  console.log(`Check it: node ${path.join(import.meta.dirname, "check.mjs")} ${file}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
