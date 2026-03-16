import type { Component } from "solid-js";
import {
    Activity,
    Asterisk,
    BarChart2,
    BookMarked,
    BookOpen,
    Bot,
    CheckCircle2,
    Cloud,
    FileDiff,
    FileText,
    FolderOpen,
    GitCommit,
    GitGraph,
    GitMerge,
    Inbox,
    Key,
    KeyRound,
    Lock,
    Play,
    Search,
    Server,
    Settings,
    Shield,
    TerminalSquare,
    Wrench,
} from "lucide-solid";
import { RESERVED_FIRST_SEGMENTS } from "./repoContext";

const PINNED_PAGE_ICONS = {
    Activity,
    Asterisk,
    BarChart2,
    BookMarked,
    BookOpen,
    Bot,
    CheckCircle2,
    Cloud,
    FileDiff,
    FileText,
    FolderOpen,
    GitCommit,
    GitGraph,
    GitMerge,
    Inbox,
    Key,
    KeyRound,
    Lock,
    Play,
    Search,
    Server,
    Settings,
    Shield,
    TerminalSquare,
    Wrench,
} as const;

export type PinnedPageIconKey = keyof typeof PINNED_PAGE_ICONS;

export function isPinnedPageIconKey(value: unknown): value is PinnedPageIconKey {
    return typeof value === "string" && value in PINNED_PAGE_ICONS;
}

type PinnedPageDescriptor = {
    title: string;
    icon: PinnedPageIconKey;
};

type IconComponent = Component<{ class?: string; size?: number; title?: string }>;

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizePathname(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }

    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed || "/";
}

