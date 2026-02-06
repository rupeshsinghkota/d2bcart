
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findSuppliers } from '@/lib/research_openai';
import { getSourcingAgentResponse } from '@/lib/sourcing_agent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, category, location, autoContact, supplier, customContext } = body;

        console.log(`[Debug Sourcing] Action: ${action}`);

        if (action === 'research') {
            const result = await findSuppliers(category, location || "India");
            return NextResponse.json(result);
        }

        if (action === 'initiate_chat') {
            const res = await initiateSupplierChat(supplier);
            return NextResponse.json(res);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        console.error("Debug Sourcing Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

async function initiateSupplierChat(supplier: any, customContext?: string) {
    const { name, phone, description } = supplier;
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
        .from('suppliers')
        .select('id, status')
        .eq('phone', normalizedPhone)
        .single();

    if (existing && ['contacted', 'responded', 'verified', 'rejected'].includes(existing.status)) {
        return { success: false, message: `Skipped: ${normalizedPhone} already ${existing.status}` };
    }

    const aiRes = await getSourcingAgentResponse({
        message: "",
        phone: normalizedPhone,
        supplierId: supplier.id,
        description: description,
        customContext: customContext // NEW: Pass user instruction
    });

    if (aiRes.message && normalizedPhone) {
        const { sendWhatsAppMessage } = await import('@/lib/msg91');
        // MSG91 templates do NOT support newlines in body variables
        const msgBody = aiRes.message.replace(/\n+/g, ' ').trim();

        const waRes = await sendWhatsAppMessage({
            mobile: normalizedPhone,
            templateName: 'd2b_ai_response',
            integratedNumber: process.env.SUPPLIER_WA_NUMBER || "917557777998",
            components: {
                body_1: { type: 'text', value: msgBody }
            }
        });

        // ALWAYS log to whatsapp_chats for visibility, regardless of success
        try {
            await supabase.from('whatsapp_chats').insert({
                mobile: normalizedPhone,
                message: aiRes.message,
                direction: 'outbound',
                status: waRes.success ? 'sent' : 'failed',
                metadata: {
                    ...waRes,
                    source: 'sourcing_initiation',
                    reasoning: aiRes.reasoning,
                    template: 'd2b_ai_response',
                    error: waRes.success ? null : waRes.error
                }
            });
        } catch (err) {
            console.error("Failed to log chat to DB:", err);
        }

        if (waRes.success) {
            console.log(`[Debug Sourcing] ✅ Message sent to ${normalizedPhone}`);
            if (!existing) {
                await supabase.from('suppliers').insert({
                    name: name || `Supplier ${normalizedPhone.slice(-4)}`,
                    phone: normalizedPhone,
                    status: 'contacted',
                    source: 'admin_dashboard',
                    updated_at: new Date()
                });
            } else {
                await supabase.from('suppliers')
                    .update({ status: 'contacted', updated_at: new Date() })
                    .eq('id', existing.id);
            }
        } else {
            console.error(`[Debug Sourcing] ❌ Message failed for ${normalizedPhone}:`, waRes.error);
            // Mark as failed so we can retry from dashboard
            if (!existing) {
                await supabase.from('suppliers').insert({
                    name: name || `Supplier ${normalizedPhone.slice(-4)}`,
                    phone: normalizedPhone,
                    status: 'failed',
                    source: 'admin_dashboard',
                    updated_at: new Date(),
                    notes: `Failed: ${JSON.stringify(waRes.error)}`
                });
            } else {
                await supabase.from('suppliers')
                    .update({ status: 'failed', updated_at: new Date() })
                    .eq('id', existing.id);
            }
        }
    }

    return { success: true, message: aiRes.message };
}
