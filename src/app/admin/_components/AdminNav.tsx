'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links: { href: string; label: string }[] = [
    { href: '/admin', label: 'Tableau de bord' },
    { href: '/admin/producteurs', label: 'Producteurs' },
    { href: '/admin/produits', label: 'Produits' },
    { href: '/admin/points-de-collecte', label: 'Points de collecte' },
    { href: '/admin/ventes', label: 'Ventes' },
    { href: '/admin/reversements', label: 'Reversements' },
    { href: '/admin/exports', label: 'Exports CSV' },
    { href: '/admin/parametres', label: 'Paramètres' },
];

export function AdminNav() {
    const pathname = usePathname();
    return (
        <nav className="flex flex-wrap gap-1 border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-6xl w-full px-4 py-2 flex flex-wrap gap-1">
                {links.map((link) => {
                    const active =
                        link.href === '/admin'
                            ? pathname === '/admin'
                            : pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                                active
                                    ? 'bg-green-50 text-[var(--accent)]'
                                    : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
