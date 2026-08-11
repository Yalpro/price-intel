const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET /api/retailer/autocomplete?q=query
router.get('/autocomplete', async (req, res) => {
  const searchTerm = (req.query.q || '').trim();
  if (!searchTerm) {
    return res.json({ success: true, suggestions: [] });
  }

  try {
    const { data: activeVer, error: verErr } = await supabase
      .from('catalogue_versions')
      .select('id')
      .eq('is_active', true)
      .single();

    if (verErr || !activeVer) {
      return res.json({ success: true, suggestions: [] });
    }

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

    const { data: catItems, error: catErr } = await catQuery.limit(25);
    if (catErr) throw catErr;

    const sortedSuggestions = (catItems || []).sort((a, b) => {
      const aBarcode = (a.barcode || '').toLowerCase();
      const bBarcode = (b.barcode || '').toLowerCase();
      if (aBarcode === cleanTerm) return -1;
      if (bBarcode === cleanTerm) return 1;

      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();

      const aStarts = aName.startsWith(cleanTerm);
      const bStarts = bName.startsWith(cleanTerm);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });

    const suggestions = sortedSuggestions.slice(0, 10).map(item => ({
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      priceMark: item.source_price_mark
    }));

    return res.json({ success: true, suggestions });
  } catch (err) {
    console.error('[Retailer API] Autocomplete error:', err.message);
    res.status(500).json({ success: false, error: err.message, suggestions: [] });
  }
});

