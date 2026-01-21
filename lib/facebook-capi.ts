export async function sendFacebookEvent(eventName: string, eventData: any, userData: any) {
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || '881326567810044';
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN; // Needs to be added to .env

    if (!accessToken) {
        console.warn('Facebook CAPI: No Access Token found. Skipping event.');
        return;
    }

    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: {
                    em: [hash(userData.email)],
                    ph: [hash(userData.phone)],
                    fbp: userData.fbp, // Browser ID if available
                    fbc: userData.fbc, // Click ID if available
                },
                custom_data: eventData
            }
        ]
    };

    try {
        const res = await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
            console.error('Facebook CAPI Error:', data.error);
        } else {
            console.log('Facebook CAPI Success:', data);
        }
    } catch (error) {
        console.error('Facebook CAPI Request Failed:', error);
    }
}

function hash(value: string | undefined): string | null {
    if (!value) return null;
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
