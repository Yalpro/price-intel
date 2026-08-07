import React, { useState } from 'react';
import { Search, ScanBarcode, ExternalLink, Eye, Flame } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export const ProductSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);

    try {
      const q = query.trim().toLowerCase();

      // Search raw_products by raw_title or raw_barcode
      const { data: rawProds, error: rawErr } = await supabase
        .from('raw_products')
        .select(`
          id,
          supplier_id,
          raw_title,
          raw_barcode,
          raw_product_code,
          raw_url,
          scraped_at,
          suppliers ( id, name )
        `)
        .or(`raw_title.ilike.%${q}%,raw_barcode.ilike.%${q}%`)
        .limit(100);

      if (rawErr) throw rawErr;

      const rawIds = (rawProds || []).map(r => r.id);

      const { data: snaps } = await supabase
        .from('price_snapshots')
        .select('*')
        .in('raw_product_id', rawIds)
        .order('id', { ascending: false });

      // Group by barcode / title
      const dealsMap = new Map();

      for (const raw of (rawProds || [])) {
        const prodSnaps = (snaps || []).filter(s => s.raw_product_id === raw.id);
        if (prodSnaps.length > 0) {
          const snap = prodSnaps[0];
          const price = parseFloat(snap.case_price || snap.wholesale_price || 0);

          if (price > 0) {
            const bc = raw.raw_barcode || raw.raw_title;
            if (!dealsMap.has(bc)) {
              dealsMap.set(bc, {
                barcode: raw.raw_barcode,
                title: raw.raw_title,
                prices: []
              });
            }
            dealsMap.get(bc).prices.push({
              supplier: raw.suppliers?.name || 'Costco',
              supplierId: raw.supplier_id,
              casePrice: price,
              unitPrice: snap.unit_price ? parseFloat(snap.unit_price) : (price / 12).toFixed(2),
              supplierCode: raw.raw_product_code,
              supplierUrl: raw.raw_url,
              inStock: snap.in_stock !== false,
              scrapedAt: snap.scraped_at || raw.scraped_at
            });
          }
        }
      }

      const searchList = [];
      for (const [bc, item] of dealsMap.entries()) {
        item.prices.sort((a, b) => a.casePrice - b.casePrice);
        const cheapest = item.prices[0];
        searchList.push({
          barcode: bc,
          title: item.title,
          cheapestSupplier: cheapest.supplier,
          cheapestPrice: cheapest.casePrice,
          cheapestUnitPrice: cheapest.unitPrice,
          allPrices: item.prices
        });
      }

      searchList.sort((a, b) => a.cheapestPrice - b.cheapestPrice);
      setResults(searchList);

    } catch (err) {
      console.error('Error during product search:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-inter">
      <div>
        <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Wholesale Product Search</h1>
        <p className="text-textSecondary text-sm mt-1">Search active catalogue products by name, brand or barcode to see live supplier comparisons.</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Coca Cola 330ml, Monster Energy, Red Bull, 5000112693577..."
            className="w-full pl-12 pr-4 py-3.5 bg-surface border border-border rounded-xl text-textPrimary text-sm focus:outline-none focus:border-accent transition-all shadow-sm font-inter"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-6 py-3.5 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results Listing */}
      {results === null ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
          <ScanBarcode size={36} className="mx-auto text-textSecondary opacity-50" />
          <h3 className="text-lg font-semibold text-textPrimary">Search for a product to compare wholesale prices</h3>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            Enter any product name or barcode above to instantly query prices across Booker, Parfetts, Bestway, and Costco.
          </p>
        </div>
      ) : results.length === 0 && !isSearching ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-3">
          <Search size={36} className="mx-auto text-textSecondary opacity-50" />
          <h3 className="text-lg font-semibold text-textPrimary">No matched products found for "{query}"</h3>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            Try a broader keyword or search by exact EAN barcode. If this product isn't tracked yet, you can request it on the Request page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-mono text-textSecondary font-semibold uppercase">Search Results ({results.length})</p>
          {results.map((product) => (
            <div 
              key={product.barcode} 
              className="bg-surface border border-border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-accent/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-sora font-semibold text-textPrimary text-base">{product.title}</h4>
                  {product.barcode && (
                    <span className="font-mono text-xs text-textSecondary bg-[#1A221D] px-2 py-0.5 rounded">
                      {product.barcode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-textSecondary font-mono">
                  Cheapest: <span className="text-accent font-semibold">{product.cheapestSupplier}</span> ({product.allPrices.length} suppliers available)
                </p>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="text-right font-mono">
                  <p className="text-lg font-bold text-accentMint">£{product.cheapestPrice.toFixed(2)}</p>
                  <p className="text-[11px] text-textSecondary">£{product.cheapestUnitPrice}/unit</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedProduct(product);
                    setShowComparisonModal(true);
                  }}
                  className="px-3.5 py-2 bg-accent hover:bg-accentHover text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={14} />
                  <span>Compare</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono text-accentMint uppercase tracking-wider">Product Comparison</span>
                <h3 className="text-xl font-sora font-bold text-textPrimary mt-1">{selectedProduct.title}</h3>
                {selectedProduct.barcode && <span className="font-mono text-xs text-textSecondary">Barcode: {selectedProduct.barcode}</span>}
              </div>
              <button onClick={() => setShowComparisonModal(false)} className="text-textSecondary hover:text-textPrimary p-1 text-xl">✕</button>
            </div>

            <div className="space-y-3">
              {selectedProduct.allPrices.map((p, idx) => (
                <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between ${idx === 0 ? 'bg-savingBg/50 border-accent ring-1 ring-accent/40' : 'bg-[#0A0E0C] border-border'}`}>
                  <div>
                    <span className="font-sora font-bold text-base text-textPrimary">{p.supplier}</span>
                    {idx === 0 && <span className="ml-2 text-[10px] font-mono font-bold bg-accent text-white px-2 py-0.5 rounded-full">CHEAPEST</span>}
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-lg font-bold ${idx === 0 ? 'text-accentMint' : 'text-textPrimary'}`}>£{p.casePrice.toFixed(2)}</p>
                    {p.supplierUrl && (
                      <a href={p.supplierUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                        <span>View Portal</span> <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setShowComparisonModal(false)} className="px-5 py-2 bg-[#1E2621] text-textPrimary text-sm font-semibold rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
