
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
            const normalizedPhone = phone.replace(/[^0-9]/g, '');

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            // 1. CHECK DUPLICATE
            const { data: existing } = await supabase
                .from('suppliers')
                .select('id, status')
                .eq('phone', normalizedPhone)
                .single();

            if (existing && ['contacted', 'responded', 'verified', 'rejected'].includes(existing.status)) {
                return NextResponse.json({
                    success: false,
                    message: `Skipped: Supplier already ${existing.status}.`
                });
            }

            // Simulate initiating chat via Agent Logic
            const aiRes = await getSourcingAgentResponse({
                message: "", // Empty to trigger greeting
                phone: normalizedPhone,
                supplierId: supplier.id
            });

            // Simulate Sending using TEMPLATE for first contact (Reliable)
            if (aiRes.message && normalizedPhone) {
                const { sendWhatsAppMessage } = await import('@/lib/msg91');

                // Reuse d2b_ai_response template
                const msgBody = `Hello, this is the sourcing team from D2BCart.\n\n${aiRes.message}\n\nRegards,\nD2BCart Team`;

                await sendWhatsAppMessage({
                    mobile: normalizedPhone,
                    templateName: 'd2b_ai_response',
                    integratedNumber: process.env.SUPPLIER_WA_NUMBER || "917557777998",
                    components: {
                        body_1: { type: 'text', value: msgBody }
                    }
                }).catch(e => console.error("Failed to send initial template:", e));

                // 2. MARK AS CONTACTED (Save to DB)
                if (!existing) {
                    await supabase.from('suppliers').insert({
                        name: name || `Supplier ${normalizedPhone.slice(-4)}`,
                        phone: normalizedPhone,
                        status: 'contacted',
                        source: 'admin_dashboard',
                        updated_at: new Date()
                    });
                } else {
                    // Update if it was just 'discovered'
                    await supabase.from('suppliers')
                        .update({ status: 'contacted', updated_at: new Date() })
                        .eq('id', existing.id);
                }
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
