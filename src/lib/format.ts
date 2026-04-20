/**
 * Helpers d'affichage FR. Montants en euros, dates locales belges.
 */

const eurosFormatter = new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
});

export function formatCentsAsEuros(cents: number): string {
    return eurosFormatter.format(cents / 100);
}

export function parseEurosToCents(input: string): number | null {
    const normalised = input.replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;
    const cents = Math.round(parseFloat(normalised) * 100);
    if (!Number.isFinite(cents) || cents < 0) return null;
    return cents;
}

const dateFormatter = new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

export function formatDate(iso: string): string {
    return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
    return dateTimeFormatter.format(new Date(iso));
}

/**
 * Convertit une datetime locale (ex : input `datetime-local` ou ISO) vers
 * la chaîne attendue par un input HTML `datetime-local` (sans timezone).
 */
export function toDateTimeLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
