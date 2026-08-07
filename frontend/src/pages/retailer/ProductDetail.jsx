import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Star, Bell, Building2, Zap, Clock, TrendingDown, Check, ShieldCheck, Share2 
} from 'lucide-react';

const ProductDetail = () => {
  const { id } = useParams();
  const [isSaved, setIsSaved] = useState(false);
  const [alertSet, setAlertSet] = useState(false);

  // Mock product details
  const product = {
    id: id || '1',
    name: 'Coca-Cola Original Taste 24 × 330ml',
    barcode: '5449000000996',
    category: 'Soft Drinks / Cans',
    brand: 'Coca-Cola',
    caseSize: '24 × 330ml',
    lastUpdated: 'Today at 06:00',
    suppliers: [
      { name: 'Parfetts', price: '10.89', unitPrice: '0.45', isCheapest: true, inStock: true, promotion: 'PROMO: Save £0.40 per case' },
      { name: 'Costco', price: '11.20', unitPrice: '0.47', isCheapest: false, inStock: true, promotion: null },
      { name: 'Booker', price: '11.49', unitPrice: '0.48', isCheapest: false, inStock: true, promotion: null },
    ],
  };

  const cheapest = product.suppliers.find(s => s.isCheapest);
  const mostExpensive = product.suppliers[product.suppliers.length - 1];
  const maxSavings = (parseFloat(mostExpensive.price) - parseFloat(cheapest.price)).toFixed(2);

  return (
    <div className="space-y-6">
      
      {/* Back Link */}
      <div>
        <Link to="/app" className="inline-flex items-center gap-2 text-xs font-medium text-textSecondary hover:text-textPrimary transition-colors">
          <ArrowLeft size={15} /> Back to search
        </Link>
      </div>

      {/* Product Top Header */}
      <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-textSecondary mb-2">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{product.barcode}</span>
            <span>• {product.category}</span>
          </div>
          <h1 className="font-sora font-bold text-2xl sm:text-3xl text-textPrimary tracking-tight mb-2">
            {product.name}
          </h1>
          <p className="text-xs text-textSecondary flex items-center gap-1.5 font-mono">
            <Clock size={13} /> Last updated: {product.lastUpdated}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isSaved
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-border text-textPrimary hover:bg-slate-50'
            }`}
          >
            <Star size={16} className={isSaved ? 'fill-amber-400 text-amber-500' : 'text-textSecondary'} />
            {isSaved ? 'Saved in Favourites' : 'Star Product'}
          </button>

          <button
            onClick={() => setAlertSet(!alertSet)}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              alertSet
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                : 'bg-accent text-white hover:bg-teal-800 shadow-xs'
            }`}
          >
            <Bell size={16} />
            {alertSet ? 'Price Alert Active' : 'Set Price Alert'}
          </button>
        </div>
      </div>

      {/* Savings Summary Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-success flex items-center justify-center shrink-0">
            <Zap size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-success">Cheapest Supplier Identified</span>
            <p className="text-sm font-semibold text-slate-800">
              Buy from <span className="text-accent font-bold">{cheapest.name}</span> at <span className="font-mono text-textPrimary">£{cheapest.price}</span> per case
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xs text-textSecondary block">Potential savings per case</span>
          <span className="font-mono text-xl font-extrabold text-success tabular-nums">
            Save £{maxSavings}
          </span>
        </div>
      </div>

      {/* Supplier Comparison Grid */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-border bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-sora font-semibold text-base text-textPrimary">
            Wholesale Price Comparison
          </h2>
          <span className="text-xs font-mono text-textSecondary">Tabular Prices (Mono)</span>
        </div>

        <div className="divide-y divide-border">
          {product.suppliers.map((s) => (
            <div
              key={s.name}
              className={`p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors ${
                s.isCheapest ? 'bg-accentSoft/30' : 'hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-sora font-bold text-sm shrink-0 ${
                  s.isCheapest ? 'bg-accent text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {s.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sora font-bold text-base text-textPrimary">{s.name}</span>
                    {s.isCheapest && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-white border border-accent/40 px-2 py-0.5 rounded-full">
                        Guaranteed Lowest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-textSecondary">
                    Case format: {product.caseSize} • <span className="text-emerald-700 font-medium">In Stock</span>
                  </p>
                  {s.promotion && (
                    <span className="inline-block mt-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      {s.promotion}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                <div className="text-left sm:text-right">
                  <span className="text-xs text-textSecondary block">Unit price</span>
                  <span className="font-mono text-sm font-semibold text-textPrimary tabular-nums">
                    £{s.unitPrice}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-textSecondary block">Case price</span>
                  <span className={`font-mono text-xl font-bold tabular-nums ${s.isCheapest ? 'text-accent' : 'text-textPrimary'}`}>
                    £{s.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Price History & Trends Shell */}
      <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
        <h3 className="font-sora font-semibold text-base text-textPrimary mb-4">
          Price History & Trend (30 Days)
        </h3>
        
        {/* Mock Chart Area */}
        <div className="h-48 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between text-xs text-textSecondary font-mono">
            <span>High: £11.49</span>
            <span>Average: £11.19</span>
            <span>Low: £10.89</span>
          </div>

          <div className="flex items-end justify-between gap-2 h-28 px-4 pt-4 border-b border-slate-300">
            {[11.49, 11.49, 11.20, 11.20, 10.89, 10.89, 10.89].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full bg-accent/70 group-hover:bg-accent rounded-t transition-all"
                  style={{ height: `${((val - 10) / 2) * 100}%` }}
                />
                <span className="text-[10px] font-mono text-slate-500">Day {idx * 5 + 1}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-textSecondary font-medium pt-2">
            Supplier prices have dropped by 5.2% over the last 30 days.
          </p>
        </div>
      </div>

    </div>
  );
};

export default ProductDetail;
