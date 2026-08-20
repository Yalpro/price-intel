import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, ShieldCheck, TrendingDown, Package, ArrowRight, Eye, RefreshCw } from 'lucide-react';

const ProductSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery);
    }
  }, [initialQuery]);

  const executeSearch = async (queryStr) => {
    if (!queryStr.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/retailer/search?q=${encodeURIComponent(queryStr.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Search execution error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSearchParams({ q: searchTerm.trim() });
      executeSearch(searchTerm.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-inter text-textPrimary">
      {/* Search Header */}
      <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
        <div>
          <h1 className="text-xl md:text-2xl font-sora font-bold text-textPrimary tracking-tight">
            Wholesale Product Search & Intelligence
          </h1>
          <p className="text-xs md:text-sm text-textSecondary mt-0.5">
            Search verified wholesale price snapshots across UK wholesalers by product name, brand, or EAN barcode
          </p>
        </div>

        {/* Large Touch Search Form */}
        <form onSubmit={handleFormSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter product title (e.g. Coca Cola), brand, or 13-digit EAN..."
              className="w-full pl-11 pr-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-sora font-semibold text-sm transition-colors cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Search Results */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-2xl p-4 animate-pulse" />
          ))}
        </div>
      ) : hasSearched ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-textSecondary">
              Found {results.length} verified products matching "{initialQuery}"
            </span>
          </div>

          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface border border-border hover:border-emerald-800/60 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-14 h-14 object-contain rounded-xl bg-[#0A0E0C] p-1 border border-border shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#0A0E0C] border border-border flex items-center justify-center text-accentMint shrink-0">
                        <Package size={24} />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold text-accentMint uppercase tracking-wider bg-savingBg px-2 py-0.5 rounded border border-emerald-800">
                        {item.category}
                      </span>
                      <h3 className="font-sora font-bold text-base text-textPrimary mt-1">{item.name}</h3>
                      <div className="text-xs font-mono text-textSecondary mt-0.5">EAN: {item.barcode}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end md:self-auto text-right">
                    {item.cheapest ? (
                      <div>
                        <div className="text-[10px] text-textSecondary uppercase font-bold">Cheapest Offer</div>
                        <div className="font-sora font-extrabold text-lg text-accentMint">
                          {item.cheapest.supplier} (£{item.cheapest.casePrice.toFixed(2)})
                        </div>
                        <div className="text-xs text-textSecondary font-mono">{item.supplierCount} Suppliers Verified</div>
                      </div>
                    ) : (
                      <span className="text-xs text-textSecondary font-mono">No Active Snapshot</span>
                    )}

                    <Link
                      to={`/app/product/${item.id}`}
                      className="px-4 py-2 bg-[#1A221D] hover:bg-accent hover:text-white text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-border"
                    >
                      <span>Compare</span>
                      <Eye size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border p-12 rounded-2xl text-center space-y-3">
              <Search size={32} className="mx-auto text-textSecondary" />
              <h3 className="font-sora font-bold text-base text-textPrimary">No Verified Products Found</h3>
              <p className="text-xs text-textSecondary max-w-md mx-auto">No verified catalogue products matched your search term "{initialQuery}". Try searching by 13-digit EAN barcode or brand name.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ProductSearch;
