'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { FormError, FormSuccess } from '../_components/FormMessage';

import { updatePlatformCommissionAction, type SettingsFormState } from './actions';

const initialState: SettingsFormState = { error: null, success: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
    );
}

export function PlatformCommissionForm({ currentPercent }: { currentPercent: string }) {
    const [state, formAction] = useFormState(updatePlatformCommissionAction, initialState);
    return (
        <form action={formAction} className="space-y-4">
            <div>
                <label htmlFor="platform_commission_percent" className="label-field">
                    Commission plateforme (%)
                </label>
                <input
                    id="platform_commission_percent"
                    name="platform_commission_percent"
                    type="text"
                    inputMode="decimal"
                    defaultValue={currentPercent}
                    required
                    className="input-field max-w-[12rem]"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Appliquée sur le prix HT producteur. Les commandes déjà passées ne sont pas recalculées.
                </p>
            </div>
            <FormError message={state.error} />
            <FormSuccess message={state.success} />
            <SubmitButton />
        </form>
    );
}
