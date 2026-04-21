'use client';

import { useState, useTransition } from 'react';

import { confirmCheckoutAction } from './actions';

export function ConfirmButton() {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function submit() {
        startTransition(async () => {
            setError(null);
            const result = await confirmCheckoutAction();
            if (result?.error) {
                setError(result.error);
            }
            // Succès → le server action redirige vers Mollie, le client ne
            // reçoit pas de résultat.
        });
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={submit}
                className="btn-primary w-full justify-center"
                disabled={pending}
            >
                {pending ? 'Redirection…' : 'Confirmer et payer'}
            </button>
            {error ? (
                <p className="text-sm text-red-600" role="alert">
                    {error}
                </p>
            ) : null}
            <p className="text-xs text-gray-500 text-center">
                Vous serez redirigé vers Mollie (Bancontact ou carte bancaire).
            </p>
        </div>
    );
}
