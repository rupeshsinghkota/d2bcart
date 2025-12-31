// Native fetch is available in Node 18+

async function simulateWebhook() {
    const url = 'http://localhost:3000/api/webhooks/shiprocket';

    // Use an AWB that exists in your database or a dummy one if you just want to test the endpoint logic
    // Ideally, find a real order's AWB from the Admin Panel first.
    // For now, I'll use a placeholder. The logs will tell us if "No order found" or "Update failed".
    const payload = {
        awb: 'TEST_AWB_12345',
        current_status: 'DELIVERED',
        current_status_id: 7,
        shipment_id: 123456
    };

    console.log('Sending Webhook Payload:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Shiprocket sends a specific token usually, but our code currently doesn't verify x-shiprocket-token
                // 'x-shiprocket-token': '...' 
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', response.status, data);
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
}

simulateWebhook();
