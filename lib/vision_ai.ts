/**
 * Vision AI Module for Supplier Sourcing Agent
 * Uses OpenAI GPT-4o Vision to analyze images
 */

import OpenAI from 'openai';

let openai: OpenAI | null = null;

function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

export interface VisitingCardData {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    gst_number?: string;
    address?: string;
}

export interface ProductAnalysis {
    products: {
        name: string;
        description?: string;
        estimated_category?: string;
    }[];
    is_catalog: boolean;
    has_prices: boolean;
    extracted_prices?: { product: string; price: string; moq?: string }[];
}

/**
 * Analyze a product/catalog image
 */
export async function analyzeProductImage(imageUrl: string): Promise<ProductAnalysis> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are a product analyst for a wholesale mobile accessories business.
Analyze the image and extract product information.

RESPOND IN JSON FORMAT:
{
  "products": [{"name": "...", "description": "...", "estimated_category": "..."}],
  "is_catalog": true/false,
  "has_prices": true/false,
  "extracted_prices": [{"product": "...", "price": "...", "moq": "..."}]
}

Categories: Mobile Covers, Screen Guards, Chargers, Cables, Earphones, Power Banks, Accessories`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this product image:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 1000
        });

        const content = response.choices[0].message.content || "{}";
        return JSON.parse(content);
    } catch (e) {
        console.error("[Vision AI] Product analysis failed:", e);
        return { products: [], is_catalog: false, has_prices: false };
    }
}

/**
 * Extract data from a visiting card image
 */
export async function extractVisitingCard(imageUrl: string): Promise<VisitingCardData> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an OCR specialist. Extract all information from this visiting card.

RESPOND IN JSON FORMAT:
{
  "name": "Person's name",
  "company": "Company name",
  "phone": "Phone number (include country code if visible)",
  "email": "Email address",
  "gst_number": "GST/GSTIN number if visible",
  "address": "Full address"
}

If a field is not visible, omit it from the response.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract information from this visiting card:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 500
        });

        const content = response.choices[0].message.content || "{}";
        return JSON.parse(content);
    } catch (e) {
        console.error("[Vision AI] Visiting card extraction failed:", e);
        return {};
    }
}

/**
 * Extract prices from a price list image
 */
export async function extractPriceList(imageUrl: string): Promise<{ product: string; price: string; moq?: string }[]> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are a price list extractor. Extract all product prices from this image.

RESPOND IN JSON FORMAT:
{
  "prices": [
    {"product": "Product name", "price": "Price in INR", "moq": "Minimum order quantity if mentioned"}
  ]
}

If prices are in ranges, use the lower price. Include currency symbol.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract all prices from this price list:" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
                    ]
                }
            ],
            max_tokens: 2000
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        return parsed.prices || [];
    } catch (e) {
        console.error("[Vision AI] Price list extraction failed:", e);
        return [];
    }
}

/**
 * Detect what type of image this is
 */
export async function detectImageType(imageUrl: string): Promise<'visiting_card' | 'catalog' | 'price_list' | 'product' | 'document' | 'unknown'> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini", // Cheaper for classification
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Classify this image into ONE category:
- visiting_card: A business card with contact details
- catalog: Multiple products displayed
- price_list: Text/table with prices
- product: Single product photo
- document: GST certificate, invoice, or other document
- unknown: Cannot classify

RESPOND IN JSON: {"type": "category_name"}`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What type of image is this?" },
                        { type: "image_url", image_url: { url: imageUrl, detail: "low" } }
                    ]
                }
            ],
            max_tokens: 50
        });

        const content = response.choices[0].message.content || "{}";
        const parsed = JSON.parse(content);
        return parsed.type || 'unknown';
    } catch (e) {
        console.error("[Vision AI] Image type detection failed:", e);
        return 'unknown';
    }
}
