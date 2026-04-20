import Link from 'next/link';

import { CollectionPointForm } from '../CollectionPointForm';

export default function NewCollectionPointPage() {
    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/points-de-collecte" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">Nouveau point de collecte</h1>
            </div>
            <CollectionPointForm mode="create" />
        </div>
    );
}
