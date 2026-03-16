export function formatIssueLabelColor(color: string): string {
    return `#${color.trim().replace(/^#/, "")}`;
}
