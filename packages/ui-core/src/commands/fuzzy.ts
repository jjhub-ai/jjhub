/**
 * Fuzzy matching for the command palette.
 *
 * Shared between the web UI and TUI so both surfaces rank results identically.
 * The algorithm scores candidates by matching a query against the command label
 * and its keyword list, rewarding:
 *   - exact matches (highest)
 *   - prefix matches
 *   - word-boundary matches
 *   - consecutive character matches
 *   - substring matches
 *   - sparse fuzzy matches (lowest)
 */

import type { CommandDefinition } from "./index";

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function isWordBoundary(text: string, index: number): boolean {
    if (index === 0) return true;
    const prev = text[index - 1] ?? "";
    return /[\s/_.:\-]/.test(prev);
}

/**
 * Score a single query against a single candidate string.
 * Returns -1 when no match is found, otherwise a positive number
 * where higher = better match.
 */
export function fuzzyScoreString(query: string, candidate: string): number {
    const needle = normalize(query);
    const haystack = normalize(candidate);

    if (!needle) return 0;

    // Exact match
    if (haystack === needle) return 1000;

    // Prefix match
    if (haystack.startsWith(needle)) return 500 + needle.length;

    // Contains as substring
    const substringIndex = haystack.indexOf(needle);
    if (substringIndex !== -1) {
        const bonus = isWordBoundary(haystack, substringIndex) ? 100 : 0;
        return 200 + bonus + needle.length;
    }

    // Fuzzy character-by-character matching
    let score = 0;
    let searchIndex = 0;
    let previousMatch = -1;

    for (const char of needle) {
        const matchIndex = haystack.indexOf(char, searchIndex);
        if (matchIndex === -1) return -1; // no match

        score += 1;
        // Consecutive characters bonus
        if (matchIndex === previousMatch + 1) {
            score += 4;
        }
        // Word boundary bonus
        if (isWordBoundary(haystack, matchIndex)) {
            score += 6;
        }

        searchIndex = matchIndex + 1;
        previousMatch = matchIndex;
    }

    // Penalize long haystacks slightly
    score -= Math.max(0, haystack.length - needle.length) * 0.05;

    return score;
}

/**
 * Score a query against a CommandDefinition by checking the label
 * and all keywords, returning the best score found.
 */
export function fuzzyScoreCommand(query: string, command: CommandDefinition): number {
    const needle = normalize(query);
    if (!needle) return 0;

    // Score against label
    let best = fuzzyScoreString(needle, command.label);

    // Score against each keyword
    for (const kw of command.keywords) {
        const kwScore = fuzzyScoreString(needle, kw);
        if (kwScore > best) {
            best = kwScore;
        }
    }

    // Score against id (allows typing "lr-new", "issue-new", etc.)
    const idScore = fuzzyScoreString(needle, command.id);
    if (idScore > best) {
        best = idScore;
    }

    return best;
}

export interface FuzzyMatchResult {
    command: CommandDefinition;
    score: number;
}

/**
 * Filter and rank commands by fuzzy matching against a query string.
 * Returns commands sorted by relevance (best match first).
 *
 * When the query is empty, returns all commands in their original order.
 */
export function fuzzyMatch(query: string, commands: CommandDefinition[]): CommandDefinition[] {
    const needle = normalize(query);

    if (!needle) return commands;

    const scored: FuzzyMatchResult[] = [];

    for (const cmd of commands) {
        const score = fuzzyScoreCommand(needle, cmd);
        if (score > 0) {
            scored.push({ command: cmd, score });
        }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.map((r) => r.command);
}