function humanizeSegment(segment: string): string {
    const decoded = safeDecode(segment).replace(/[-_]+/g, " ").trim();
    if (!decoded) {
        return "Page";
    }

    return decoded
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatRepoLabel(owner: string, repo: string): string {
    return `${safeDecode(owner)}/${safeDecode(repo)}`;
}

function describeRepoRoute(parsed: URL, segments: string[]): PinnedPageDescriptor | null {
    if (segments.length < 2 || RESERVED_FIRST_SEGMENTS.has(segments[0])) {
        return null;
    }

    const [owner, repo, ...rest] = segments;
    const repoLabel = formatRepoLabel(owner, repo);

    if (rest.length === 0) {
        return {
            title: repoLabel,
            icon: "FolderOpen",
        };
    }

    const [section, detail, tail] = rest;

    switch (section) {
        case "issues":
            if (detail === "new") {
                return { title: `${repoLabel} · New issue`, icon: "CheckCircle2" };
            }
            if (detail) {
                return { title: `${repoLabel} · Issue #${safeDecode(detail)}`, icon: "CheckCircle2" };
            }
            return { title: `${repoLabel} · Issues`, icon: "CheckCircle2" };
        case "landings":
            if (detail) {
                return { title: `${repoLabel} · Landing ${safeDecode(detail)}`, icon: "GitMerge" };
            }
            return { title: `${repoLabel} · Landing requests`, icon: "GitMerge" };
        case "workflows":
            if (detail === "runs" && tail) {
                return { title: `${repoLabel} · Run ${safeDecode(tail)}`, icon: "Play" };
            }
            return { title: `${repoLabel} · Workflows`, icon: "Play" };
        case "wiki":
            if (detail === "new") {
                return { title: `${repoLabel} · New wiki page`, icon: "BookOpen" };
            }
            if (tail === "edit") {
                return { title: `${repoLabel} · Edit ${safeDecode(detail)}`, icon: "BookOpen" };
            }
            if (detail) {
                return { title: `${repoLabel} · ${safeDecode(detail)}`, icon: "BookOpen" };
            }
            return { title: `${repoLabel} · Wiki`, icon: "BookOpen" };
        case "keys":
            return { title: `${repoLabel} · Deploy keys`, icon: "Key" };
        case "changes":
            return { title: `${repoLabel} · Changes`, icon: "GitCommit" };
        case "bookmarks":
            if (detail) {
                return { title: `${repoLabel} · Bookmark ${safeDecode(detail)}`, icon: "BookMarked" };
            }
            return { title: `${repoLabel} · Bookmarks`, icon: "BookMarked" };
        case "conflicts":
            return { title: `${repoLabel} · Conflicts`, icon: "FileDiff" };
        case "graph":
            return { title: `${repoLabel} · Graph`, icon: "GitGraph" };
        case "code": {
            const filePath = parsed.searchParams.get("path");
            const ref = parsed.searchParams.get("ref");
            const refSuffix = ref ? ` @ ${safeDecode(ref)}` : "";
            if (filePath) {
                return { title: `${repoLabel} · ${safeDecode(filePath)}${refSuffix}`, icon: "FileText" };
            }
            return { title: `${repoLabel} · Files${refSuffix}`, icon: "FolderOpen" };
        }
        case "terminal":
            return { title: `${repoLabel} · Terminal`, icon: "TerminalSquare" };
        case "snapshots":
            return { title: `${repoLabel} · Snapshots`, icon: "Bot" };
        case "sessions":
            if (detail) {
                return { title: `${repoLabel} · Session ${safeDecode(detail)}`, icon: "Bot" };
            }
            return { title: `${repoLabel} · Sessions`, icon: "Bot" };
        case "settings":
            return { title: `${repoLabel} · Settings`, icon: "Settings" };
        default:
            return {
                title: `${repoLabel} · ${rest.map(humanizeSegment).join(" / ")}`,
                icon: "FileText",
            };
    }
}

function describeTopLevelRoute(segments: string[]): PinnedPageDescriptor {
    if (segments.length === 0) {
        return { title: "Repositories", icon: "FolderOpen" };
    }

    switch (segments[0]) {
        case "inbox":
            return { title: "Inbox", icon: "Inbox" };
        case "workspaces":
            return { title: "Workspaces", icon: "Cloud" };
        case "integrations":
            return {
                title: segments[1] ? `Integrations · ${humanizeSegment(segments[1])}` : "Integrations",
                icon: "Server",
            };
        case "queue":
            return { title: "Landing queue", icon: "Activity" };
        case "readout":
            return { title: "Readout", icon: "BarChart2" };
        case "search":
            return { title: "Search", icon: "Search" };
        case "repo":
            return { title: "New repository", icon: "FolderOpen" };
        case "orgs":
            if (segments[1] === "new") {
                return { title: "New organization", icon: "Settings" };
            }
            if (segments[2] === "settings") {
                return { title: `${safeDecode(segments[1])} · Organization settings`, icon: "Settings" };
            }
            if (segments[2] === "teams") {
                if (segments[3]) {
                    return { title: `${safeDecode(segments[1])} · Team ${safeDecode(segments[3])}`, icon: "Shield" };
                }
                return { title: `${safeDecode(segments[1])} · Teams`, icon: "Shield" };
            }
            break;
        case "settings": {
            const section = segments[1];
            if (section === "keys") {
                return { title: "SSH keys", icon: "Key" };
            }
            if (section === "tokens") {
                return { title: "API tokens", icon: "KeyRound" };
            }
            if (section === "secrets") {
                return { title: "Secrets", icon: "Lock" };
            }
            if (section === "variables") {
                return { title: "Variables", icon: "Asterisk" };
            }
            if (section === "notifications") {
                return { title: "Notifications", icon: "Inbox" };
            }
            if (section === "applications") {
                return { title: "Applications", icon: "Settings" };
            }
            if (section === "emails") {
                return { title: "Emails", icon: "Settings" };
            }
            if (section === "accounts") {
                return { title: "Connected accounts", icon: "Settings" };
            }
            if (section === "alpha") {
                return { title: "Alpha access", icon: "Settings" };
            }
            return { title: "Settings", icon: "Settings" };
        }
        case "tools":
            if (segments[1] === "skills") {
                return { title: "Agent skills", icon: "Wrench" };
            }
            if (segments[1] === "policies") {
                return { title: "Policies", icon: "Shield" };
            }
            return { title: "Tools", icon: "Wrench" };
        case "admin":
            return {
                title: segments[1] ? `Admin · ${humanizeSegment(segments[1])}` : "Admin",
                icon: "Shield",
            };
        case "users":
            return { title: `@${safeDecode(segments[1] ?? "user")}`, icon: "FileText" };
        case "login":
            return { title: "Login", icon: "Lock" };
        case "marketing":
            return { title: "Marketing", icon: "FileText" };
        case "waitlist":
            return { title: "Waitlist", icon: "FileText" };
        case "thank-you":
            return { title: "Thank you", icon: "FileText" };
        case "coming-soon":
            return { title: "Coming soon", icon: "FileText" };
        case "sessions":
            return { title: "Sessions", icon: "Bot" };
    }

    if (segments.length === 1) {
        return { title: `@${safeDecode(segments[0])}`, icon: "FileText" };
    }

    return {
        title: segments.map(humanizeSegment).join(" / "),
        icon: "FileText",
    };
}

export function normalizePinnedPageUrl(url: string): string {
    const parsed = new URL(url, "https://jjhub.local");
    const pathname = normalizePathname(parsed.pathname);
    return `${pathname}${parsed.search}`;
}

export function describePinnedPage(url: string): { icon?: PinnedPageIconKey; title: string; url: string } {
    const normalizedUrl = normalizePinnedPageUrl(url);
    const parsed = new URL(normalizedUrl, "https://jjhub.local");
    const segments = normalizePathname(parsed.pathname)
        .split("/")
        .filter(Boolean);

    const descriptor = describeRepoRoute(parsed, segments) ?? describeTopLevelRoute(segments);

    return {
        icon: descriptor.icon,
        title: descriptor.title,
        url: normalizedUrl,
    };
}

export function getPinnedPageIcon(icon?: string): IconComponent {
    if (!icon) {
        return PINNED_PAGE_ICONS.FileText;
    }

    const resolved = PINNED_PAGE_ICONS[icon as PinnedPageIconKey];
    return resolved ?? PINNED_PAGE_ICONS.FileText;
}
