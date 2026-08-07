/**
 * Global Product Metadata Layer
 *
 * Provides central, read-only product metadata enrichment for all supplier scrapers.
 * Preserves leading zeroes on barcodes, enforces strict source confidence rules,
 * and passes verified brand/volume/weight/variant/category metadata into existing
 * deterministic matching logic without modifying original CSV title strings.
 */

const { createClient } = require('@supabase/supabase-js');
const ProductMetadataParser = require('../utils/ProductMetadataParser');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

class GlobalMetadataLayer {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Safely normalize barcode as string, preserving leading zeroes.
   * e.g. "005000112693577" -> "005000112693577"
   * e.g. "5000112693577"   -> "5000112693577"
   */
  static normalizeBarcode(rawBarcode) {
    if (!rawBarcode) return null;
    let str = String(rawBarcode).trim();
    str = str.replace(/^["']|["']$/g, '');
    if (!/^\d{7,18}$/.test(str)) return null;
    return str;
  }

  static extractExplicitVolume(title) {
    if (!title) return null;
    const volMatch = title.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|litres|cl|g|kg|oz|pint|pt)\b/i);
    if (volMatch) {
      return ProductMetadataParser.extractVolume(title);
    }
    return null;
  }

  async getMetadataForBarcode(rawBarcode, sourceTitle = '') {
    const barcode = GlobalMetadataLayer.normalizeBarcode(rawBarcode);
    if (!barcode) return null;

    if (this.cache.has(barcode)) {
      const cached = this.cache.get(barcode);
      if (cached.verification_status === 'needs_review' || cached.verification_status === 'incomplete') {
        return null;
      }
      return cached;
    }

    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('master_product_metadata')
        .select('*')
        .eq('barcode', barcode)
        .single();

      if (!error && data) {
        if (data.verification_status === 'verified' || data.verification_status === 'auto_verified') {
          this.cache.set(barcode, data);
          return data;
        } else {
          return null;
        }
      }
    } catch {}

    return null;
  }

  /**
   * Enrich a raw CSV product object before passing into supplier scrapers.
   * Returns enriched product object containing:
   * - product_name: original CSV name (UNCHANGED)
   * - barcode: normalized barcode
   * - brand: verified brand or null
   * - volume: verified volume or null
   * - weight: verified weight or null
   * - variant: verified variant or null
   * - category: verified category or null
   * - metadata_source: source string
   * - verification_status: status string
   */
  async enrichProduct(csvProduct) {
    const rawBarcode = csvProduct.barcode;
    const rawTitle = csvProduct.product_name || '';
    const barcode = GlobalMetadataLayer.normalizeBarcode(rawBarcode);

    const dbMeta = barcode ? await this.getMetadataForBarcode(barcode, rawTitle) : null;

    if (dbMeta) {
      return {
        ...csvProduct,
        barcode: barcode || csvProduct.barcode,
        product_name: rawTitle, // ORIGINAL CSV TITLE PRESERVED
        brand: dbMeta.normalized_brand || ProductMetadataParser.extractBrand(rawTitle),
        variant: dbMeta.normalized_variant || ProductMetadataParser.extractVariant(rawTitle),
        volume: dbMeta.normalized_volume || GlobalMetadataLayer.extractExplicitVolume(rawTitle),
        weight: dbMeta.normalized_weight || ProductMetadataParser.extractWeight(rawTitle),
        category: dbMeta.normalized_category || null,
        metadata_source: dbMeta.metadata_source || 'database',
        confidence_score: dbMeta.confidence_score || 90,
        verification_status: dbMeta.verification_status || 'verified',
      };
    }

    // Fallback: Extract only EXPLICIT metadata from title (never guess volume from price-mark)
    const explicitVol = GlobalMetadataLayer.extractExplicitVolume(rawTitle);
    const explicitBrand = ProductMetadataParser.extractBrand(rawTitle);
    const explicitWeight = ProductMetadataParser.extractWeight(rawTitle);
    const explicitVar = ProductMetadataParser.extractVariant(rawTitle);

    return {
      ...csvProduct,
      barcode: barcode || csvProduct.barcode,
      product_name: rawTitle, // ORIGINAL CSV TITLE PRESERVED
      brand: explicitBrand,
      variant: explicitVar,
      volume: explicitVol,
      weight: explicitWeight,
      category: null,
      metadata_source: 'explicit_title',
      confidence_score: 50,
      verification_status: 'auto_verified',
    };
  }

  /**
   * In-memory seed helper for verified barcodes across Booker, Parfetts, Bestway, Costco
   */
  seedVerifiedMetadata(records) {
    for (const r of records) {
      const bc = GlobalMetadataLayer.normalizeBarcode(r.barcode);
      if (bc) {
        this.cache.set(bc, {
          barcode: bc,
          source_product_name: r.source_product_name,
          normalized_brand: r.normalized_brand,
          normalized_variant: r.normalized_variant,
          normalized_volume: r.normalized_volume,
          normalized_weight: r.normalized_weight,
          normalized_category: r.normalized_category,
          metadata_source: r.metadata_source || 'verified_supplier_match',
          confidence_score: r.confidence_score || 95,
          verification_status: r.verification_status || 'verified',
        });
      }
    }
  }
}

module.exports = GlobalMetadataLayer;
