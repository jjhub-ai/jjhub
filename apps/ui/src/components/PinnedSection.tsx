import { For, createSignal } from "solid-js";
import { useStore } from "@nanostores/solid";
import { GripVertical, X } from "lucide-solid";
import { getPinnedPageIcon, normalizePinnedPageUrl } from "../lib/pinnedPages";
import { $pinnedPages, movePinnedPage, removePinnedPage } from "../stores/pinned-pages";

interface PinnedSectionProps {
    activeUrl: string;
}

export default function PinnedSection(props: PinnedSectionProps) {
    const $pages = useStore($pinnedPages);
    const [draggedUrl, setDraggedUrl] = createSignal<string | null>(null);
    const [dropTargetUrl, setDropTargetUrl] = createSignal<string | null>(null);

    const activeUrl = () => normalizePinnedPageUrl(props.activeUrl);

    const handleDrop = (targetUrl: string) => {
        const currentPages = $pages();
        const fromIndex = currentPages.findIndex((page) => page.url === draggedUrl());
        const toIndex = currentPages.findIndex((page) => page.url === targetUrl);

        if (fromIndex >= 0 && toIndex >= 0) {
            movePinnedPage(fromIndex, toIndex);
        }

        setDraggedUrl(null);
        setDropTargetUrl(null);
    };

    return (
        <div class="nav-group mb-2 pinned-group">
            <div class="nav-group-title">
                <span class="nav-label">Pinned</span>
            </div>

            <For each={$pages()}>
                {(page) => {
                    const Icon = getPinnedPageIcon(page.icon);

                    return (
                        <div
                            class="pinned-item-row"
                            classList={{
                                "is-dragging": draggedUrl() === page.url,
                                "is-drop-target": dropTargetUrl() === page.url,
                            }}
                            data-url={page.url}
                            draggable
                            onDragEnd={() => {
                                setDraggedUrl(null);
                                setDropTargetUrl(null);
                            }}
                            onDragOver={(event) => {
                                event.preventDefault();
                                if (draggedUrl() && draggedUrl() !== page.url) {
                                    setDropTargetUrl(page.url);
                                }
                            }}
                            onDragStart={(event) => {
                                setDraggedUrl(page.url);
                                if (event.dataTransfer) {
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", page.url);
                                }
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                handleDrop(page.url);
                            }}
                        >
                            <a
                                href={page.url}
                                class={`nav-item pinned-item ${activeUrl() === page.url ? "active" : ""}`}
                                title={page.title}
                            >
                                <span class="pin-drag-handle" aria-hidden="true">
                                    <GripVertical size={14} />
                                </span>
                                <Icon size={16} class="flex-shrink-0 text-muted" />
                                <span class="nav-label truncate">{page.title}</span>
                            </a>
                            <button
                                type="button"
                                class="pin-unpin-btn"
                                aria-label={`Unpin ${page.title}`}
                                onClick={() => removePinnedPage(page.url)}
                                title={`Unpin ${page.title}`}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    );
                }}
            </For>
        </div>
    );
}
