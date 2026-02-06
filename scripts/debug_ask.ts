
async function debugAsk() {
    const q = "mobile accessories wholesalers Delhi contact numbers";
    const url = `https://www.ask.com/web?q=${encodeURIComponent(q)}`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        const html = await res.text();
        console.log("Raw HTML Length:", html.length);

        const cleanText = html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, " ")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, " ")
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log("Clean Text Length:", cleanText.length);
        console.log("Snippet (first 1000):", cleanText.substring(0, 1000));

        const phoneMatches = cleanText.match(/[6-9][0-9]{9}/g);
        console.log("Phone Numbers Found:", phoneMatches?.length || 0);
        if (phoneMatches) {
            console.log("Unique Phones Found:", [...new Set(phoneMatches)].slice(0, 10));
        }
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

debugAsk();
