/**
 * Lignes DB typées à la main (pas de generation supabase gen types au MVP).
 * À aligner avec supabase/migrations/0001_init.sql.
 */

export type ProducerStatus = 'active' | 'archived';
export type CollectionPointStatus = 'active' | 'inactive' | 'archived';
export type ProductStatus = 'active' | 'suspended' | 'archived';
export type VatRate = 0 | 6 | 21;
export type SaleStatus = 'draft' | 'open' | 'closed' | 'distributed' | 'cancelled';

export interface ProducerRow {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    vat_number: string | null;
    status: ProducerStatus;
    created_at: string;
    updated_at: string;
}

export interface CollectionPointRow {
    id: string;
    name: string;
    slug: string;
    address: string;
    schedule: unknown;
    coordinator_user_id: string | null;
    coordinator_commission_bps: number;
    status: CollectionPointStatus;
    created_at: string;
    updated_at: string;
}

export interface ProductRow {
    id: string;
    producer_id: string;
    collection_point_id: string | null;
    name: string;
    slug: string;
    description: string;
    photo_url: string | null;
    photo_alt: string | null;
    price_ht_cents: number;
    vat_rate: VatRate;
    stock_unlimited: boolean;
    stock_qty: number | null;
    status: ProductStatus;
    created_at: string;
    updated_at: string;
}

export interface SaleRow {
    id: string;
    collection_point_id: string;
    distribution_date: string;
    distribution_start_at: string | null;
    distribution_end_at: string | null;
    closes_at: string;
    status: SaleStatus;
    created_at: string;
    updated_at: string;
}

export interface SettingRow {
    key: string;
    value: unknown;
    updated_at: string;
}
