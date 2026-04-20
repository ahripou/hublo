import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
    it('normalises accents and case', () => {
        expect(slugify('Ferme de la Côte')).toBe('ferme-de-la-cote');
    });

    it('collapses non-alphanumerics', () => {
        expect(slugify('Pain  --  Complet !! 500g')).toBe('pain-complet-500g');
    });

    it('trims leading/trailing dashes', () => {
        expect(slugify('  -- hello -- ')).toBe('hello');
    });

    it('caps at 80 chars', () => {
        const long = 'a'.repeat(200);
        expect(slugify(long)).toHaveLength(80);
    });

    it('returns empty string for empty input', () => {
        expect(slugify('')).toBe('');
        expect(slugify('   ')).toBe('');
    });
});
