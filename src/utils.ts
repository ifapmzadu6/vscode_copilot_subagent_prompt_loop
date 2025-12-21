
/**
 * robustly extracts JSON from a string that might contain markdown or other text
 */
export function extractJson<T>(text: string): T | null {
    try {
        // First try to parse the whole string
        return JSON.parse(text) as T;
    } catch {
        // Try to find a JSON block
        const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonBlockMatch) {
            try {
                return JSON.parse(jsonBlockMatch[1]) as T;
            } catch {
                // continue
            }
        }

        // Try to find the first '{' and the last '}'
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            try {
                const potentialJson = text.substring(firstOpen, lastClose + 1);
                return JSON.parse(potentialJson) as T;
            } catch {
                // continue
            }
        }

        return null;
    }
}
