import React, { useState } from 'react';
import { Search, ScanBarcode } from 'lucide-react';
import { EmptyState } from '../../components/UIComponents';

const ProductSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    // Future: query canonical_products via Supabase or backend API
    // For now, simulate no results
    setTimeout(() => {
      setResults([]);
      setIsSearching(false);
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Search Products</h1>
        <p className="text-textSecondary text-sm mt-1">Search by product name, brand or barcode to compare wholesale supplier prices.</p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} strokeWidth={1.75} className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Monster Energy 500ml, Coca Cola, 5000112637922..."
            className="w-full pl-12 pr-4 py-3.5 bg-surface border border-border rounded-lg text-textPrimary text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all shadow-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-6 py-3.5 bg-accent text-white font-semibold rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {results === null ? (
        <EmptyState
          icon={ScanBarcode}
          title="Search for a product to compare supplier prices"
          description="Enter a product name, brand name or barcode above. Results show approved products from your active catalogue with current supplier pricing."
        />
      ) : results.length === 0 && !isSearching ? (
        <EmptyState
          icon={Search}
          title="No approved products matched your search"
          description="Try a broader product name or brand. Products must be in the active catalogue and matched before they appear here. New products may take up to 24 hours to appear."
        />
      ) : (
        <div className="space-y-3">
          {results.map((product) => (
            <div key={product.id} className="bg-surface border border-border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-textPrimary">{product.canonical_name}</p>
                  <p className="text-sm text-textSecondary mt-0.5">{product.brand} · {product.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg text-accent">£{product.lowest_price?.toFixed(2)}</p>
                  <p className="text-xs text-textSecondary">lowest price</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
