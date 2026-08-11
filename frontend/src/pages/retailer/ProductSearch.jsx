import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ScanBarcode, ExternalLink, Eye, AlertCircle, Clock, CheckCircle2, TrendingDown, RefreshCw, PlusCircle, Sparkles, X
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const ProductSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [activeVersionName, setActiveVersionName] = useState('');

  // Autocomplete / Typeahead State
  const [suggestions, setSuggestions] = useState([]);
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const isSelectingRef = useRef(false);
  const searchContainerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Autocomplete Fetcher
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }

    const searchTerm = query.trim();
    if (searchTerm.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const handler = setTimeout(async () => {
      setIsAutocompleting(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/retailer/autocomplete?q=${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setSuggestions(data.suggestions || []);
            setShowDropdown(true);
            setSelectedIndex(-1);
          }
        }
      } catch (err) {
        console.error('Autocomplete fetch error:', err);
      } finally {
        setIsAutocompleting(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [query]);

  // Handle Exact Selection from Suggestions
  const handleSelectSuggestion = (suggestion) => {
    isSelectingRef.current = true;
    setQuery(suggestion.name);
    setShowDropdown(false);
    setSuggestions([]);
    
    // Execute exact price search using selected product barcode or name
    const exactSearchTerm = suggestion.barcode || suggestion.name;
    executeExactSearch(exactSearchTerm);
  };

  const executeExactSearch = async (searchTerm) => {
    if (!searchTerm) return;
    setIsSearching(true);
    setShowDropdown(false);

    try {
      // Fetch from backend API
      const apiRes = await fetch(`${API_BASE_URL}/api/retailer/search?q=${encodeURIComponent(searchTerm)}`);
      
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success) {
          setActiveVersionName(apiData.activeVersionName || '');
          setResults(apiData.results || []);
          setIsSearching(false);
          return;
        }
      }

      // Fallback: Direct database search
      const { data: activeVer } = await supabase
        .from('catalogue_versions')
        .select('id, version_name')
        .eq('is_active', true)
        .single();

      if (!activeVer) {
        setResults([]);
        return;
      }
      setActiveVersionName(activeVer.version_name);

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

      const { data: catItems } = await catQuery.limit(50);
      if (!catItems || catItems.length === 0) {
        setResults([]);
        return;
      }

      const barcodes = catItems.map(c => c.barcode).filter(Boolean);

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

      setResults(searchResultsList);

    } catch (err) {
      console.error('Error executing catalogue search:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (showDropdown && selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelectSuggestion(suggestions[selectedIndex]);
      return;
    }
    executeExactSearch(query.trim());
  };

  // Keyboard Navigation Handler
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setShowDropdown(true);
        setSelectedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleQuickSearch = (term) => {
    setQuery(term);
    isSelectingRef.current = true;
    executeExactSearch(term);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-inter">
      {/* Header */}
      <div>
        <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Wholesale Product Search</h1>
        <p className="text-textSecondary text-sm mt-1">
          Search active UK catalogue products across Booker, Parfetts, Bestway, and Costco for live wholesale price comparisons.
        </p>
      </div>

      {/* Search Input Bar with Production Autocomplete / Typeahead Dropdown */}
      <div ref={searchContainerRef} className="relative z-30">
        <div className="bg-surface border border-border p-4 sm:p-6 rounded-2xl space-y-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex gap-3 relative">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  if (!showDropdown && e.target.value.trim().length >= 1) {
                    setShowDropdown(true);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0 && query.trim().length >= 1) {
                    setShowDropdown(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to search catalogue (e.g. Coca Cola, Monster Energy, 5000112693577)..."
                className="w-full pl-12 pr-10 py-3.5 bg-[#0A0E0C] border border-border rounded-xl text-textPrimary text-sm focus:outline-none focus:border-accent transition-all shadow-sm font-inter"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-6 py-3.5 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 cursor-pointer shrink-0 shadow-sm"
            >
              {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
            </button>
          </form>

          {/* Quick Search Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
            <span className="text-textSecondary">Popular Searches:</span>
            <button onClick={() => handleQuickSearch('Coca Cola')} className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322b] text-textPrimary rounded-lg border border-border transition-colors">
              Coca Cola
            </button>
            <button onClick={() => handleQuickSearch('Monster Energy')} className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322b] text-textPrimary rounded-lg border border-border transition-colors">
              Monster Energy
            </button>
            <button onClick={() => handleQuickSearch('5000112693577')} className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322b] text-textPrimary rounded-lg border border-border transition-colors">
              EAN: 5000112693577
            </button>
            <button onClick={() => handleQuickSearch('5060688010055')} className="px-2.5 py-1 bg-[#1A221D] hover:bg-[#25322b] text-textPrimary rounded-lg border border-border transition-colors">
              EAN: 5060688010055
            </button>
          </div>
        </div>

        {/* Autocomplete / Typeahead Dropdown */}
        {showDropdown && query.trim().length >= 1 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50 font-inter divide-y divide-border/60">
            {isAutocompleting ? (
              <div className="p-4 text-center font-mono text-xs text-textSecondary flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-accent" />
                <span>Searching active catalogue SKUs...</span>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="max-h-72 overflow-y-auto">
                <div className="px-4 py-2 bg-[#0A0E0C] text-[10px] font-mono font-bold text-textSecondary uppercase tracking-wider flex justify-between items-center">
                  <span>Catalogue Suggestions ({suggestions.length})</span>
                  <span>Use ↑ ↓ Keys & Enter</span>
                </div>
                {suggestions.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id || idx}
                      onClick={() => handleSelectSuggestion(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors border-l-4 ${
                        isSelected 
                          ? 'bg-[#1E2621] border-accent text-textPrimary' 
                          : 'bg-surface border-transparent hover:bg-[#1A221D] text-textPrimary'
                      }`}
                    >
                      <div className="space-y-0.5 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.name}</span>
                          {item.priceMark && (
                            <span className="text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded font-bold">
                              {item.priceMark}
                            </span>
                          )}
                        </div>
                        {item.barcode && (
                          <p className="text-xs font-mono text-accentMint">EAN: {item.barcode}</p>
                        )}
                      </div>

                      <div className="text-right font-mono text-xs text-textSecondary flex items-center gap-1">
                        <span className="hidden sm:inline">Select</span>
                        <Sparkles size={13} className={isSelected ? 'text-accent' : 'opacity-40'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 text-center space-y-2">
                <p className="text-xs font-mono text-textSecondary">No matching catalogue products for "{query}"</p>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate(`/app/request?q=${encodeURIComponent(query)}`);
                  }}
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={14} />
                  <span>Request "{query}" Product</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Initial Landing Placeholder */}
      {results === null && (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#0A0E0C] border border-border flex items-center justify-center mx-auto text-accent">
            <ScanBarcode size={28} />
          </div>
          <h3 className="text-lg font-sora font-bold text-textPrimary">Search active UK wholesale catalogue</h3>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            Type any product title or EAN barcode above to view instant catalogue suggestions and compare live prices across Booker, Parfetts, Bestway, and Costco.
          </p>
        </div>
      )}

      {/* Empty / Unmatched State */}
      {results !== null && results.length === 0 && !isSearching && (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/30 text-danger flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-sora font-bold text-textPrimary">No matched products found for "{query}"</h3>
            <p className="text-xs font-mono text-textSecondary max-w-md mx-auto">
              This item is not present in the current active 1,000 product catalogue.
            </p>
          </div>

          <div className="p-4 bg-[#0A0E0C] border border-border rounded-xl max-w-md mx-auto text-left text-xs font-mono space-y-2 text-textSecondary">
            <p className="text-textPrimary font-semibold">💡 What you can do:</p>
            <p>• Verify the barcode digits or try a broader brand name search.</p>
            <p>• Submit a product request below to add this SKU to our daily scraper queue.</p>
          </div>

          <button
            onClick={() => navigate(`/app/request?q=${encodeURIComponent(query)}`)}
            className="px-6 py-3 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl text-xs transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <PlusCircle size={16} />
            <span>Request "{query}" Product</span>
          </button>
        </div>
      )}

      {/* Search Results List */}
      {results !== null && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs font-mono text-textSecondary font-semibold uppercase">
              Matched Catalogue SKUs ({results.length}) {activeVersionName && `— Active: ${activeVersionName}`}
            </p>
          </div>

          <div className="space-y-4">
            {results.map((product) => (
              <div 
                key={product.id} 
                className="bg-surface border border-border rounded-2xl p-6 space-y-4 hover:border-accent/40 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-sora font-bold text-lg text-textPrimary tracking-tight">{product.name}</h3>
                      {product.priceMark && (
                        <span className="text-[11px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">
                          {product.priceMark}
                        </span>
                      )}
                    </div>
                    {product.barcode && (
                      <span className="font-mono text-xs text-textSecondary mt-1 block">
                        EAN Barcode: <strong className="text-textPrimary">{product.barcode}</strong>
                      </span>
                    )}
                  </div>

                  {/* Price Data Availability Badge */}
                  <div>
                    {product.hasPriceSnapshot ? (
                      <div className="text-right">
                        <span className="text-[10px] font-mono font-bold bg-savingBg text-accentMint border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                          {product.supplierCount} Wholesaler{product.supplierCount > 1 ? 's' : ''} Compared
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800 px-2.5 py-1 rounded-full">
                        {product.hasSupplierMatch ? 'Product in Active Catalogue — Supplier Price Scrape Pending' : 'No Supplier Match in Daily Scrape'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Savings Summary Row */}
                {product.hasPriceSnapshot ? (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0A0E0C] p-4 rounded-xl border border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-textSecondary uppercase">Cheapest Wholesaler:</span>
                        <span className="font-sora font-bold text-sm text-accent uppercase tracking-wider">
                          {product.cheapest.supplier}
                        </span>
                      </div>
                      
                      {parseFloat(product.absoluteSaving) > 0 && (
                        <div className="flex items-center gap-1.5 text-accentMint text-xs font-mono font-semibold">
                          <TrendingDown size={14} />
                          <span>Save £{product.absoluteSaving} per case vs {product.secondCheapest?.supplier?.toUpperCase()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right font-mono">
                        <p className="text-xl font-bold text-accentMint">£{product.cheapest.casePrice.toFixed(2)} <span className="text-xs text-textSecondary font-normal">/case</span></p>
                        <p className="text-[11px] text-textSecondary">£{product.cheapest.unitPrice}/unit</p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowComparisonModal(true);
                        }}
                        className="px-4 py-2.5 bg-accent hover:bg-accentHover text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Eye size={14} />
                        <span>Compare All ({product.supplierCount})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#0A0E0C] rounded-xl border border-border font-mono text-xs text-textSecondary space-y-1">
                    <p className="text-amber-300 font-semibold flex items-center gap-2">
                      <AlertCircle size={14} /> Product in Active Catalogue — Supplier Price Scrape Pending
                    </p>
                    <p>
                      {product.hasSupplierMatch
                        ? 'Product is matched in catalogue, but price snapshot is pending next scheduled daily scrape.'
                        : 'Product is active in catalogue, but no wholesaler matching record was found during daily scrape.'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-xs font-mono text-accentMint uppercase tracking-wider font-semibold">Wholesale Price Comparison</span>
                <h3 className="text-lg font-sora font-bold text-textPrimary mt-0.5">{selectedProduct.name}</h3>
                {selectedProduct.barcode && <span className="font-mono text-xs text-textSecondary">EAN: {selectedProduct.barcode}</span>}
              </div>
              <button onClick={() => setShowComparisonModal(false)} className="text-textSecondary hover:text-textPrimary text-lg">✕</button>
            </div>

            <div className="space-y-3 font-inter">
              {selectedProduct.allPrices.map((p, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    idx === 0 
                      ? 'bg-savingBg/60 border-emerald-800 ring-1 ring-emerald-500/40' 
                      : 'bg-[#0A0E0C] border-border'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sora font-bold text-base text-textPrimary uppercase">{p.supplier}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-mono font-bold bg-accent text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={10} /> CHEAPEST
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-textSecondary">
                      <span>Status: {p.inStock ? <span className="text-accentMint">In Stock</span> : <span className="text-amber-400">Out of Stock</span>}</span>
                      {p.scrapedAt && <span>Scraped: {new Date(p.scrapedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <p className={`text-xl font-bold ${idx === 0 ? 'text-accentMint' : 'text-textPrimary'}`}>
                      £{p.casePrice.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-textSecondary">£{p.unitPrice}/unit</p>

                    {p.supplierUrl && (
                      <a 
                        href={p.supplierUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-accent hover:underline flex items-center gap-1 justify-end mt-1 font-sans font-medium"
                      >
                        <span>View Portal</span> <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setShowComparisonModal(false)} 
                className="px-5 py-2.5 bg-[#1A221D] text-textPrimary text-xs font-semibold rounded-xl hover:bg-[#25322b] transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
