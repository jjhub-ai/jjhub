/**
 * Shared time formatting utilities.
 *
 * - Items less than 7 days old use relative time ("2 hours ago").
 * - Items older than 7 days use absolute date ("Mar 9, 2026").
 */

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 0) return "just now";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  // Older than 7 days: use absolute date
  return formatAbsoluteDate(date);
}

export function formatAbsoluteDate(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[date.getMonth()]!;
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();

  if (year === currentYear) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${year}`;
}

export function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString();
}
