import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Hublo.be — produits locaux belges',
    description: 'Commandez des produits frais directement auprès des producteurs près de chez vous.',
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="fr">
            <body className="antialiased">{children}</body>
        </html>
    );
}
