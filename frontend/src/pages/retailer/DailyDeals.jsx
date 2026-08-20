import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Flame, TrendingDown, Filter, Search, ArrowUpDown, ShieldCheck, Clock, Package, Building2, CheckCircle2, RefreshCw, Eye } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

const categories = [
  'All',
  'Soft Drinks',
  'Energy Drinks',
  'Water',
  'Confectionery',
  'Snacks',
  'Grocery',
  'Frozen',
  'Alcohol'
];

const DailyDeals = () => {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [sortBy, setSortBy] = useState('saving_desc');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDeals();
  }, [selectedCategory, selectedSupplier, sortBy]);

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      let url = `/api/retailer/deals?category=${encodeURIComponent(selectedCategory)}&sortBy=${sortBy}`;
      if (selectedSupplier) url += `&supplier=${encodeURIComponent(selectedSupplier)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      }
    } catch (err) {
      console.error('Error fetching retailer daily deals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDeals = deals.filter(deal => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return deal.name.toLowerCase().includes(q) || String(deal.barcode).includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-inter text-textPrimary">
      {/* Header Banner */}
      <div className="bg-surface border border-border p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="text-accent" size={24} />
            <h1 className="text-xl md:text-2xl font-sora font-bold text-textPrimary tracking-tight">
              Verified Wholesale Daily Deals
            </h1>
          </div>
          <p className="text-xs md:text-sm text-textSecondary mt-1">
            Real-time wholesale price comparison & arbitrage opportunities derived strictly from verified supplier snapshots
          </p>
        </div>

        <button onClick={fetchDeals} className="p-2.5 bg-[#0A0E0C] hover:bg-[#1A221D] border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shrink-0">
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Deals</span>
        </button>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
              selectedCategory === cat
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-textSecondary border-border hover:bg-[#1A221D] hover:text-textPrimary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="bg-surface border border-border p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
            <input
              type="text"
              placeholder="Search deals in category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0A0E0C] border border-border rounded-xl text-xs text-textPrimary focus:outline-none focus:border-accent"
            />
          </div>

          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
          >
            <option value="">All Wholesalers</option>
            <option value="BESTWAY">BESTWAY</option>
            <option value="COSTCO">COSTCO</option>
            <option value="PARFETTS">PARFETTS</option>
            <option value="BOOKER">BOOKER</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-textSecondary" />
          <span className="text-xs text-textSecondary font-medium hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#0A0E0C] border border-border text-textPrimary rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-accent"
          >
            <option value="saving_desc">Highest £ Saving</option>
            <option value="pct_desc">Highest % Saving</option>
            <option value="price_asc">Lowest Wholesale Price</option>
            <option value="updated_desc">Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Grid of Deal Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-surface border border-border rounded-2xl p-6 animate-pulse space-y-4">
              <div className="h-4 bg-[#1A221D] rounded w-3/4" />
              <div className="h-20 bg-[#0A0E0C] rounded-xl" />
              <div className="h-8 bg-[#1A221D] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredDeals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal) => (
            <div
              key={deal.id}
              className="bg-surface border border-border hover:border-emerald-800/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all group"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  {deal.imageUrl ? (
                    <img src={deal.imageUrl} alt={deal.name} className="w-12 h-12 object-contain rounded-lg bg-[#0A0E0C] p-1 border border-border shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0A0E0C] border border-border flex items-center justify-center text-accentMint shrink-0">
                      <Package size={20} />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-accentMint uppercase tracking-wider">
                      {deal.category}
                    </span>
                    <h3 className="font-sora font-bold text-sm text-textPrimary line-clamp-2 mt-0.5 group-hover:text-accentMint transition-colors">
                      {deal.name}
                    </h3>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase shrink-0 border ${
                  deal.freshness === 'FRESH' ? 'bg-savingBg text-accentMint border-emerald-800' : 'bg-[#141B17] text-textSecondary border-border'
                }`}>
                  {deal.freshness}
                </span>
              </div>

              {/* Price Details */}
              <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-textSecondary uppercase font-bold">Cheapest Supplier</span>
                    <div className="font-sora font-bold text-sm text-accentMint">{deal.cheapestSupplier}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-sora font-extrabold text-xl text-accentMint">£{deal.cheapestPrice.toFixed(2)}</div>
                    <div className="text-[11px] font-mono text-textSecondary">£{deal.cheapestUnitPrice} / unit</div>
                  </div>
                </div>

                {deal.secondCheapestSupplier && (
                  <div className="pt-2 border-t border-border/50 flex justify-between items-center text-xs">
                    <span className="text-textSecondary">Next: {deal.secondCheapestSupplier}</span>
                    <span className="font-mono text-textSecondary">£{deal.secondCheapestPrice?.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="flex justify-between items-center pt-1">
                {parseFloat(deal.absoluteSaving) > 0 ? (
                  <div className="flex items-center gap-1 font-sora font-extrabold text-sm text-accentMint">
                    <TrendingDown size={16} />
                    <span>Save £{deal.absoluteSaving} ({deal.percentageSaving}%)</span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-textSecondary">{deal.supplierCount} Verified Offers</span>
                )}

                <Link
                  to={`/app/product/${deal.id}`}
                  className="px-3.5 py-1.5 bg-[#1A221D] hover:bg-accent hover:text-white border border-border text-textPrimary rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Compare</span>
                  <Eye size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border p-12 rounded-2xl text-center space-y-3">
          <Flame size={32} className="mx-auto text-textSecondary" />
          <h3 className="font-sora font-bold text-base text-textPrimary">No Verified Deals Match Criteria</h3>
          <p className="text-xs text-textSecondary max-w-md mx-auto">Try selecting a different category or resetting wholesaler filters.</p>
        </div>
      )}
    </div>
  );
};

export default DailyDeals;
