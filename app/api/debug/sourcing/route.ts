
import { NextRequest, NextResponse } from 'next/server';
import { findSuppliers } from '@/lib/research';
import { getSourcingAgentResponse } from '@/lib/sourcing_agent';
import { sendWhatsAppMessage } from '@/lib/msg91';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, category, supplier } = body;

        console.log(`[Debug Sourcing] Action: ${action}`);

        if (action === 'research') {
            const suppliers = await findSuppliers(category);
            return NextResponse.json({ success: true, suppliers });
        }

        if (action === 'initiate_chat') {
            const { name, phone } = supplier;
            // Simulate initiating chat via Agent Logic

            const aiRes = await getSourcingAgentResponse({
                message: "", // Empty to trigger greeting
                phone: phone,
                supplierId: supplier.id
            });

            // Simulate Sending using TEMPLATE for first contact (Reliable)
            if (aiRes.message && phone) {
                // Reuse d2b_ai_response template 
                await sendWhatsAppMessage({
                    mobile: phone,
                    templateName: 'd2b_ai_response',
                    integratedNumber: process.env.SUPPLIER_WA_NUMBER || "917557777998",
                    components: {
                        body_1: { type: 'text', value: aiRes.message }
                    }
                }).catch(e => console.error("Failed to send initial template:", e));
            }

            return NextResponse.json({
                success: true,
                message: aiRes.message,
                reasoning: aiRes.reasoning
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        console.error("Debug Sourcing Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
