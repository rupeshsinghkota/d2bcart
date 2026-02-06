
/**
 * Supplier Research Module (Free Version)
 * Uses DuckDuckGo HTML scraping to find potential suppliers.
 * Extracts: Name, Phone, Website, Location.
 */

// import * as cheerio from 'cheerio'; // We might need to install this or use regex
// If cheerio isn't available, we'll use basic regex parsing for now to avoid install steps if possible.
// Actually, standard regex is often enough for simple DDG HTML.

export interface DiscoveredSupplier {
    name: string;
    phone: string | null;
    website: string | null;
    location: string | null;
    description: string;
    source: string;
}

// Helper to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    addLog(`[Research] Searching for suppliers in category (Free Mode): ${category} in ${location}`);
    const results: DiscoveredSupplier[] = [];

    try {
        // Search Queries - Reduced count to avoid rate limits
        const queries = [
            `Top wholesalers for ${category} in ${location} contact number`,
            `Manufacturers of ${category} in ${location} contact`,
            `${category} wholesale market ${location} phone number`
        ];

        for (const q of queries) {
            try {
                // Use LITE version which is often less blocked
                // Query param is 'q'
                const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;

                // Random delay between 2s and 5s
                const delay = Math.floor(Math.random() * 3000) + 2000;
                addLog(`[Research] Waiting ${delay}ms before next query...`);
                await sleep(delay);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://lite.duckduckgo.com/',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    cache: 'no-store'
                });

                const html = await response.text();
                addLog(`[Research] Query: "${q}" | HTML Length: ${html.length}`);

                if (html.length < 1000) {
                    addLog(`[Research] WARNING: Blocked. Body snippet: ${html.substring(0, 100)}`);
                }

                // Lite version parsing
                // Search for phone numbers in the entire raw text first
                // Then try to extract context
                const phoneMatch = Array.from(html.matchAll(/((\+91|91|0)?[6-9][0-9]{9})/g));
                addLog(`[Research] matches found: ${phoneMatch.length}`);

                const phonesFoundInThisStep = new Set<string>();

                for (const match of phoneMatch) {
                    const rawPhone = match[0];
                    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

                    if (cleanPhone.length >= 10 && cleanPhone.length <= 12) {
                        if (phonesFoundInThisStep.has(cleanPhone)) continue;
                        phonesFoundInThisStep.add(cleanPhone);

                        const index = match.index || 0;
                        const surroundingText = html.substring(Math.max(0, index - 150), Math.min(html.length, index + 150));

                        // Clean up text
                        const cleanText = surroundingText
                            .replace(/<[^>]*>/g, ' ') // Strip HTML
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();

                        // Fallback name logic
                        let name = `${category} Supplier`;
                        // Try to find a capitalized sequence before the number
                        const nameMatch = cleanText.split(rawPhone)[0].match(/([A-Z][a-zA-Z0-9&]+(?:\s[A-Z][a-zA-Z0-9&]+){0,4})/g);
                        if (nameMatch && nameMatch.length > 0) {
                            // Pick the last realistic looking name part before the phone
                            name = nameMatch[nameMatch.length - 1];
                        }

                        results.push({
                            name: name.substring(0, 50), // Truncate if too long
                            phone: cleanPhone,
                            website: null,
                            location: location,
                            description: cleanText.substring(0, 200),
                            source: "DuckDuckGo Lite"
                        });
                    }
                }

            } catch (err) {
                addLog(`[Research] Failed query: ${q} - ${(err as Error).message}`);
            }
        }

        // De-duplicate by phone across all queries
        const unique = new Map();
        for (const item of results) {
            if (!unique.has(item.phone)) {
                unique.set(item.phone, item);
            }
        }

        const finalResults = Array.from(unique.values()).slice(0, 10); // increased limit
        addLog(`[Research] Found ${finalResults.length} unique suppliers.`);
        return { suppliers: finalResults, logs };

    } catch (error) {
        addLog(`[Research] Critical Error: ${(error as Error).message}`);
        return { suppliers: [], logs };
    }
}
