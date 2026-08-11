import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gvnozyrmujsffdahaqdh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bm96eXJtdWpzZmZkYWhhcWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk1NjI1MCwiZXhwIjoyMDk5NTMyMjUwfQ.iboqmERzYPFfShCsWXm9zMcjuIzy3Hz_KHW6gJqOY1g';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const reqUrl = req.url || '';

  try {
    const { data: activeVer } = await supabase
      .from('catalogue_versions')
      .select('id, version_name')
      .eq('is_active', true)
      .single();

    if (!activeVer) {
      return res.status(200).json({ success: true, suggestions: [], results: [], deals: [] });
    }

    if (reqUrl.includes('/api/retailer/autocomplete')) {
      const urlObj = new URL(reqUrl, 'https://anaprice.com');
      const query = (urlObj.searchParams.get('q') || '').trim().toLowerCase();

      if (!query) return res.status(200).json({ success: true, suggestions: [] });

      const isBarcode = /^\d{7,18}$/.test(query);
      let q = supabase.from('catalogue_items').select('id, barcode, name, source_price_mark').eq('version_id', activeVer.id);
      if (isBarcode) q = q.eq('barcode', query);
      else q = q.ilike('name', `%${query}%`);

      const { data: items } = await q.limit(25);

      const sorted = (items || []).sort((a, b) => {
        const aBc = (a.barcode || '').toLowerCase();
        const bBc = (b.barcode || '').toLowerCase();
        if (aBc === query) return -1;
        if (bBc === query) return 1;

        const aStarts = (a.name || '').toLowerCase().startsWith(query);
        const bStarts = (b.name || '').toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      const suggestions = sorted.slice(0, 10).map(i => ({
        id: i.id,
        name: i.name,
        barcode: i.barcode,
        priceMark: i.source_price_mark
      }));
      return res.status(200).json({ success: true, suggestions });
    }

    if (reqUrl.includes('/api/retailer/search')) {
      const urlObj = new URL(reqUrl, 'https://anaprice.com');
      const query = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
      if (!query) return res.status(200).json({ success: true, results: [] });

      const isBarcode = /^\d{7,18}$/.test(query);
      let catQuery = supabase.from('catalogue_items').select('id, barcode, name, source_price_mark').eq('version_id', activeVer.id);
      if (isBarcode) catQuery = catQuery.eq('barcode', query);
      else catQuery = catQuery.ilike('name', `%${query}%`);

      const { data: catItems } = await catQuery.limit(50);
      if (!catItems || catItems.length === 0) {
        return res.status(200).json({ success: true, results: [], activeVersionName: activeVer.version_name });
      }

      const barcodes = catItems.map(c => c.barcode).filter(Boolean);
      const { data: rawProds } = await supabase.from('raw_products').select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)').in('raw_barcode', barcodes);
      const rawIds = (rawProds || []).map(r => r.id);
      const { data: snapshots } = await supabase.from('price_snapshots').select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at').in('raw_product_id', rawIds).order('snapshot_at', { ascending: false });

      const results = [];
      for (const catItem of catItems) {
        const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
        const supplierPrices = [];

        for (const raw of matchedRaws) {
          const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
          if (snap && snap.case_price > 0) {
            const casePrice = parseFloat(snap.case_price);
            const unitPrice = snap.unit_cost ? parseFloat(snap.unit_cost) : (casePrice / 12);
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
        const absoluteSaving = (cheapest && secondCheapest) ? (secondCheapest.casePrice - cheapest.casePrice).toFixed(2) : '0.00';

        results.push({
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

      return res.status(200).json({ success: true, activeVersionName: activeVer.version_name, results });
    }

    if (reqUrl.includes('/api/retailer/deals')) {
      const { data: catItems } = await supabase.from('catalogue_items').select('id, barcode, name, source_price_mark').eq('version_id', activeVer.id);
      const barcodes = (catItems || []).map(c => c.barcode).filter(Boolean);
      const { data: rawProds } = await supabase.from('raw_products').select('id, supplier_id, raw_title, raw_barcode, raw_product_code, raw_url, raw_pack_info, suppliers(id, name)').in('raw_barcode', barcodes);
      const rawIds = (rawProds || []).map(r => r.id);
      const { data: snapshots } = await supabase.from('price_snapshots').select('id, raw_product_id, case_price, unit_cost, in_stock, snapshot_at').in('raw_product_id', rawIds).order('snapshot_at', { ascending: false });

      const deals = [];
      for (const catItem of (catItems || [])) {
        const matchedRaws = (rawProds || []).filter(r => r.raw_barcode === catItem.barcode);
        const supplierPrices = [];

        for (const raw of matchedRaws) {
          const snap = (snapshots || []).find(s => s.raw_product_id === raw.id);
          if (snap && snap.case_price > 0) {
            const casePrice = parseFloat(snap.case_price);
            const unitPrice = snap.unit_cost ? parseFloat(snap.unit_cost) : (casePrice / 12);
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

        if (supplierPrices.length >= 2) {
          supplierPrices.sort((a, b) => a.casePrice - b.casePrice);
          const cheapest = supplierPrices[0];
          const secondCheapest = supplierPrices[1];
          const absoluteSaving = (secondCheapest.casePrice - cheapest.casePrice);
          const percentageSaving = ((absoluteSaving / secondCheapest.casePrice) * 100);

          deals.push({
            id: catItem.id,
            barcode: catItem.barcode,
            name: catItem.name,
            priceMark: catItem.source_price_mark,
            cheapestSupplier: cheapest.supplier,
            cheapestPrice: cheapest.casePrice,
            cheapestUnitPrice: cheapest.unitPrice,
            secondCheapestSupplier: secondCheapest.supplier,
            secondCheapestPrice: secondCheapest.casePrice,
            absoluteSaving: absoluteSaving.toFixed(2),
            percentageSaving: percentageSaving.toFixed(0),
            supplierCount: supplierPrices.length,
            allPrices: supplierPrices,
            scrapedAt: cheapest.scrapedAt,
            inStock: cheapest.inStock
          });
        }
      }

      deals.sort((a, b) => parseFloat(b.absoluteSaving) - parseFloat(a.absoluteSaving));
      return res.status(200).json({ success: true, activeVersionName: activeVer.version_name, deals });
    }

    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  } catch (err) {
    console.error('[Vercel Serverless Handler] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
