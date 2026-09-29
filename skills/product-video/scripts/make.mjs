#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Browser, sleep } from "./browser.mjs";
import { Stage } from "./stage.mjs";

const USAGE = `Record a product video from a running web app.

  node make.mjs <config.mjs> [scene keys...] [--loop]

  <config.mjs>   tour config (start from assets/tour.config.mjs)
  scene keys     re-record only these scenes, reuse the rest, then export
  --loop         record and export the short silent loop instead of the tour

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
  },
  hide: ["nextjs-portal"],
  busy: '[aria-busy="true"]',
  pace: 0.75,
  fadeMs: 900,
  cardMs: 1000,
};

// Encoder settings. Lower CRF means higher quality and larger files.
// Screencast frames are full-range JPEGs; convert them to the limited-range
// BT.709 color every web video uses, or some GPU decoders reject the file.
const COLOR_TAGS = "-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv".split(" ");
const clipFilter = (o) =>
  `fps=30,scale=${o.width}:${o.height}:flags=lanczos:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p`;
const CLIP_FLAGS = ["-c:v", "libx264", "-crf", "10", "-preset", "fast", ...COLOR_TAGS];
const FORMAT_FLAGS = {
  mp4: "-c:v libx264 -profile:v high -crf 23 -preset veryslow -tune stillimage -pix_fmt yuv420p -movflags +faststart -an",
  webm: "-c:v libvpx-vp9 -crf 44 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an",
};

function ffmpeg(args) {
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  if (run.error) throw new Error("ffmpeg is not installed, so the video cannot be encoded.");
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr.trim()}`);
}

/** Merges user config over defaults, one level deep for nested groups. */
function resolveConfig(user, configPath) {
  const config = { ...DEFAULTS, ...user };
  for (const key of ["viewport", "output", "theme"])
    config[key] = { ...DEFAULTS[key], ...user[key] };
  if (!config.baseUrl) throw new Error("The config needs a baseUrl, such as http://localhost:3000.");
  if (!config.scenes?.length && !config.loop)
    throw new Error("The config needs at least one scene.");
  const keys = new Set();
  for (const scene of config.scenes ?? []) {
    if (!/^[a-z0-9-]+$/.test(scene.key ?? ""))
      throw new Error(`Scene key "${scene.key}" must use lowercase letters, digits and hyphens.`);
    if (keys.has(scene.key)) throw new Error(`Two scenes use the key "${scene.key}".`);
    keys.add(scene.key);
  }
  config.output.dir = path.resolve(path.dirname(configPath), config.output.dir);
  return config;
}

const url = (config, pathname = "/") => new URL(pathname, config.baseUrl).href;

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

function exportFiles(config, master, name) {
  mkdirSync(config.output.dir, { recursive: true });
  const base = path.join(config.output.dir, name);
  for (const format of config.output.formats) {
    if (!FORMAT_FLAGS[format]) throw new Error(`Unknown output format "${format}". Use mp4 or webm.`);
    writeOutput(`${base}.${format}`, ["-i", master, ...FORMAT_FLAGS[format].split(" "), ...COLOR_TAGS]);
  }
  writeOutput(`${base}-poster.jpg`, [
    ...["-ss", String(config.output.posterAt), "-i", master],
    ...["-frames:v", "1", "-q:v", "3"],
  ]);
  return `${base}.${config.output.formats[0]}`;
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
    for (const key of keys) {
      const dir = path.join(workDir, "clips", key);
      if (key === "intro" || key === "outro") {
        const card = config[key];
        await goto(card.path);
        await stage.inject({ cursor: false });
        await stage.record(dir);
        await stage.curtain(false, card, 300);
        await stage.curtainText(true, card.holdMs ?? (key === "intro" ? 2800 : 3400));
        if (key === "intro") await stage.curtainText(false, 500);
      } else {
        const scene = config.scenes.find((s) => s.key === key);
        await goto(scene.path);
        await stage.inject();
        await stage.record(dir);
        await stage.curtain(false, scene.card, 250);
        await stage.curtainText(true, config.cardMs);
        await stage.curtainText(false, 350);
        // The export fades in over this wait and out over the one after the
        // caption hides, so keep both still
        await stage.curtain(true, undefined, config.fadeMs);
        if (scene.caption)
          await stage.caption({ ...scene.card, subtitle: scene.caption });
        await scene.act(stage, page);
        await stage.caption(null);
        await sleep(config.fadeMs);
        await stage.curtain(false, { title: "" }, 150);
      }
      const { seconds, marks } = await stage.stop();
      encodeClip(config, dir, marks, path.join(workDir, "encoded", `${key}.mp4`));
      console.log(`Recorded ${key}: ${seconds.toFixed(1)}s`);
    }
  } finally {
    await page.close();
  }
}

function exportTour(config, order, workDir) {
  const clips = order.map((key) => path.join(workDir, "encoded", `${key}.mp4`));
  const missing = order.filter((_, i) => !existsSync(clips[i]));
  if (missing.length)
    throw new Error(`No recording for ${missing.join(", ")}. Run without scene keys to record everything.`);
  const list = path.join(workDir, "order.txt");
  writeFileSync(list, clips.map((file) => `file '${file}'`).join("\n"));
  const master = path.join(workDir, "tour-master.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", master]);
  return exportFiles(config, master, config.output.name);
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
      await stage.scroll(clip.scrollBy ?? 300, (seconds - 1.6) * 1000 / config.pace);
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
  return exportFiles(config, master, config.loop.name ?? `${config.output.name}-loop`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log(USAGE);
    process.exit(args.length ? 0 : 1);
  }
  const loop = args.includes("--loop");
  const [configArg, ...keys] = args.filter((a) => a !== "--loop");
  const configPath = path.resolve(configArg);
  if (!existsSync(configPath)) throw new Error(`No config file at ${configPath}.`);
  const mod = await import(pathToFileURL(configPath).href);
  const config = resolveConfig(mod.default ?? mod, configPath);

  const alive = await fetch(config.baseUrl).then((r) => r.status < 500, () => false);
  if (!alive) throw new Error(`Nothing answers at ${config.baseUrl}. Start the app first.`);

  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  const workDir = path.join(os.tmpdir(), "product-video", `${path.basename(path.dirname(configPath))}-${hash}`);
  mkdirSync(path.join(workDir, "encoded"), { recursive: true });

  if (loop) {
    if (!config.loop?.clips?.length) throw new Error("The config has no loop.clips to record.");
    await recordLoop(config, keys, workDir);
    const file = exportLoop(config, workDir);
    console.log(`\nCheck it: node ${path.join(import.meta.dirname, "check.mjs")} ${file}`);
    return;
  }

  const order = [
    ...(config.intro ? ["intro"] : []),
    ...config.scenes.map((s) => s.key),
    ...(config.outro ? ["outro"] : []),
  ];
  const unknown = keys.filter((k) => !order.includes(k));
  if (unknown.length) throw new Error(`Unknown scenes: ${unknown.join(", ")}. Use: ${order.join(", ")}.`);
  await recordTour(config, keys.length ? order.filter((k) => keys.includes(k)) : order, workDir);
  const file = exportTour(config, order, workDir);
  console.log(`\nCheck it: node ${path.join(import.meta.dirname, "check.mjs")} ${file}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
