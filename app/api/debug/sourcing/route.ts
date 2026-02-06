
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findSuppliers } from '@/lib/research_openai';
import { getSourcingAgentResponse } from '@/lib/sourcing_agent';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Circuit Breaker State (In-Memory for this instance)
let consecutiveBlocks = 0;
const BLOCK_THRESHOLD = 3;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, category, location, autoContact, supplier, customContext } = body;

        console.log(`[Debug Sourcing] Action: ${action}`);

        if (consecutiveBlocks >= BLOCK_THRESHOLD && action === 'initiate_chat') {
            return NextResponse.json({
                error: 'Circuit Breaker Active',
                message: 'Outreach paused due to multiple consecutive Meta blocks. Please wait 24h.'
            }, { status: 429 });
        }

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
        const msgBody = aiRes.message.replace(/\n+/g, ' ').trim();

        let waRes: any = { success: false };
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            waRes = await sendWhatsAppMessage({
                mobile: normalizedPhone,
                templateName: 'd2b_ai_response',
                integratedNumber: process.env.SUPPLIER_WA_NUMBER || "917557777998",
                components: {
                    body_1: { type: 'text', value: msgBody }
                }
            });

            if (waRes.success) {
                consecutiveBlocks = 0; // Reset on success
                break;
            }

            // Check for permanent blocks (Meta Error 131026) -> DO NOT RETRY
            const errorMsg = JSON.stringify(waRes.error || "");
            if (errorMsg.includes("131026") || errorMsg.includes("engagement")) {
                console.warn(`[Sourcing API] Permanent block detected (131026). Stopping retries for ${normalizedPhone}`);
                consecutiveBlocks++; // Increment circuit breaker
                break;
            }

            if (attempts < maxAttempts) {
                console.log(`[Sourcing API] Attempt ${attempts} failed for ${normalizedPhone}. Retrying in 2s...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

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
                    attempts: attempts, // Log number of attempts
                    reasoning: aiRes.reasoning,
                    template: 'd2b_ai_response',
                    error: waRes.success ? null : waRes.error
                }
            });
        } catch (err) {
            console.error("Failed to log chat to DB:", err);
        }

        if (waRes.success) {
            console.log(`[Sourcing API] ✅ Message delivered to ${normalizedPhone} on attempt ${attempts}`);
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
            console.error(`[Sourcing API] ❌ Message failed finally for ${normalizedPhone} after ${attempts} attempts:`, waRes.error);
            // Mark as failed so we can retry from dashboard
            if (!existing) {
                await supabase.from('suppliers').insert({
                    name: name || `Supplier ${normalizedPhone.slice(-4)}`,
                    phone: normalizedPhone,
                    status: 'failed',
                    source: 'admin_dashboard',
                    updated_at: new Date(),
                    notes: `Failed after ${attempts} attempts: ${JSON.stringify(waRes.error)}`
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
