import { fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@solidjs/router", () => {
    const Anchor = (props: any) => <a {...props}>{props.children}</a>;
    return { A: Anchor };
});

import PrefetchLink from "./PrefetchLink";

describe("PrefetchLink", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("starts prefetch after the hover debounce", async () => {
        const prefetch = vi.fn(() => ({ cancel: vi.fn() }));

        render(() => (
            <PrefetchLink href="/alice/demo/issues" prefetch={prefetch}>
                Issues
            </PrefetchLink>
        ));

        await fireEvent.mouseEnter(screen.getByRole("link", { name: "Issues" }));
        expect(prefetch).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(50);

        expect(prefetch).toHaveBeenCalledTimes(1);
    });

    it("cancels an in-flight prefetch when the hover ends", async () => {
        const cancel = vi.fn();
        const prefetch = vi.fn(() => ({ cancel }));

        render(() => (
            <PrefetchLink href="/alice/demo/issues" prefetch={prefetch}>
                Issues
            </PrefetchLink>
        ));

        const link = screen.getByRole("link", { name: "Issues" });
        await fireEvent.mouseEnter(link);
        await vi.advanceTimersByTimeAsync(50);
        await fireEvent.mouseLeave(link);

        expect(prefetch).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
