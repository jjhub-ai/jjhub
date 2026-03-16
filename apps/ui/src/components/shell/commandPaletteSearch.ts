export type CommandPaletteSearchItem = {
    label: string;
    sublabel?: string;
};

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function isWordStart(value: string, index: number): boolean {
    if (index === 0) {
        return true;
    }

    return /[\s/_.:-]/.test(value[index - 1] ?? '');
}

export function fuzzyScore(query: string, candidate: string): number {
    const needle = normalize(query);
    const haystack = normalize(candidate);

    if (!needle) {
        return 0;
    }

    let score = 0;
    let searchIndex = 0;
    let previousMatch = -1;

    for (const char of needle) {
        const matchIndex = haystack.indexOf(char, searchIndex);
        if (matchIndex === -1) {
            return -1;
        }

        score += 1;
        if (matchIndex === previousMatch + 1) {
            score += 4;
        }
        if (isWordStart(haystack, matchIndex)) {
            score += 6;
        }

        searchIndex = matchIndex + 1;
        previousMatch = matchIndex;
    }

    score -= Math.max(0, haystack.length - needle.length) * 0.05;

    return score;
}

export function filterPaletteItems<T extends CommandPaletteSearchItem>(items: T[], query: string): T[] {
    const needle = normalize(query);
    if (!needle) {
        return items;
    }

    return items
        .map((item, index) => ({
            item,
            index,
            score: fuzzyScore(needle, `${item.label} ${item.sublabel ?? ''}`),
        }))
        .filter((entry) => entry.score >= 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map((entry) => entry.item);
}
