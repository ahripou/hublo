import { NextResponse } from 'next/server';

import { sendOrderConfirmationEmail } from '@/lib/email/resend';
import { getPaymentProvider } from '@/lib/payment/factory';
import { handleMollieWebhook } from '@/lib/payment/webhook';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';

/**
 * Webhook Mollie — point d'entrée Next.js.
 *
 * La logique métier est dans `handleMollieWebhook` (pure, testable). Ici on
 * se contente de :
 *  - parser le body (form-urlencoded par défaut Mollie)
 *  - câbler le provider + le client Supabase service-role
 *  - toujours répondre 200 (même sur erreur applicative) pour stopper les
 *    retries Mollie — les erreurs sont loguées, traitement manuel par l'admin.
 */
export async function POST(request: Request) {
    let mollieId: string | null = null;
    try {
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const body = (await request.json()) as { id?: string };
            mollieId = body.id ?? null;
        } else {
            const form = await request.formData();
            const val = form.get('id');
            mollieId = typeof val === 'string' ? val : null;
        }
    } catch {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    if (!mollieId) {
        return NextResponse.json({ error: 'missing_id' }, { status: 400 });
    }

    const result = await handleMollieWebhook(mollieId, {
        supabase: createSupabaseServiceRoleClient(),
        provider: getPaymentProvider(),
        onOrderConfirmed: (orderId) => {
            sendOrderConfirmationEmail(orderId).catch((err) =>
                console.error('mollie webhook: email failed', err),
            );
        },
    });

    if (!result.ok) {
        console.error('mollie webhook error', result);
        // 200 pour stopper les retries Mollie — l'admin traitera manuellement.
        return NextResponse.json({ ok: false, code: result.code }, { status: 200 });
    }

    return NextResponse.json({ ok: true, status: result.status });
}
