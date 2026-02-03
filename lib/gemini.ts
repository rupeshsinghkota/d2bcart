
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function getSalesAssistantResponse(params: {
    message: string,
    history?: any[],
    context?: string
}) {
    const { message } = params;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [
            {
                role: "system",
                content: "You are the D2BCart AI Sales Assistant. D2BCart is a B2B platform for mobile accessories (Cases, Covers, Screen Guards, Chargers). Help retailers find products. Be Professional, Polite, Concise (Max 2 sentences for WhatsApp). Categories: Cases & Covers, Screen Guards, Chargers & Cables, Earphones, Power Banks. Website: https://d2bcart.com"
            },
            {
                role: "user",
                content: message
            }
        ]
    });

    return response.choices[0].message.content || "Sorry, I couldn't process that. Please try again.";
}
