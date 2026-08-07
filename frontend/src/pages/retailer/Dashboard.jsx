import React, { useState } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { Search, Sparkles, Building2, TrendingDown, ArrowRight, Zap, CheckCircle2, Star } from 'lucide-react';

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);

  const trialStarted = location.state?.trialStarted;

  const sampleProducts = [
    {
      id: '1',
      name: 'Coca-Cola Original Taste 24 × 330ml',
      barcode: '5449000000996',
      category: 'Soft Drinks',
      cheapestSupplier: 'Parfetts',
      cheapestPrice: '10.89',
      highestPrice: '11.49',
      savings: '0.60',
    },
    {
      id: '2',
      name: 'Red Bull Energy Drink 24 × 250ml',
      barcode: '90162602',
      category: 'Energy Drinks',
      cheapestSupplier: 'Booker',
      cheapestPrice: '21.50',
      highestPrice: '22.80',
      savings: '1.30',
    },
    {
      id: '3',
      name: 'Cadbury Dairy Milk Bar 24 × 110g',
      barcode: '7622210984321',
      category: 'Confectionery',
      cheapestSupplier: 'Costco',
      cheapestPrice: '16.20',
      highestPrice: '17.10',
      savings: '0.90',
    },
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    }
  };

  const handleChipClick = (term) => {
    setSearchInput(term);
    setSearchParams({ q: term });
  };

  return (
    <div className="space-y-8">

      {/* Trial Started Confirmation Banner */}
      {trialStarted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-success flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-success">14-Day Trial Active</p>
              <p className="text-xs text-slate-600">Welcome to PriceIntel! You can now search Booker, Parfetts, and Costco prices.</p>
            </div>
          </div>
        </div>
      )}

      {/* Prominent Search Banner */}
      <div className="bg-white border border-border rounded-2xl p-8 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-accentSoft text-accent flex items-center justify-center mx-auto mb-4">
          <Search size={24} strokeWidth={2} />
        </div>
        <h1 className="font-sora font-bold text-2xl sm:text-3xl text-textPrimary tracking-tight mb-2">
          Compare Wholesale Prices Across UK Wholesalers
        </h1>
        <p className="text-sm text-textSecondary max-w-xl mx-auto mb-6">
          Find who has the cheapest stock today between Booker, Parfetts, and Costco.
        </p>

        {/* Big Search Bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search size={18} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter product name, brand or barcode (e.g. Coca-Cola 24x330ml)..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-border rounded-xl text-sm font-medium text-textPrimary focus:bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-accent text-white font-semibold rounded-xl text-sm hover:bg-teal-800 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>

        {/* Sample Search Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-textSecondary font-medium">Popular searches:</span>
          {['Coca-Cola 24x330ml', 'Red Bull 250ml', 'Cadbury Dairy Milk', 'Monster Energy'].map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-border rounded-full font-medium text-slate-700 transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Results or Empty State */}
      {!query ? (
        // Honest Empty State
        <div className="bg-white border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-textSecondary">
            <Search size={28} strokeWidth={1.5} />
          </div>
          <h2 className="font-sora font-semibold text-lg text-textPrimary mb-1">
            Search for a product to compare prices
          </h2>
          <p className="text-sm text-textSecondary max-w-sm mx-auto mb-6">
            Type any brand, product name or barcode in the search bar above to see live supplier comparisons.
          </p>

          <div className="text-left max-w-2xl mx-auto border-t border-border pt-6">
            <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider mb-4">Sample Tracked Lines</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sampleProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/app/product/${p.id}`}
                  className="bg-slate-50 border border-border rounded-xl p-4 hover:border-accent hover:shadow-xs transition-all group"
                >
                  <p className="font-sora font-semibold text-xs text-textPrimary group-hover:text-accent mb-2 line-clamp-2">
                    {p.name}
                  </p>
                  <div className="flex items-center justify-between text-xs text-textSecondary">
                    <span>Cheapest: <strong className="text-accent">{p.cheapestSupplier}</strong></span>
                    <span className="font-mono font-bold text-textPrimary tabular-nums">£{p.cheapestPrice}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Search Results View
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-sora font-semibold text-lg text-textPrimary">
              Results for "<span className="text-accent">{query}</span>"
            </h2>
            <span className="text-xs text-textSecondary font-mono">{sampleProducts.length} products found</span>
          </div>

          <div className="space-y-3">
            {sampleProducts.map((item) => (
              <div key={item.id} className="bg-white border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{item.barcode}</span>
                    <span className="text-xs text-textSecondary">• {item.category}</span>
                  </div>
                  <Link to={`/app/product/${item.id}`} className="font-sora font-semibold text-base text-textPrimary hover:text-accent transition-colors">
                    {item.name}
                  </Link>
                </div>

                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                  <div>
                    <span className="text-[11px] text-textSecondary block">Cheapest supplier</span>
                    <span className="text-xs font-semibold text-accent">{item.cheapestSupplier}</span>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-textPrimary tabular-nums">
                      £{item.cheapestPrice}
                    </div>
                    <span className="text-[11px] text-success font-medium">Save £{item.savings}</span>
                  </div>

                  <Link
                    to={`/app/product/${item.id}`}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-textPrimary text-xs font-semibold rounded-lg transition-colors shrink-0"
                  >
                    Compare prices
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
