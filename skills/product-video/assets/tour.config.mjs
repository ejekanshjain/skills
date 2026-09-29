// Product video config. Copy this file into the project (for example
// video/tour.config.mjs), fill it in, then run:
//
//   node <skill>/scripts/make.mjs video/tour.config.mjs
//   node <skill>/scripts/make.mjs video/tour.config.mjs answers   (re-record one scene)
//   node <skill>/scripts/make.mjs video/tour.config.mjs --loop    (short silent loop)
//
// Coordinates are CSS pixels inside `viewport`. Prefer `s.find("visible text")`
// over fixed coordinates so scenes survive layout changes.

export default {
  // The running app. Record against local or staging, never production data.
  baseUrl: "http://localhost:3000",

  // Layout size in CSS pixels, rendered at pixelRatio for sharp text.
  // 1440x810 looks like a laptop and stays readable at 1080p.
  viewport: { width: 1440, height: 810 },
  pixelRatio: 2,

  output: {
    // Relative to this config file. Point it at the site's public folder.
    dir: "../public/video",
    name: "product-tour",
    width: 1920,
    height: 1080,
    formats: ["mp4", "webm"],
    // Poster frame, in seconds: the intro card once its text is visible
    posterAt: 2.2,
  },

  // Cards and captions. Use the brand's dark color and accent.
  theme: {
    background: "#111827",
    text: "#ffffff",
    accent: "#a3e635",
    font: "Inter, ui-sans-serif, system-ui, sans-serif",
    colorScheme: "light",
    captionPosition: "bottom-left",
  },

  // Dev-only overlays to hide while recording (Next.js tools, debug badges)
  hide: ["nextjs-portal"],
  // Optional: runs after each page loads, before recording. Use it for
  // overlays no selector can reach, or to dismiss banners.
  async prepare(page) {
    await page.eval(`document.querySelector("#cookie-banner")?.remove(), true`);
  },
  // Anything matching this means the page is still loading
  busy: '[aria-busy="true"], .animate-pulse',

  // Multiplier on cursor moves, scrolls and pauses. Lower is faster.
  pace: 0.75,
  // Fade between cards and the app, drawn at export time
  fadeMs: 900,
  // How long each step's title card stays up
  cardMs: 1000,

  // Signs in once before recording. Use a demo account, never a real one.
  // `page` offers goto, fill, click, press, eval, send and setCookies.
  async signIn({ page, baseUrl }) {
    await page.goto(`${baseUrl}/login`);
    await page.fill('input[type="email"]', "demo@example.com");
    await page.fill('input[type="password"]', "demo-password");
    await page.press("Enter");
    await page.goto(`${baseUrl}/dashboard`);
  },

  // Opening and closing cards. `path` is the app page they render on (the
  // card covers it); use a page where `logo` loads.
  intro: {
    path: "/",
    logo: "/logo-dark.svg",
    title: "Your Headline Promise",
    subtitle: "One sentence on what the product does for the viewer.",
    holdMs: 2800,
  },
  outro: {
    path: "/",
    logo: "/logo-dark.svg",
    title: "Your Call to Action",
    subtitle: "Start free, or book a demo.",
    holdMs: 3400,
  },

  // One scene per step of the story. Each shows its card, fades into
  // `path`, shows the caption, runs `act`, then fades back to the card color.
  scenes: [
    {
      key: "dashboard",
      path: "/dashboard",
      card: {
        num: "01",
        title: "See Where You Stand",
        subtitle: "The outcome this screen gives the viewer.",
      },
      caption: "A short line that stays on screen during the step.",
      // s: move(x, y, ms), click(x?, y?), scroll(dy, ms, container?),
      //    pause(ms), find(text), caption(card), page (the browser)
      act: async (s) => {
        const tile = await s.find("Revenue");
        await s.move(tile.x, tile.y, 900);
        await s.pause(700);
        await s.scroll(400, 1400);
        await s.pause(1200);
      },
    },
  ],

  // Optional short silent loop for a hero section: no cursor, captions or
  // cards, crossfaded and seamless. Record it with --loop.
  loop: {
    seconds: 6,
    crossfade: 0.8,
    clips: [
      { key: "dashboard", path: "/dashboard", scrollFrom: 0, scrollBy: 300 },
    ],
  },
};
