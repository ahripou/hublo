'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { addToCartAction } from '@/app/client/panier/actions';

export function AddToCartForm({ productId, maxQty }: { productId: string; maxQty: number | null }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function submit(formData: FormData) {
        startTransition(async () => {
            setError(null);
            const result = await addToCartAction(formData);
            if (result?.error) {
                setError(result.error);
                return;
            }
            router.push('/client/panier');
        });
    }

    return (
        <form action={submit} className="space-y-3">
            <input type="hidden" name="product_id" value={productId} />
            <div className="flex items-center gap-3">
                <label htmlFor="qty" className="text-sm text-gray-700">
                    Quantité
                </label>
                <input
                    id="qty"
                    name="qty"
                    type="number"
                    min={1}
                    max={maxQty ?? 99}
                    defaultValue={1}
                    className="input-field max-w-[6rem]"
                />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={pending}>
                {pending ? 'Ajout…' : 'Ajouter au panier'}
            </button>
            {error ? (
                <p className="text-sm text-red-600" role="alert">
                    {error}
                </p>
            ) : null}
        </form>
    );
}
