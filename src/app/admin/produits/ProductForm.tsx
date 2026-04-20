'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { FormError } from '../_components/FormMessage';

import { createProductAction, updateProductAction, type ProductFormState } from './actions';

const initialState: ProductFormState = { error: null };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? pendingLabel : label}
        </button>
    );
}

type ProductFormValues = {
    producer_id: string;
    collection_point_id: string;
    name: string;
    slug: string;
    description: string;
    photo_url: string;
    photo_alt: string;
    price_euros: string;
    vat_rate: string;
    stock_mode: 'unlimited' | 'limited';
    stock_qty: string;
};

type Option = { id: string; name: string };

export function ProductForm({
    mode,
    productId,
    producers,
    collectionPoints,
    defaultValues,
}: {
    mode: 'create' | 'edit';
    productId?: string;
    producers: Option[];
    collectionPoints: Option[];
    defaultValues?: ProductFormValues;
}) {
    const boundAction =
        mode === 'edit' && productId
            ? updateProductAction.bind(null, productId)
            : createProductAction;
    const [state, formAction] = useFormState(boundAction, initialState);
    const [stockMode, setStockMode] = useState<'unlimited' | 'limited'>(
        defaultValues?.stock_mode ?? 'unlimited',
    );

    return (
        <form action={formAction} className="space-y-4 max-w-xl">
            <div>
                <label htmlFor="producer_id" className="label-field">
                    Producteur
                </label>
                <select
                    id="producer_id"
                    name="producer_id"
                    required
                    defaultValue={defaultValues?.producer_id ?? ''}
                    className="input-field"
                >
                    <option value="">— Choisir —</option>
                    {producers.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="collection_point_id" className="label-field">
                    Point de collecte <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <select
                    id="collection_point_id"
                    name="collection_point_id"
                    defaultValue={defaultValues?.collection_point_id ?? ''}
                    className="input-field"
                >
                    <option value="">— Aucun —</option>
                    {collectionPoints.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>
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
                <label htmlFor="description" className="label-field">
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows={4}
                    required
                    defaultValue={defaultValues?.description ?? ''}
                    className="input-field"
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor="photo_url" className="label-field">
                        Photo URL <span className="text-gray-400 font-normal">(upload en Sprint 3)</span>
                    </label>
                    <input
                        id="photo_url"
                        name="photo_url"
                        type="url"
                        defaultValue={defaultValues?.photo_url ?? ''}
                        className="input-field"
                    />
                </div>
                <div>
                    <label htmlFor="photo_alt" className="label-field">
                        Texte alternatif
                    </label>
                    <input
                        id="photo_alt"
                        name="photo_alt"
                        type="text"
                        defaultValue={defaultValues?.photo_alt ?? ''}
                        className="input-field"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="price_euros" className="label-field">
                        Prix HT producteur (€)
                    </label>
                    <input
                        id="price_euros"
                        name="price_euros"
                        type="text"
                        inputMode="decimal"
                        required
                        defaultValue={defaultValues?.price_euros ?? ''}
                        className="input-field"
                    />
                </div>
                <div>
                    <label htmlFor="vat_rate" className="label-field">
                        TVA
                    </label>
                    <select
                        id="vat_rate"
                        name="vat_rate"
                        defaultValue={defaultValues?.vat_rate ?? '6'}
                        className="input-field"
                    >
                        <option value="0">0%</option>
                        <option value="6">6%</option>
                        <option value="21">21%</option>
                    </select>
                </div>
            </div>
            <fieldset className="space-y-2">
                <legend className="label-field">Stock</legend>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        name="stock_mode"
                        value="unlimited"
                        checked={stockMode === 'unlimited'}
                        onChange={() => setStockMode('unlimited')}
                    />
                    Illimité
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        name="stock_mode"
                        value="limited"
                        checked={stockMode === 'limited'}
                        onChange={() => setStockMode('limited')}
                    />
                    Limité
                    <input
                        name="stock_qty"
                        type="number"
                        min={0}
                        defaultValue={defaultValues?.stock_qty ?? ''}
                        disabled={stockMode !== 'limited'}
                        className="input-field max-w-[8rem] ml-2"
                    />
                </label>
            </fieldset>
            <FormError message={state.error} />
            <SubmitButton
                label={mode === 'create' ? 'Créer le produit' : 'Enregistrer'}
                pendingLabel={mode === 'create' ? 'Création…' : 'Enregistrement…'}
            />
        </form>
    );
}
