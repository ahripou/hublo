'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { FormError } from '../_components/FormMessage';

import { createSaleAction, updateSaleAction, type SaleFormState } from './actions';

const initialState: SaleFormState = { error: null };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? pendingLabel : label}
        </button>
    );
}

type SaleFormValues = {
    collection_point_id: string;
    distribution_date: string;
    distribution_start_at: string;
    distribution_end_at: string;
    closes_at: string;
};

type Option = { id: string; name: string };

export function SaleForm({
    mode,
    saleId,
    collectionPoints,
    defaultValues,
}: {
    mode: 'create' | 'edit';
    saleId?: string;
    collectionPoints: Option[];
    defaultValues?: SaleFormValues;
}) {
    const boundAction =
        mode === 'edit' && saleId ? updateSaleAction.bind(null, saleId) : createSaleAction;
    const [state, formAction] = useFormState(boundAction, initialState);

    return (
        <form action={formAction} className="space-y-4 max-w-xl">
            <div>
                <label htmlFor="collection_point_id" className="label-field">
                    Point de collecte
                </label>
                <select
                    id="collection_point_id"
                    name="collection_point_id"
                    required
                    defaultValue={defaultValues?.collection_point_id ?? ''}
                    className="input-field"
                >
                    <option value="">— Choisir —</option>
                    {collectionPoints.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="distribution_date" className="label-field">
                    Date de distribution
                </label>
                <input
                    id="distribution_date"
                    name="distribution_date"
                    type="date"
                    required
                    defaultValue={defaultValues?.distribution_date ?? ''}
                    className="input-field max-w-xs"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="distribution_start_at" className="label-field">
                        Début distribution
                    </label>
                    <input
                        id="distribution_start_at"
                        name="distribution_start_at"
                        type="datetime-local"
                        defaultValue={defaultValues?.distribution_start_at ?? ''}
                        className="input-field"
                    />
                </div>
                <div>
                    <label htmlFor="distribution_end_at" className="label-field">
                        Fin distribution
                    </label>
                    <input
                        id="distribution_end_at"
                        name="distribution_end_at"
                        type="datetime-local"
                        defaultValue={defaultValues?.distribution_end_at ?? ''}
                        className="input-field"
                    />
                </div>
            </div>
            <div>
                <label htmlFor="closes_at" className="label-field">
                    Clôture automatique
                </label>
                <input
                    id="closes_at"
                    name="closes_at"
                    type="datetime-local"
                    required
                    defaultValue={defaultValues?.closes_at ?? ''}
                    className="input-field max-w-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Le cron Supabase passera la vente en &quot;closed&quot; après cette date.
                </p>
            </div>
            <FormError message={state.error} />
            <SubmitButton
                label={mode === 'create' ? 'Créer la vente' : 'Enregistrer'}
                pendingLabel={mode === 'create' ? 'Création…' : 'Enregistrement…'}
            />
        </form>
    );
}
