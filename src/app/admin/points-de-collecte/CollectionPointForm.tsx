'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { FormError } from '../_components/FormMessage';

import {
    createCollectionPointAction,
    updateCollectionPointAction,
    type CollectionPointFormState,
} from './actions';

const initialState: CollectionPointFormState = { error: null };

const DAYS = [
    { value: '', label: '—' },
    { value: 'monday', label: 'Lundi' },
    { value: 'tuesday', label: 'Mardi' },
    { value: 'wednesday', label: 'Mercredi' },
    { value: 'thursday', label: 'Jeudi' },
    { value: 'friday', label: 'Vendredi' },
    { value: 'saturday', label: 'Samedi' },
    { value: 'sunday', label: 'Dimanche' },
];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? pendingLabel : label}
        </button>
    );
}

type CollectionPointFormValues = {
    name: string;
    slug: string;
    address: string;
    schedule_day: string;
    schedule_start: string;
    schedule_end: string;
    coordinator_commission_percent: string;
};

export function CollectionPointForm({
    mode,
    collectionPointId,
    defaultValues,
}: {
    mode: 'create' | 'edit';
    collectionPointId?: string;
    defaultValues?: CollectionPointFormValues;
}) {
    const boundAction =
        mode === 'edit' && collectionPointId
            ? updateCollectionPointAction.bind(null, collectionPointId)
            : createCollectionPointAction;
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
                    Slug <span className="text-gray-400 font-normal">(optionnel)</span>
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
                <label htmlFor="address" className="label-field">
                    Adresse
                </label>
                <textarea
                    id="address"
                    name="address"
                    rows={3}
                    required
                    defaultValue={defaultValues?.address ?? ''}
                    className="input-field"
                />
            </div>
            <fieldset className="space-y-3">
                <legend className="label-field">Créneau de distribution</legend>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label htmlFor="schedule_day" className="text-xs text-gray-600">
                            Jour
                        </label>
                        <select
                            id="schedule_day"
                            name="schedule_day"
                            defaultValue={defaultValues?.schedule_day ?? ''}
                            className="input-field"
                        >
                            {DAYS.map((d) => (
                                <option key={d.value} value={d.value}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="schedule_start" className="text-xs text-gray-600">
                            Début
                        </label>
                        <input
                            id="schedule_start"
                            name="schedule_start"
                            type="time"
                            defaultValue={defaultValues?.schedule_start ?? ''}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label htmlFor="schedule_end" className="text-xs text-gray-600">
                            Fin
                        </label>
                        <input
                            id="schedule_end"
                            name="schedule_end"
                            type="time"
                            defaultValue={defaultValues?.schedule_end ?? ''}
                            className="input-field"
                        />
                    </div>
                </div>
            </fieldset>
            <div>
                <label htmlFor="coordinator_commission_percent" className="label-field">
                    Commission coordinateur (%)
                </label>
                <input
                    id="coordinator_commission_percent"
                    name="coordinator_commission_percent"
                    type="text"
                    inputMode="decimal"
                    defaultValue={defaultValues?.coordinator_commission_percent ?? '0'}
                    className="input-field max-w-[10rem]"
                />
                <p className="mt-1 text-xs text-gray-500">0% par défaut tant que le fondateur est seul coordinateur.</p>
            </div>
            <FormError message={state.error} />
            <SubmitButton
                label={mode === 'create' ? 'Créer le point' : 'Enregistrer'}
                pendingLabel={mode === 'create' ? 'Création…' : 'Enregistrement…'}
            />
        </form>
    );
}
