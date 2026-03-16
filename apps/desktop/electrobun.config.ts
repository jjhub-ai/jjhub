import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "JJHub",
    identifier: "tech.jjhub.app",
    version: "0.0.1",
  },
  runtime: {
    // Keep the app running when the window is closed (tray app behavior)
    exitOnLastWindowClosed: false,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/index.css": "views/mainview/index.css",
    },
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
