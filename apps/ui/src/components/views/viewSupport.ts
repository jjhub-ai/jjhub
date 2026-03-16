export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const payload = await response.clone().json();
        if (typeof payload === "string" && payload.trim()) {
            return payload;
        }
        if (payload && typeof payload === "object") {
            if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
                return payload.message;
            }
            if ("error" in payload) {
                if (typeof payload.error === "string" && payload.error.trim()) {
                    return payload.error;
                }
                if (
                    payload.error &&
                    typeof payload.error === "object" &&
                    "message" in payload.error &&
                    typeof payload.error.message === "string" &&
                    payload.error.message.trim()
                ) {
                    return payload.error.message;
                }
            }
        }
    } catch {
        // Fall through to text parsing.
    }

    try {
        const text = (await response.text()).trim();
        if (text) {
            return text;
        }
    } catch {
        // Ignore text parse failures.
    }

    return `${fallback} (${response.status})`;
}

export function formatDateTime(value?: string | Date | null): string {
    if (!value) {
        return "Unknown";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatRelativeDate(value?: string | Date | null): string {
    if (!value) {
        return "Unknown";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    const diff = Date.now() - date.getTime();
    if (diff < 60_000) {
        return "Just now";
    }
    if (diff < 3_600_000) {
        return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
    }
    if (diff < 86_400_000) {
        return `${Math.max(1, Math.round(diff / 3_600_000))}h ago`;
    }
    if (diff < 172_800_000) {
        return "Yesterday";
    }
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function splitLines(value: string): string[] {
    return value
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

export function daysAgoISOString(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

export function shortSha(value?: string | null): string {
    if (!value) {
        return "unknown";
    }
    return value.slice(0, 12);
}
