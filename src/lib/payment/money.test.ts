import { describe, expect, it } from 'vitest';

import { centsToDecimalString, decimalStringToCents } from './money';

describe('centsToDecimalString', () => {
    it('formats integer cents with two decimals', () => {
        expect(centsToDecimalString(1000)).toBe('10.00');
        expect(centsToDecimalString(1059)).toBe('10.59');
        expect(centsToDecimalString(1)).toBe('0.01');
        expect(centsToDecimalString(0)).toBe('0.00');
    });

    it('rejects non-integer or negative', () => {
        expect(() => centsToDecimalString(10.5)).toThrow();
        expect(() => centsToDecimalString(-100)).toThrow();
    });
});

describe('decimalStringToCents', () => {
    it('parses standard two-decimal strings', () => {
        expect(decimalStringToCents('10.00')).toBe(1000);
        expect(decimalStringToCents('10.59')).toBe(1059);
        expect(decimalStringToCents('0.01')).toBe(1);
    });

    it('handles single-decimal and no-decimal', () => {
        expect(decimalStringToCents('10')).toBe(1000);
        expect(decimalStringToCents('10.5')).toBe(1050);
    });

    it('round-trips with centsToDecimalString', () => {
        for (const cents of [0, 1, 10, 100, 1000, 12345, 999_999]) {
            expect(decimalStringToCents(centsToDecimalString(cents))).toBe(cents);
        }
    });

    it('rejects non-numeric input', () => {
        expect(() => decimalStringToCents('abc')).toThrow();
        expect(() => decimalStringToCents('')).toThrow();
    });
});