// GET /api/retailer/search?q=query
router.get('/search', async (req, res) => {
  const searchTerm = (req.query.q || '').trim();
  if (!searchTerm) {
    return res.json({ success: true, results: [], message: 'Query term empty.' });
  }

  try {
    // 1. Get active catalogue version
    const { data: activeVer, error: verErr } = await supabase
      .from('catalogue_versions')
      .select('id, version_name')
      .eq('is_active', true)
      .single();

    if (verErr || !activeVer) {
      return res.json({ success: true, results: [], message: 'No active catalogue version found.' });
    }

    // 2. Search catalogue_items in active version
    const cleanTerm = searchTerm.toLowerCase();
    const isBarcode = /^\d{7,18}$/.test(cleanTerm);

    let catQuery = supabase
      .from('catalogue_items')
      .select('id, barcode, name, source_price_mark, row_number')
      .eq('version_id', activeVer.id);

    if (isBarcode) {
      catQuery = catQuery.eq('barcode', cleanTerm);
    } else {
      catQuery = catQuery.ilike('name', `%${cleanTerm}%`);
    }

    const { data: catItems, error: catErr } = await catQuery.limit(50);
    if (catErr) throw catErr;

    if (!catItems || catItems.length === 0) {
      return res.json({ 
        success: true, 
        results: [], 
        activeVersionName: activeVer.version_name,
        message: `No matching products found in active catalogue version #${activeVer.id}.` 
      });
    }

    const barcodes = catItems.map(c => c.barcode).filter(Boolean);

    // 3. Query raw_products by raw_barcode
    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
      .in('raw_barcode', barcodes);

    const rawIds = (rawProds || []).map(r => r.id);

    // 4. Query latest price_snapshots
    const { data: snapshots } = await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at')
      .in('raw_product_id', rawIds)
      .order('snapshot_at', { ascending: false });

    // 5. Structure comparison list per active catalogue SKU
    const searchResultsList = [];

    for (const catItem of catItems) {
      const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
      const supplierPrices = [];

      for (const raw of matchedRaws) {
        const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
        if (snap && snap.case_price > 0) {
          const casePrice = parseFloat(snap.case_price);
          const unitPrice = snap.unit_cost 
            ? parseFloat(snap.unit_cost) 
            : (casePrice / 12);

          supplierPrices.push({
            supplier: raw.suppliers?.name || 'Wholesaler',
            supplierId: raw.supplier_id,
            casePrice,
            unitPrice: unitPrice.toFixed(2),
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
      const secondCheapest = supplierPrices.length > 1 ? supplierPrices[1] : null;

      const absoluteSaving = (cheapest && secondCheapest) 
        ? (secondCheapest.casePrice - cheapest.casePrice).toFixed(2) 
        : '0.00';

      searchResultsList.push({
        id: catItem.id,
        barcode: catItem.barcode,
        name: catItem.name,
        priceMark: catItem.source_price_mark,
        hasSupplierMatch: matchedRaws.length > 0,
        hasPriceSnapshot: supplierPrices.length > 0,
        cheapest,
        secondCheapest,
        absoluteSaving,
        supplierCount: supplierPrices.length,
        allPrices: supplierPrices
      });
    }

    searchResultsList.sort((a, b) => {
      if (a.hasPriceSnapshot && !b.hasPriceSnapshot) return -1;
      if (!a.hasPriceSnapshot && b.hasPriceSnapshot) return 1;
      if (a.cheapest && b.cheapest) return a.cheapest.casePrice - b.cheapest.casePrice;
      return 0;
    });

    return res.json({
      success: true,
      activeVersionName: activeVer.version_name,
      results: searchResultsList
    });

  } catch (err) {
    console.error('[Retailer API] Search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/retailer/deals
router.get('/deals', async (req, res) => {
  try {
    // 1. Get active catalogue version
    const { data: activeVer, error: verErr } = await supabase
      .from('catalogue_versions')
      .select('id, version_name')
      .eq('is_active', true)
      .single();

    if (verErr || !activeVer) {
      return res.json({ success: true, deals: [], message: 'No active catalogue version found.' });
    }

    // 2. Fetch all active catalogue items
    const { data: catItems, error: catErr } = await supabase
      .from('catalogue_items')
      .select('id, barcode, name, source_price_mark')
      .eq('version_id', activeVer.id);

    if (catErr) throw catErr;

    const barcodes = (catItems || []).map(c => c.barcode).filter(Boolean);

    // 3. Query raw_products and price_snapshots
    const { data: rawProds } = await supabase
      .from('raw_products')
      .select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)')
      .in('raw_barcode', barcodes);

    const rawIds = (rawProds || []).map(r => r.id);

    const { data: snapshots } = await supabase
      .from('price_snapshots')
      .select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at')
      .in('raw_product_id', rawIds)
      .order('snapshot_at', { ascending: false });

    // 4. Calculate deals across items with 2+ supplier price snapshots
    const dealsList = [];

    for (const catItem of (catItems || [])) {
      const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
      const supplierPrices = [];

      for (const raw of matchedRaws) {
        const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
        if (snap && snap.case_price > 0) {
          const casePrice = parseFloat(snap.case_price);
          const unitPrice = snap.unit_cost 
            ? parseFloat(snap.unit_cost) 
            : (casePrice / 12);

          supplierPrices.push({
            supplier: raw.suppliers?.name || 'Wholesaler',
            supplierId: raw.supplier_id,
            casePrice,
            unitPrice: unitPrice.toFixed(2),
            supplierCode: raw.raw_product_code,
            supplierUrl: raw.raw_url,
            inStock: snap.in_stock !== false,
            scrapedAt: snap.snapshot_at,
            packInfo: raw.raw_pack_info
          });
        }
      }

      // Include items with at least 1 price snapshot (rank multi-supplier savings highest)
      if (supplierPrices.length > 0) {
        supplierPrices.sort((a, b) => a.casePrice - b.casePrice);
        const cheapest = supplierPrices[0];
        const secondCheapest = supplierPrices.length > 1 ? supplierPrices[1] : null;

        const absoluteSaving = secondCheapest 
          ? (secondCheapest.casePrice - cheapest.casePrice) 
          : 0;

        const percentageSaving = secondCheapest 
          ? ((absoluteSaving / secondCheapest.casePrice) * 100) 
          : 0;

        dealsList.push({
          id: catItem.id,
          barcode: catItem.barcode,
          name: catItem.name,
          priceMark: catItem.source_price_mark,
          cheapestSupplier: cheapest.supplier,
          cheapestPrice: cheapest.casePrice,
          cheapestUnitPrice: cheapest.unitPrice,
          secondCheapestSupplier: secondCheapest?.supplier || null,
          secondCheapestPrice: secondCheapest?.casePrice || null,
          absoluteSaving: absoluteSaving.toFixed(2),
          percentageSaving: percentageSaving.toFixed(0),
          supplierCount: supplierPrices.length,
          allPrices: supplierPrices,
          scrapedAt: cheapest.scrapedAt,
          inStock: cheapest.inStock
        });
      }
    }

    // Rank deals by highest absolute saving per case first, then by multi-supplier coverage
    dealsList.sort((a, b) => {
      const saveDiff = parseFloat(b.absoluteSaving) - parseFloat(a.absoluteSaving);
      if (saveDiff !== 0) return saveDiff;
      return b.supplierCount - a.supplierCount;
    });

    return res.json({
      success: true,
      activeVersionName: activeVer.version_name,
      deals: dealsList
    });

  } catch (err) {
    console.error('[Retailer API] Deals error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
