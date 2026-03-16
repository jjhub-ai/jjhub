import { afterEach, describe, expect, it, vi } from "vitest";
import { createShortcutRegistry } from "./index";

describe("shortcut registry", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("registers shortcuts and exposes their keys", () => {
        const registry = createShortcutRegistry({});

        registry.registerShortcut("nav.repos", {
            label: "Go to repositories",
            category: "Navigation",
            keys: [["G", "R"]],
        });

        expect(registry.getShortcut("nav.repos")).toMatchObject({
            label: "Go to repositories",
            category: "Navigation",
        });
        expect(registry.getShortcutKeys("nav.repos")).toEqual([["G", "R"]]);
        expect(registry.listKeyboardShortcuts("default")).toEqual([
            {
                id: "nav.repos",
                label: "Go to repositories",
                category: "Navigation",
                keys: [["G", "R"]],
            },
        ]);
    });

    it("formats platform-specific shortcuts and filters by category", () => {
        const registry = createShortcutRegistry({});

        registry.registerShortcut("palette.open", {
            label: "Open command palette",
            category: "Workbench",
            keys: {
                default: [["Ctrl", "K"]],
                mac: [["Cmd", "K"]],
            },
        });
        registry.registerShortcut("nav.inbox", {
            label: "Go to inbox",
            category: "Navigation",
            keys: [["G", "N"]],
        });

        expect(registry.getShortcutText("palette.open", "mac")).toBe("⌘+K");
        expect(registry.getShortcutText("palette.open", "default")).toBe("Ctrl+K");
        expect(registry.getShortcutsByCategory("Navigation")).toEqual([
            expect.objectContaining({ id: "nav.inbox", label: "Go to inbox" }),
        ]);
    });

    it("warns and overwrites duplicate registrations", () => {
        const registry = createShortcutRegistry({});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        registry.registerShortcut("help.open", {
            label: "Open shortcuts",
            category: "Workbench",
            keys: [["?"]],
        });
        registry.registerShortcut("help.open", {
            label: "Show keyboard shortcuts",
            category: "Workbench",
            keys: [["Shift", "/"]],
        });

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(registry.getShortcut("help.open")).toMatchObject({
            label: "Show keyboard shortcuts",
        });
        expect(registry.getShortcutKeys("help.open")).toEqual([["Shift", "/"]]);
    });
});
