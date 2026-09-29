import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A minimal Chrome DevTools Protocol driver for a headless Chromium browser.
// No dependencies: it needs Node 22+ (global fetch and WebSocket) or Bun.

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LINUX = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
  "brave",
  "brave-browser",
  "microsoft-edge",
];
const MAC = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const WINDOWS = [
  ["Google", "Chrome", "Application", "chrome.exe"],
  ["Chromium", "Application", "chrome.exe"],
  ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
  ["Microsoft", "Edge", "Application", "msedge.exe"],
];

const onPath = (command) =>
  (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((dir) => path.join(dir, command))
    .find((file) => existsSync(file));

/** Path to a Chromium-based browser: CHROMIUM_PATH, then common installs. */
export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (process.platform === "darwin") return MAC.find((file) => existsSync(file));
  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    for (const parts of WINDOWS)
      for (const root of roots) {
        const file = path.join(root, ...parts);
        if (existsSync(file)) return file;
      }
    return undefined;
  }
  for (const command of LINUX) {
    const file = onPath(command);
    if (file) return file;
  }
  return undefined;
}

export class Browser {
  #ws;
  #seq = 0;
  #pending = new Map();
  #handlers = new Map();
  #proc;

  /**
   * Starts a headless browser that lays pages out at `viewport` CSS pixels
   * and renders them at `pixelRatio`, then attaches to its tab.
   */
  static async launch({ viewport, pixelRatio, profileDir, port = 9333 }) {
    const executable = findChromium();
    if (!executable)
      throw new Error(
        "No Chrome, Chromium, Brave or Edge found. Install one or set CHROMIUM_PATH.",
      );
    const browser = new Browser();
    browser.#proc = spawn(
      executable,
      [
        "--headless=new",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir ?? path.join(os.tmpdir(), "product-video-profile")}`,
        `--window-size=${viewport.width},${viewport.height}`,
        // Without this, screencast frames arrive at 1x even with emulation
        `--force-device-scale-factor=${pixelRatio}`,
        "--hide-scrollbars",
        "--font-render-hinting=none",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let url;
    for (let i = 0; i < 100 && !url; i++) {
      try {
        const targets = await (
          await fetch(`http://127.0.0.1:${port}/json/list`)
        ).json();
        url = targets.find((t) => t.type === "page")?.webSocketDebuggerUrl;
      } catch {
        // The browser is still starting
      }
      if (!url) await sleep(100);
    }
    if (!url) {
      browser.#proc.kill();
      throw new Error(
        `The browser did not open its debugging port ${port}. Close other browsers using that port or pass another.`,
      );
    }

    browser.#ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      browser.#ws.addEventListener("open", resolve, { once: true });
      browser.#ws.addEventListener("error", reject, { once: true });
    });
    browser.#ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id) {
        const pending = browser.#pending.get(msg.id);
        browser.#pending.delete(msg.id);
        if (msg.error) pending?.reject(new Error(msg.error.message));
        else pending?.resolve(msg.result);
      } else if (msg.method) {
        for (const handler of browser.#handlers.get(msg.method) ?? [])
          handler(msg.params);
      }
    });
    await browser.send("Page.enable");
    await browser.send("Runtime.enable");
    await browser.send("Emulation.setDeviceMetricsOverride", {
      ...viewport,
      deviceScaleFactor: pixelRatio,
      mobile: false,
    });
    return browser;
  }

  send(method, params = {}) {
    const id = ++this.#seq;
    this.#ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.#pending.set(id, { resolve, reject }),
    );
  }

  on(event, handler) {
    this.#handlers.set(event, [...(this.#handlers.get(event) ?? []), handler]);
  }

  off(event) {
    this.#handlers.delete(event);
  }

  /** Emulates `prefers-color-scheme` for sites that follow the system theme. */
  async colorScheme(value) {
    await this.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value }],
    });
  }

  /** Runs a JavaScript expression in the page and returns its value. */
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  }

  /**
   * Opens a URL and waits until it loaded, no element matches `busy`
   * (spinners, skeletons) and fonts are ready.
   */
  async goto(url, { busy, settleMs = 900 } = {}) {
    const loaded = new Promise((resolve) =>
      this.on("Page.loadEventFired", resolve),
    );
    await this.send("Page.navigate", { url });
    await Promise.race([loaded, sleep(30_000)]);
    this.off("Page.loadEventFired");
    const busyCheck = busy ? `!document.querySelector(${JSON.stringify(busy)})` : "true";
    for (let i = 0; i < 130; i++) {
      const ready = await this.eval(
        `document.readyState === "complete" && ${busyCheck}`,
      ).catch(() => false);
      if (ready) break;
      await sleep(150);
    }
    await this.eval("document.fonts.ready.then(() => true)").catch(() => {});
    await sleep(settleMs);
  }

  async mouse(type, x, y) {
    await this.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: type === "mouseMoved" ? "none" : "left",
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
  }

  /** Clicks the first element matching a CSS selector, without the fake cursor. */
  async click(selector) {
    const point = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    })()`);
    if (!point) throw new Error(`No element matches ${selector}.`);
    await this.mouse("mousePressed", point.x, point.y);
    await this.mouse("mouseReleased", point.x, point.y);
  }

  /** Focuses a field and types text into it, as a person would. */
  async fill(selector, text) {
    const found = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.focus();
      el.select?.();
      return true;
    })()`);
    if (!found) throw new Error(`No field matches ${selector}.`);
    await this.send("Input.insertText", { text });
  }

  /** Presses one key, such as Enter or Tab, in the focused element. */
  async press(key) {
    for (const type of ["keyDown", "keyUp"])
      await this.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: key === "Enter" ? 13 : key === "Tab" ? 9 : 0,
      });
  }

  /** Sets cookies, for example a session cookie your app issued. */
  async setCookies(cookies) {
    await this.send("Network.setCookies", { cookies });
  }

  async close() {
    await this.send("Browser.close").catch(() => {});
    this.#proc.kill();
  }
}
