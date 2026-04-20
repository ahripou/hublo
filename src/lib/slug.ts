/**
 * Génère un slug URL-friendly à partir d'un texte libre.
 * Minuscules, tirets, accents retirés, caractères non alphanumériques supprimés.
 */
export function slugify(input: string): string {
    return input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
