'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { FormError } from '../_components/FormMessage';

import { createProducerAction, updateProducerAction, type ProducerFormState } from './actions';

const initialState: ProducerFormState = { error: null };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? pendingLabel : label}
        </button>
    );
}

type ProducerFormValues = {
    name: string;
    slug: string;
    description: string;
    vat_number: string;
};

export function ProducerForm({
    mode,
    producerId,
    defaultValues,
}: {
    mode: 'create' | 'edit';
    producerId?: string;
    defaultValues?: ProducerFormValues;
}) {
    const boundAction =
        mode === 'edit' && producerId
            ? updateProducerAction.bind(null, producerId)
            : createProducerAction;
    const [state, formAction] = useFormState(boundAction, initialState);

    return (
        <form action={formAction} className="space-y-4 max-w-xl">
            <div>
                <label htmlFor="name" className="label-field">
                    Nom
                </label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={defaultValues?.name ?? ''}
                    className="input-field"
                />
            </div>
            <div>
                <label htmlFor="slug" className="label-field">
                    Slug <span className="text-gray-400 font-normal">(optionnel, auto-généré)</span>
                </label>
                <input
                    id="slug"
                    name="slug"
                    type="text"
                    defaultValue={defaultValues?.slug ?? ''}
                    className="input-field"
                />
            </div>
            <div>
                <label htmlFor="description" className="label-field">
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows={4}
                    defaultValue={defaultValues?.description ?? ''}
                    className="input-field"
                />
            </div>
            <div>
                <label htmlFor="vat_number" className="label-field">
                    N° TVA
                </label>
                <input
                    id="vat_number"
                    name="vat_number"
                    type="text"
                    defaultValue={defaultValues?.vat_number ?? ''}
                    className="input-field max-w-xs"
                />
            </div>
            <FormError message={state.error} />
            <SubmitButton
                label={mode === 'create' ? 'Créer le producteur' : 'Enregistrer'}
                pendingLabel={mode === 'create' ? 'Création…' : 'Enregistrement…'}
            />
        </form>
    );
}
