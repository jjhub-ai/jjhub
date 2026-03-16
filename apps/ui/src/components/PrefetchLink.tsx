import { A } from "@solidjs/router";
import { splitProps, type JSX } from "solid-js";
import { createHoverPrefetchHandlers, type PrefetchHandle } from "../lib/prefetchCache";

type PrefetchLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: () => PrefetchHandle | void;
    prefetchDelayMs?: number;
};

export default function PrefetchLink(props: PrefetchLinkProps) {
    const [local, rest] = splitProps(props, [
        "prefetch",
        "prefetchDelayMs",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
    ]);

    const handlers = createHoverPrefetchHandlers(
        () => local.prefetch?.(),
        { delayMs: local.prefetchDelayMs },
    );

    return (
        <A
            {...rest}
            onMouseEnter={(event) => {
                handlers.onMouseEnter();
                if (typeof local.onMouseEnter === "function") {
                    local.onMouseEnter(event);
                }
            }}
            onMouseLeave={(event) => {
                handlers.onMouseLeave();
                if (typeof local.onMouseLeave === "function") {
                    local.onMouseLeave(event);
                }
            }}
            onFocus={(event) => {
                handlers.onFocus();
                if (typeof local.onFocus === "function") {
                    local.onFocus(event);
                }
            }}
            onBlur={(event) => {
                handlers.onBlur();
                if (typeof local.onBlur === "function") {
                    local.onBlur(event);
                }
            }}
        />
    );
}
