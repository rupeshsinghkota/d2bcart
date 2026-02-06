
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

export async function findSuppliers(category: string, location: string = "India"): Promise<{ suppliers: DiscoveredSupplier[], logs: string[] }> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    addLog(`[Research] Searching for suppliers in category (Free Mode): ${category} in ${location}`);
    const results: DiscoveredSupplier[] = [];

    try {
        // Search Queries designed to surface contact numbers
        const queries = [
            `Top wholesalers for ${category} in ${location} contact number`,
            `Manufacturers of ${category} in ${location} contact`,
            `${category} supplier phone number ${location}`,
            `Wholesale market for ${category} in ${location}`
        ];

        for (const q of queries) {
            try {
                // DuckDuckGo HTML endpoint is easier to scrape than Google
                const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://duckduckgo.com/',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-User': '?1'
                    },
                    cache: 'no-store'
                });
                const html = await response.text();
                addLog(`[Research] Query: "${q}" | HTML Length: ${html.length}`);

                // Check for block
                if (html.length < 500) {
                    addLog(`[Research] WARNING: Blocked. content: ${html.substring(0, 200)}`);
                }

                // Simple Regex Extraction from HTML text
                // Look for snippets that have 10 digit numbers
                const snippetRegex = /class="result__snippet".*?>(.*?)<\/a>/g;
                const titleRegex = /class="result__a".*?>(.*?)<\/a>/g;

                // Hacky parse since we don't assume cheerio is installed yet
                // We'll just scan the raw HTML for phone patterns + context

                const phonesFound = new Set<string>();
                const phoneMatch = Array.from(html.matchAll(/((\+91|91|0)?[6-9][0-9]{9})/g));
                addLog(`[Research] matches found: ${phoneMatch.length}`);

                for (const match of phoneMatch) {
                    const rawPhone = match[0];
                    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

                    // Filter strict length
                    if (cleanPhone.length >= 10 && cleanPhone.length <= 12) {
                        if (phonesFound.has(cleanPhone)) continue;
                        phonesFound.add(cleanPhone);

                        // Try to find context (Name near the phone)
                        // This is rough but works for "free"
                        const index = match.index || 0;
                        const surroundingText = html.substring(Math.max(0, index - 100), Math.min(html.length, index + 100));

                        // Remove HTML tags for clean text
                        const cleanText = surroundingText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

                        // Guess name from text before phone
                        // e.g. "Contact Royal Traders at 98..."
                        const nameMatch = cleanText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/);
                        const name = nameMatch ? nameMatch[0] : `${category} Supplier`;

                        results.push({
                            name: name,
                            phone: cleanPhone,
                            website: null,
                            location: location,
                            description: cleanText,
                            source: "DuckDuckGo Search"
                        });
                    }
                }

            } catch (err) {
                addLog(`[Research] Failed query: ${q} - ${(err as Error).message}`);
            }
        }

        // De-duplicate by phone
        const unique = new Map();
        for (const item of results) {
            if (!unique.has(item.phone)) {
                unique.set(item.phone, item);
            }
        }

        const finalResults = Array.from(unique.values()).slice(0, 5); // Limit to top 5
        addLog(`[Research] Found ${finalResults.length} unique suppliers.`);
        return { suppliers: finalResults, logs };

    } catch (error) {
        addLog(`[Research] Critical Error: ${(error as Error).message}`);
        return { suppliers: [], logs };
    }
}
