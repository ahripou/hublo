import Link from 'next/link';

import { ProducerForm } from '../ProducerForm';

export default function NewProducerPage() {
    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/producteurs" className="text-sm text-gray-600 hover:text-gray-900">
                    ← Retour
                </Link>
                <h1 className="mt-2 text-2xl font-semibold text-gray-900">Nouveau producteur</h1>
            </div>
            <ProducerForm mode="create" />
        </div>
    );
}
