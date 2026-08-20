const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const ProductMetadataParser = require('../utils/ProductMetadataParser');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Helper: Retrieve set of raw_product_ids that pass the Retailer Data Safety Gate
 */
async function getVerifiedRawProductIds() {
  const [logsRes, decsRes] = await Promise.all([
    supabase
      .from('product_search_logs')
      .select('raw_product_id')
      .in('result_status', ['verified_exact', 'verified_equivalent', 'success']),
    supabase
      .from('admin_review_decisions')
      .select('raw_product_id')
      .eq('decision', 'ADMIN_ACCEPTED')
      .eq('is_current', true)
  ]);

  const ids = new Set();
  (logsRes.data || []).forEach(l => l.raw_product_id && ids.add(l.raw_product_id));
  (decsRes.data || []).forEach(d => d.raw_product_id && ids.add(d.raw_product_id));

  return ids;
}

/**
 * Pack Compatibility Key
 * Produces a stable group key from parsed pack metadata.
 * Two supplier offers are ONLY directly comparable if their packCompatibilityKey matches.
 *
 * Key format: "{unitsPerPack}x{unitSizeNormalized}"
 * Examples: "24x500ml", "8x330ml", "30x330ml", "1xunknown"
 *
 * CRITICAL SAFETY RULE: This prevents cross-pack price history contamination.
 * Parfetts 8x330ml must NEVER share a history series or comparison group with Booker 24x500ml,
 * even if they share the same catalogue barcode.
 */
function packCompatibilityKey(packMeta) {
  const units = packMeta.unitsPerPack || 1;
  let size = 'unknown';
  if (packMeta.unitSize) {
    size = String(packMeta.unitSize).toLowerCase().replace(/\s+/g, '');
  }
  return `${units}x${size}`;
}

/**
 * Pack Identity String (human-readable for UI)
 */
function packIdentityLabel(packMeta) {
  const units = packMeta.unitsPerPack || 1;
  const size = packMeta.unitSize || 'unknown size';
  return `${units} × ${size}`;
}

// 1. GET /api/retailer/autocomplete?q=query
router.get('/autocomplete', async (req, res) => {
  const searchTerm = (req.query.q || '').trim();
  if (!searchTerm || searchTerm.length < 2) {
    return res.json({ success: true, suggestions: [] });
  }

  try {
    const { data: activeVer } = await supabase
      .from('catalogue_versions')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!activeVer) return res.json({ success: true, suggestions: [] });

    const cleanTerm = searchTerm.toLowerCase();
    const isBarcode = /^\d{7,18}$/.test(cleanTerm);

    let catQuery = supabase
      .from('catalogue_items')
      .select('id, barcode, name, source_price_mark')
      .eq('version_id', activeVer.id);

    if (isBarcode) {
      catQuery = catQuery.eq('barcode', cleanTerm);
    } else {
      catQuery = catQuery.ilike('name', `%${cleanTerm}%`);
    }

    const { data: catItems } = await catQuery.limit(20);
    if (!catItems || catItems.length === 0) {
      return res.json({ success: true, suggestions: [] });
    }

    const verifiedRawIds = await getVerifiedRawProductIds();
    const barcodes = catItems.map(c => c.barcode).filter(Boolean);

    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, raw_barcode, suppliers(name)')
      .in('raw_barcode', barcodes)
      .in('id', Array.from(verifiedRawIds));

    const rawIds = (rawProds || []).map(r => r.id);
    const { data: snaps } = rawIds.length > 0 ? await supabase
      .from('price_snapshots')
      .select('raw_product_id, case_price')
      .in('raw_product_id', rawIds) : { data: [] };

    const suggestions = catItems.slice(0, 10).map(item => {
      const itemRaws = (rawProds || []).filter(r => r.raw_barcode === item.barcode);
      let bestPrice = null;
      let bestSupplier = null;

      for (const r of itemRaws) {
        const snap = (snaps || []).find(s => s.raw_product_id === r.id);
        if (snap && snap.case_price > 0) {
          const p = parseFloat(snap.case_price);
          if (bestPrice === null || p < bestPrice) {
            bestPrice = p;
            bestSupplier = r.suppliers?.name?.toUpperCase() || 'WHOLESALER';
          }
        }
      }

      return {
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        category: 'General Wholesale',
        priceMark: item.source_price_mark,
        bestPrice,
        bestSupplier,
        imageUrl: null
      };
    });

    return res.json({ success: true, suggestions });
  } catch (err) {
    console.error('[Retailer API] Autocomplete error:', err.message);
    res.status(500).json({ success: false, error: err.message, suggestions: [] });
  }
});

