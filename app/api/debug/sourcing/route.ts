
import { NextRequest, NextResponse } from 'next/server';
import { findSuppliers } from '@/lib/research';
import { getSourcingAgentResponse } from '@/lib/sourcing_agent';
import { sendWhatsAppSessionMessage } from '@/lib/msg91';

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
            // In reality, we would send a template message FIRST.
            // But for debug, let's see what the AI *would* say to start.

            const aiRes = await getSourcingAgentResponse({
                message: "", // Empty to trigger greeting
                phone: phone,
                supplierId: supplier.id
            });

            // Simulate Sending
            if (aiRes.message && phone) {
                // UNCOMMENT TO ACTUALLY SEND IF YOU HAVE THE SUPPLIER NUMBER CONFIGURED

                // const result = await sendWhatsAppSessionMessage({
                //    mobile: phone,
                //    message: aiRes.message,
                //    integratedNumber: process.env.SUPPLIER_WA_NUMBER
                // });
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
