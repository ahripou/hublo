import Link from 'next/link';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="border-b border-gray-200 bg-white">
                <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                    <Link href="/client" className="text-lg font-semibold text-[var(--accent)]">
                        Hublo.be
                    </Link>
                    <form action="/auth/logout" method="post">
                        <button type="submit" className="btn-secondary">
                            Déconnexion
                        </button>
                    </form>
                </div>
            </header>
            <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        </div>
    );
}