// 2. GET /api/retailer/search?q=query
router.get('/search', async (req, res) => {
  const searchTerm = (req.query.q || '').trim();

  try {
    const { data: activeVer } = await supabase
      .from('catalogue_versions')
      .select('id, version_name')
      .eq('is_active', true)
      .single();

    if (!activeVer) return res.json({ success: true, results: [] });

    const cleanTerm = searchTerm.toLowerCase();
    const isBarcode = /^\d{7,18}$/.test(cleanTerm);

    let catQuery = supabase
      .from('catalogue_items')
      .select('id, barcode, name, source_price_mark')
      .eq('version_id', activeVer.id);

    if (searchTerm) {
      if (isBarcode) {
        catQuery = catQuery.eq('barcode', cleanTerm);
      } else {
        catQuery = catQuery.ilike('name', `%${cleanTerm}%`);
      }
    }

    const { data: catItems } = await catQuery.limit(50);
    if (!catItems || catItems.length === 0) {
      return res.json({ success: true, results: [] });
    }

    const verifiedRawIds = await getVerifiedRawProductIds();
    const barcodes = catItems.map(c => c.barcode).filter(Boolean);

    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
      .in('raw_barcode', barcodes)
      .in('id', Array.from(verifiedRawIds));

    const rawIds = (rawProds || []).map(r => r.id);

    const { data: snapshots } = rawIds.length > 0 ? await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at')
      .in('raw_product_id', rawIds)
      .order('snapshot_at', { ascending: false }) : { data: [] };

    const searchResultsList = [];

    for (const catItem of catItems) {
      const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
      const supplierPrices = [];

      for (const raw of matchedRaws) {
        // PACK-SAFE: use only the LATEST snapshot for THIS raw_product_id
        const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
        if (snap && snap.case_price > 0) {
          const casePrice = parseFloat(snap.case_price);
          const packMeta = ProductMetadataParser.parseCanonicalPack(raw.raw_title, raw.raw_pack_info, casePrice);
          const metrics = ProductMetadataParser.calculateNormalizedMetrics(casePrice, packMeta.unitsPerPack, packMeta.totalVolumeLitres);

          supplierPrices.push({
            supplier: raw.suppliers?.name?.toUpperCase() || 'WHOLESALER',
            supplierId: raw.supplier_id,
            rawProductId: raw.id,
            casePrice: metrics.casePrice,
            unitPrice: metrics.unitPrice,
            unitsPerPack: packMeta.unitsPerPack,
            unitSize: packMeta.unitSize,
            packKey: packCompatibilityKey(packMeta),
            packLabel: packIdentityLabel(packMeta),
            pmpValue: packMeta.pmpValue,
            isPriceMarked: packMeta.isPriceMarked,
            supplierCode: raw.raw_product_code,
            supplierUrl: raw.raw_url,
            inStock: snap.in_stock !== false,
            scrapedAt: snap.snapshot_at,
            packInfo: raw.raw_pack_info
          });
        }
      }

      supplierPrices.sort((a, b) => a.casePrice - b.casePrice);
      const cheapest = supplierPrices.length > 0 ? supplierPrices[0] : null;

      if (supplierPrices.length > 0) {
        searchResultsList.push({
          id: catItem.id,
          barcode: catItem.barcode,
          name: catItem.name,
          category: 'General Wholesale',
          priceMark: catItem.source_price_mark,
          imageUrl: null,
          cheapest,
          supplierCount: supplierPrices.length,
          allPrices: supplierPrices
        });
      }
    }

    searchResultsList.sort((a, b) => {
      if (a.cheapest && b.cheapest) return a.cheapest.casePrice - b.cheapest.casePrice;
      if (a.cheapest) return -1;
      if (b.cheapest) return 1;
      return 0;
    });

    return res.json({ success: true, results: searchResultsList });
  } catch (err) {
    console.error('[Retailer API] Search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/retailer/deals
// PACK-SAFE: Offers are grouped by packCompatibilityKey before any comparison.
// Only offers in the same pack group contribute to savings calculation.
// Cross-pack offers are marked as 'incompatible_pack' and excluded from savings.
router.get('/deals', async (req, res) => {
  try {
    const supplierFilter = req.query.supplier || null;
    const sortBy = req.query.sortBy || 'saving_desc';

    const { data: activeVer } = await supabase
      .from('catalogue_versions')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!activeVer) return res.json({ success: true, deals: [] });

    let catQuery = supabase
      .from('catalogue_items')
      .select('id, barcode, name, source_price_mark')
      .eq('version_id', activeVer.id);

    const { data: catItems } = await catQuery;
    if (!catItems || catItems.length === 0) {
      return res.json({ success: true, deals: [] });
    }

    const verifiedRawIds = await getVerifiedRawProductIds();
    const barcodes = catItems.map(c => c.barcode).filter(Boolean);

    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
      .in('raw_barcode', barcodes)
      .in('id', Array.from(verifiedRawIds));

    const rawIds = (rawProds || []).map(r => r.id);

    const { data: snapshots } = rawIds.length > 0 ? await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at')
      .in('raw_product_id', rawIds)
      .order('snapshot_at', { ascending: false }) : { data: [] };

    const now = new Date();
    const dealsList = [];

    for (const catItem of catItems) {
      const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
      const allOffers = [];

      for (const raw of matchedRaws) {
        // PACK-SAFE: use only the LATEST snapshot for THIS raw_product_id
        const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
        if (snap && snap.case_price > 0) {
          const casePrice = parseFloat(snap.case_price);
          const packMeta = ProductMetadataParser.parseCanonicalPack(raw.raw_title, raw.raw_pack_info, casePrice);
          const metrics = ProductMetadataParser.calculateNormalizedMetrics(casePrice, packMeta.unitsPerPack, packMeta.totalVolumeLitres);

          const snapDate = new Date(snap.snapshot_at);
          const ageHours = (now.getTime() - snapDate.getTime()) / (1000 * 3600);
          let freshness = 'FRESH';
          if (ageHours > 72) freshness = 'STALE';
          else if (ageHours > 24) freshness = 'AGING';

          allOffers.push({
            supplier: raw.suppliers?.name?.toUpperCase() || 'WHOLESALER',
            supplierId: raw.supplier_id,
            rawProductId: raw.id,
            casePrice: metrics.casePrice,
            unitPrice: metrics.unitPrice,
            unitsPerPack: packMeta.unitsPerPack,
            unitSize: packMeta.unitSize,
            // CRITICAL: pack group key used to ensure only like-for-like packs are compared
            packKey: packCompatibilityKey(packMeta),
            packLabel: packIdentityLabel(packMeta),
            supplierCode: raw.raw_product_code,
            supplierUrl: raw.raw_url,
            inStock: snap.in_stock !== false,
            scrapedAt: snap.snapshot_at,
            freshness,
            packInfo: raw.raw_pack_info
          });
        }
      }

      if (allOffers.length === 0) continue;

      // PACK-SAFE COMPARISON: group offers by packCompatibilityKey
      // Only offers with the same packKey can be directly compared at case level.
      const packGroups = {};
      for (const offer of allOffers) {
        if (!packGroups[offer.packKey]) packGroups[offer.packKey] = [];
        packGroups[offer.packKey].push(offer);
      }

      // Find the dominant group (largest supplier count, tiebreak: lowest unit price)
      const groups = Object.values(packGroups);
      groups.sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        const minA = Math.min(...a.map(o => o.unitPrice || 999));
        const minB = Math.min(...b.map(o => o.unitPrice || 999));
        return minA - minB;
      });
      const dominantGroup = groups[0] || [];

      if (dominantGroup.length === 0) continue;

      dominantGroup.sort((a, b) => a.casePrice - b.casePrice);
      const cheapest = dominantGroup[0];
      const secondCheapest = dominantGroup.length > 1 ? dominantGroup[1] : null;

      if (supplierFilter && cheapest.supplier.toLowerCase() !== supplierFilter.toLowerCase()) {
        continue;
      }

      // Within the dominant group all packKeys are identical → MODE A (case-level) always valid
      let absoluteSaving = 0;
      let percentageSaving = 0;

      if (secondCheapest) {
        absoluteSaving = secondCheapest.casePrice - cheapest.casePrice;
        percentageSaving = (absoluteSaving / secondCheapest.casePrice) * 100;
      }

      // Build allPrices: dominant group tagged 'primary', others tagged 'incompatible_pack'
      const allPricesOut = [];
      for (const offer of dominantGroup) {
        allPricesOut.push({ ...offer, comparisonGroup: 'primary' });
      }
      for (let gi = 1; gi < groups.length; gi++) {
        for (const offer of groups[gi]) {
          allPricesOut.push({ ...offer, comparisonGroup: 'incompatible_pack' });
        }
      }

      dealsList.push({
        id: catItem.id,
        barcode: catItem.barcode,
        name: catItem.name,
        category: 'General Wholesale',
        priceMark: catItem.source_price_mark,
        imageUrl: null,
        cheapestSupplier: cheapest.supplier,
        cheapestPrice: cheapest.casePrice,
        cheapestUnitPrice: cheapest.unitPrice,
        unitsPerPack: cheapest.unitsPerPack,
        unitSize: cheapest.unitSize,
        packLabel: cheapest.packLabel,
        secondCheapestSupplier: secondCheapest?.supplier || null,
        secondCheapestPrice: secondCheapest?.casePrice || null,
        comparisonBasis: 'CASE',
        absoluteSaving: absoluteSaving.toFixed(2),
        percentageSaving: percentageSaving.toFixed(0),
        supplierCount: allOffers.length,
        comparableSupplierCount: dominantGroup.length,
        allPrices: allPricesOut,
        scrapedAt: cheapest.scrapedAt,
        freshness: cheapest.freshness,
        inStock: cheapest.inStock
      });
    }

    if (sortBy === 'saving_desc') dealsList.sort((a, b) => parseFloat(b.absoluteSaving) - parseFloat(a.absoluteSaving));
    else if (sortBy === 'pct_desc') dealsList.sort((a, b) => parseFloat(b.percentageSaving) - parseFloat(a.percentageSaving));
    else if (sortBy === 'price_asc') dealsList.sort((a, b) => a.cheapestPrice - b.cheapestPrice);
    else if (sortBy === 'updated_desc') dealsList.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));

    return res.json({ success: true, deals: dealsList });
  } catch (err) {
    console.error('[Retailer API] Deals error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/retailer/product/:id - Product Detail View with Historical Prices
// PACK-SAFE: History is keyed by raw_product_id, never barcode alone.
// Each supplier offer maintains its own isolated snapshot series.
// 7-day and 30-day averages cannot mix packs from different raw_products.
router.get('/product/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item } = await supabase
      .from('catalogue_items')
      .select('*')
      .eq('id', id)
      .single();

    if (!item) return res.status(404).json({ success: false, error: 'Product not found.' });

    const verifiedRawIds = await getVerifiedRawProductIds();

    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
      .eq('raw_barcode', item.barcode)
      .in('id', Array.from(verifiedRawIds));

    const rawIds = (rawProds || []).map(r => r.id);

    // Fetch ALL snapshots for ALL matched raw_products, ordered newest first
    const { data: snapshots } = rawIds.length > 0 ? await supabase
      .from('price_snapshots')
      .select('*')
      .in('raw_product_id', rawIds)
      .order('snapshot_at', { ascending: false }) : { data: [] };

    const supplierOffers = [];
    const now = Date.now();

    for (const raw of (rawProds || [])) {
      // PACK-SAFE: filter snapshots STRICTLY by this raw_product_id
      // This is the authoritative history identity — never mixed with other raw_products
      const rawSnaps = (snapshots || []).filter(s => s.raw_product_id === raw.id);

      if (rawSnaps.length > 0) {
        const latestSnap = rawSnaps[0];
        const previousSnap = rawSnaps.length > 1 ? rawSnaps[1] : null;

        const packMeta = ProductMetadataParser.parseCanonicalPack(raw.raw_title, raw.raw_pack_info);
        const currentPrice = parseFloat(latestSnap.case_price || 0);
        const metrics = ProductMetadataParser.calculateNormalizedMetrics(currentPrice, packMeta.unitsPerPack, packMeta.totalVolumeLitres);

        const previousPrice = previousSnap ? parseFloat(previousSnap.case_price || 0) : null;
        const priceDiff = previousPrice !== null ? (currentPrice - previousPrice) : null;

        // PACK-SAFE historical averages: computed from THIS raw_product_id's snapshots ONLY
        const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
        const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;

        const snaps7d = rawSnaps.filter(s => new Date(s.snapshot_at).getTime() >= sevenDaysAgo);
        const snaps30d = rawSnaps.filter(s => new Date(s.snapshot_at).getTime() >= thirtyDaysAgo);

        const avg7d = snaps7d.length > 0
          ? (snaps7d.reduce((a, s) => a + parseFloat(s.case_price || 0), 0) / snaps7d.length)
          : null;
        const avg30d = snaps30d.length > 0
          ? (snaps30d.reduce((a, s) => a + parseFloat(s.case_price || 0), 0) / snaps30d.length)
          : null;

        supplierOffers.push({
          supplierId: raw.supplier_id,
          supplierName: raw.suppliers?.name?.toUpperCase() || 'WHOLESALER',
          // Stable identity for this price series — raw_product_id is the authoritative key
          rawProductId: raw.id,
          packKey: packCompatibilityKey(packMeta),
          packLabel: packIdentityLabel(packMeta),
          casePrice: currentPrice,
          unitPrice: metrics ? metrics.unitPrice : null,
          unitsPerPack: packMeta.unitsPerPack,
          unitSize: packMeta.unitSize,
          pmpValue: packMeta.pmpValue,
          isPriceMarked: packMeta.isPriceMarked,
          previousPrice: previousPrice !== null ? previousPrice.toFixed(2) : null,
          priceDiff: priceDiff !== null ? priceDiff.toFixed(2) : null,
          // 7d/30d averages: this raw_product_id's snapshots ONLY — no cross-pack contamination
          sevenDayAvg: avg7d !== null ? avg7d.toFixed(2) : null,
          thirtyDayAvg: avg30d !== null ? avg30d.toFixed(2) : null,
          sevenDaySnapCount: snaps7d.length,
          thirtyDaySnapCount: snaps30d.length,
          totalSnapCount: rawSnaps.length,
          packInfo: raw.raw_pack_info || `${packMeta.unitsPerPack} units`,
          inStock: latestSnap.in_stock !== false,
          supplierCode: raw.raw_product_code,
          supplierUrl: raw.raw_url,
          lastUpdated: latestSnap.snapshot_at
        });
      }
    }

    supplierOffers.sort((a, b) => a.casePrice - b.casePrice);

    res.json({
      success: true,
      product: {
        id: item.id,
        barcode: item.barcode,
        name: item.name,
        category: 'General Wholesale',
        priceMark: item.source_price_mark,
        imageUrl: null,
        offers: supplierOffers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET /api/retailer/product/:id/history - Price History Trends
// PACK-SAFE: Returns per-raw_product series, each tagged with its pack identity.
// No cross-supplier or cross-pack merging — client renders separate lines per series.
router.get('/product/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days || '30', 10);

    const { data: item } = await supabase
      .from('catalogue_items')
      .select('barcode')
      .eq('id', id)
      .single();

    if (!item) return res.status(404).json({ success: false, error: 'Product not found.' });

    const verifiedRawIds = await getVerifiedRawProductIds();

    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_pack_info, suppliers(name)')
      .eq('raw_barcode', item.barcode)
      .in('id', Array.from(verifiedRawIds));

    const rawIds = (rawProds || []).map(r => r.id);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: snapshots } = rawIds.length > 0 ? await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, unit_cost, snapshot_at')
      .in('raw_product_id', rawIds)
      .gte('snapshot_at', cutoffDate.toISOString())
      .order('snapshot_at', { ascending: true }) : { data: [] };

    // PACK-SAFE: build per-raw_product series — NEVER a flat merged array
    // Each series is tagged with its pack identity for correct UI labelling
    const seriesMap = {};

    for (const raw of (rawProds || [])) {
      const packMeta = ProductMetadataParser.parseCanonicalPack(raw.raw_title, raw.raw_pack_info);
      seriesMap[raw.id] = {
        rawProductId: raw.id,
        supplierId: raw.supplier_id,
        supplierName: raw.suppliers?.name?.toUpperCase() || 'WHOLESALER',
        packKey: packCompatibilityKey(packMeta),
        packLabel: packIdentityLabel(packMeta),
        points: []
      };
    }

    for (const s of (snapshots || [])) {
      const series = seriesMap[s.raw_product_id];
      if (!series) continue;
      // PACK-SAFE: each point belongs exclusively to one raw_product series
      series.points.push({
        id: s.id,
        casePrice: parseFloat(s.case_price),
        unitCost: s.unit_cost ? parseFloat(s.unit_cost) : null,
        date: s.snapshot_at
      });
    }

    const seriesList = Object.values(seriesMap).filter(s => s.points.length > 0);

    res.json({ success: true, series: seriesList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
