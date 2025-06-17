/**
 * Parses a flexible timeframe string (e.g., "7d", "1m", "3w", "24h")
 * and returns concrete start and end dates.
 * @param timeframe The string to parse.
 * @returns An object with { startDate, endDate } as ISO strings, or null if invalid.
 */
export function parseTimeframe(timeframe: string): { startDate: string; endDate: string } | null {
    const now = new Date();
    const endDate = new Date(now); // End date is always 'today'

    // Regex to capture a number and a unit (d, w, m, h)
    const match = timeframe.toLowerCase().match(/^(\d+)\s*(d|w|m|h)/);

    if (!match) {
        // Handle special cases like "last week"
        if (timeframe.includes("week")) return parseTimeframe("7d");
        if (timeframe.includes("month")) return parseTimeframe("1m");
        return null; // Invalid format
    }

    const quantity = parseInt(match[1], 10);
    const unit = match[2];
    const startDate = new Date(now);

    switch (unit) {
        case 'd':
            startDate.setDate(now.getDate() - quantity);
            break;
        case 'w':
            startDate.setDate(now.getDate() - quantity * 7);
            break;
        case 'm':
            startDate.setMonth(now.getMonth() - quantity);
            break;
        case 'h':
            startDate.setHours(now.getHours() - quantity);
            break;
        default:
            return null; // Should not happen with the regex
    }

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
    };
}