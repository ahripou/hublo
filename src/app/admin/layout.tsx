import Link from 'next/link';

import { AdminNav } from './_components/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
                    <Link href="/admin" className="text-lg font-semibold text-[var(--accent)]">
                        Hublo admin
                    </Link>
                    <form action="/auth/logout" method="post">
                        <button type="submit" className="btn-secondary">
                            Déconnexion
                        </button>
                    </form>
                </div>
            </header>
            <AdminNav />
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </div>
    );
}
