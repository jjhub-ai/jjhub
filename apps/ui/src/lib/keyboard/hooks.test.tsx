// @vitest-environment jsdom
import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    requestSearchFocus,
    useListNavigation,
    useSearchFocusTarget,
    useSingleKeyShortcuts,
} from "./index";

type ListItem = {
    id: string;
    label: string;
};

const LIST_ITEMS: ListItem[] = [
    { id: "repo-1", label: "Repo 1" },
    { id: "repo-2", label: "Repo 2" },
];

describe("keyboard hooks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        cleanup();
    });

    it("clamps list navigation and supports multi-select shortcuts", () => {
        let navigation:
            | ReturnType<typeof useListNavigation<ListItem>>
            | undefined;

        function Harness() {
            navigation = useListNavigation({
                items: () => LIST_ITEMS,
                onOpen: vi.fn(),
                getItemId: (item) => item.id,
            });

            return (
                <div>
                    {LIST_ITEMS.map((item, index) => (
                        <button
                            ref={(element) => navigation?.setItemRef(index, element)}
                            type="button"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            );
        }

        render(() => <Harness />);

        expect(navigation?.selectedIndex()).toBe(0);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
        expect(navigation?.selectedIndex()).toBe(0);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
        expect(navigation?.selectedIndex()).toBe(1);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        expect(navigation?.selectedIndex()).toBe(1);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
        expect(navigation?.selectedItemIds()).toEqual(["repo-2"]);

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(navigation?.selectedItemIds()).toEqual([]);
    });

    it("marks search focus as handled when a target consumes the event", () => {
        const focusSpy = vi.fn();

        function Harness() {
            useSearchFocusTarget(focusSpy);
            return <div>search target</div>;
        }

        render(() => <Harness />);

        expect(requestSearchFocus()).toBe(true);
        expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it("falls back when no enabled search target handles the event", () => {
        const focusSpy = vi.fn();

        function Harness() {
            useSearchFocusTarget(focusSpy, () => false);
            return <div>disabled search target</div>;
        }

        render(() => <Harness />);

        expect(requestSearchFocus()).toBe(false);
        expect(focusSpy).not.toHaveBeenCalled();
    });

    it("ignores editable targets and modifier keys for single-key shortcuts", () => {
        const actionSpy = vi.fn();

        function Harness() {
            useSingleKeyShortcuts({
                bindings: () => [{ key: "c", action: actionSpy }],
            });

            return <input aria-label="Comment input" />;
        }

        render(() => <Harness />);

        const input = screen.getByRole("textbox", { name: "Comment input" });
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
        expect(actionSpy).not.toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }));
        expect(actionSpy).not.toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
        expect(actionSpy).toHaveBeenCalledTimes(1);
    });
});
