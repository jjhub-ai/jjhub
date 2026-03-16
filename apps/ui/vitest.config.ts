import { defineConfig, mergeConfig } from "vitest/config";
import createViteConfig from "./vite.config";

export default mergeConfig(createViteConfig({
    command: "serve",
    mode: "test",
    isSsrBuild: false,
    isPreview: false,
}), defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
    },
}));
