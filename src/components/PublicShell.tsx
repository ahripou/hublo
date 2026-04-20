import Link from 'next/link';

export function PublicHeader() {
    return (
        <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
                <Link href="/" className="text-xl font-semibold text-[var(--accent)]">
                    Hublo.be
                </Link>
                <nav className="flex items-center gap-3">
                    <Link href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                        Connexion
                    </Link>
                    <Link href="/auth/register" className="btn-primary">
                        S&apos;inscrire
                    </Link>
                </nav>
            </div>
        </header>
    );
}

export function PublicFooter() {
    return (
        <footer className="border-t border-gray-200 mt-12">
            <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-gray-500">
                © {new Date().getFullYear()} Hublo.be
            </div>
        </footer>
    );
}
