import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Search, Zap, Bell, LineChart, Layers, 
  Check, Building2, Clock, CheckCircle2, ShieldCheck, RefreshCw, ChevronRight
} from 'lucide-react';

// Product Mockup Card (Kept with sample names as visual UI demonstration)
const ProductMockup = () => (
  <div className="bg-white rounded-2xl border border-border shadow-xl overflow-hidden max-w-lg w-full">
    {/* Card Header */}
    <div className="p-4 border-b border-border bg-slate-50/50 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-textPrimary">
        <Search size={16} strokeWidth={2} className="text-accent" />
        <span>Product Comparison Snapshot</span>
      </div>
      <span className="text-xs font-mono text-textSecondary bg-white border border-border px-2 py-0.5 rounded-md">
        Daily Scan: Today 06:00
      </span>
    </div>

    {/* Product Info */}
    <div className="p-5 border-b border-border">
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-sora font-semibold text-textPrimary text-base">
          Coca-Cola Original Taste 24 × 330ml
        </h3>
        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
          5449000000996
        </span>
      </div>
      <p className="text-xs text-textSecondary">Category: Soft Drinks / Soft Drinks Cans</p>
    </div>

    {/* Prices Table */}
    <div className="p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-textSecondary">Live Supplier Prices</p>
      
      {[
        { supplier: 'Wholesaler A', price: '10.89', unitPrice: '0.45', isCheapest: true, status: 'In Stock' },
        { supplier: 'Wholesaler B', price: '11.20', unitPrice: '0.47', isCheapest: false, status: 'In Stock' },
        { supplier: 'Wholesaler C', price: '11.49', unitPrice: '0.48', isCheapest: false, status: 'In Stock' },
      ].map((row) => (
        <div
          key={row.supplier}
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
            row.isCheapest
              ? 'border-accent bg-accentSoft/40 ring-1 ring-accent/30'
              : 'border-border bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-sora font-bold text-xs ${
              row.isCheapest ? 'bg-accent text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {row.supplier.slice(-1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-textPrimary">{row.supplier}</span>
                {row.isCheapest && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-white border border-accent/40 px-1.5 py-0.5 rounded">
                    Cheapest
                  </span>
                )}
              </div>
              <span className="text-xs text-textSecondary">Unit: £{row.unitPrice}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-base font-bold tabular-nums text-textPrimary">
              £{row.price}
            </div>
            <span className="text-[11px] text-textSecondary">Case of 24</span>
          </div>
        </div>
      ))}
    </div>

    {/* Savings Alert Banner */}
    <div className="px-5 pb-5">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-success flex items-center justify-center shrink-0">
            <Zap size={16} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-xs font-semibold text-success uppercase tracking-wider">Instant Margin Gain</p>
            <p className="text-xs text-slate-700">Buying from cheapest supplier saves money</p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-base font-extrabold text-success tabular-nums">
            Save £0.60
          </span>
          <p className="text-[10px] text-textSecondary">vs highest (£11.49)</p>
        </div>
      </div>
    </div>
  </div>
);

const Home = () => {
  return (
    <div className="space-y-0">
      
      {/* 1. HERO SECTION */}
      <section className="pt-16 pb-24 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-16">
            
            {/* Left Copy */}
            <div className="flex-1 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-accentSoft text-accent text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 border border-accent/20">
                <Zap size={13} strokeWidth={2.2} />
                <span>Wholesale Price Intelligence for Retailers</span>
              </div>
              
              <h1 className="font-sora font-extrabold text-4xl sm:text-5xl lg:text-6xl text-textPrimary leading-[1.12] tracking-tight mb-6">
                Compare wholesale prices in seconds.
              </h1>
              
              <p className="text-lg sm:text-xl text-textSecondary leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                PriceIntel scans your wholesale suppliers daily, instantly revealing the cheapest price for your store lines.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center px-7 py-3.5 bg-accent text-white font-semibold rounded-xl hover:bg-teal-800 transition-colors shadow-md text-base group cursor-pointer"
                >
                  Start free trial
                  <ArrowRight size={18} strokeWidth={2} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-textPrimary font-semibold rounded-xl border border-border hover:bg-slate-50 transition-colors text-base"
                >
                  See how it works
                </a>
              </div>
            </div>

            {/* Right Product Mockup */}
            <div className="flex-1 w-full flex justify-center lg:justify-end">
              <ProductMockup />
            </div>

          </div>
        </div>
      </section>

      {/* 2. STATS / SOCIAL PROOF STRIP */}
      <section className="bg-slate-50 border-y border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="py-2 px-4">
              <div className="font-mono text-3xl sm:text-4xl font-extrabold text-accent tabular-nums mb-1">
                Multiple Wholesalers
              </div>
              <p className="text-sm font-medium text-textSecondary">Leading UK cash & carry suppliers tracked daily</p>
            </div>

            <div className="py-2 px-4">
              <div className="font-mono text-3xl sm:text-4xl font-extrabold text-accent tabular-nums mb-1">
                1,000+ SKUs
              </div>
              <p className="text-sm font-medium text-textSecondary">Top retail products monitored continuously</p>
            </div>

            <div className="py-2 px-4">
              <div className="font-mono text-3xl sm:text-4xl font-extrabold text-accent tabular-nums mb-1">
                Updated Daily
              </div>
              <p className="text-sm font-medium text-textSecondary">Fresh price snapshots every morning at 06:00</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-sora font-bold text-3xl sm:text-4xl text-textPrimary tracking-tight mb-4">
              How PriceIntel works
            </h2>
            <p className="text-lg text-textSecondary max-w-2xl mx-auto">
              Stop spending hours logging into separate wholesaler portals. We aggregate supplier prices into one clean view.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Step 1 */}
            <div className="bg-slate-50 border border-border rounded-2xl p-8 flex flex-col relative">
              <div className="w-12 h-12 rounded-xl bg-accent text-white font-sora font-extrabold text-xl flex items-center justify-center mb-6 shadow-sm">
                1
              </div>
              <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">
                We scan your suppliers daily
              </h3>
              <p className="text-sm text-textSecondary leading-relaxed flex-grow">
                Our platform automatically collects daily prices, case sizes, and stock availability directly from your connected wholesale suppliers.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 border border-border rounded-2xl p-8 flex flex-col relative">
              <div className="w-12 h-12 rounded-xl bg-accent text-white font-sora font-extrabold text-xl flex items-center justify-center mb-6 shadow-sm">
                2
              </div>
              <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">
                We match products automatically
              </h3>
              <p className="text-sm text-textSecondary leading-relaxed flex-grow">
                We normalize product codes, barcodes, and case quantities so you compare exact like-for-like items across every supplier.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 border border-border rounded-2xl p-8 flex flex-col relative">
              <div className="w-12 h-12 rounded-xl bg-accent text-white font-sora font-extrabold text-xl flex items-center justify-center mb-6 shadow-sm">
                3
              </div>
              <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">
                You see the cheapest price instantly
              </h3>
              <p className="text-sm text-textSecondary leading-relaxed flex-grow">
                Search any product on the web app or receive daily price drop alerts via Telegram before placing your daily store orders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURE GRID */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-sora font-bold text-3xl sm:text-4xl text-textPrimary tracking-tight mb-4">
              Built for practical store purchasing
            </h2>
            <p className="text-lg text-textSecondary max-w-xl mx-auto">
              Clear, factual pricing tools designed for independent convenience store owners and buyers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accentSoft text-accent flex items-center justify-center mb-5">
                <RefreshCw size={24} strokeWidth={1.75} />
              </div>
              <h3 className="font-sora font-semibold text-lg text-textPrimary mb-2">Daily price snapshots</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Fresh price records taken every morning ensure you order with current market data.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accentSoft text-accent flex items-center justify-center mb-5">
                <Bell size={24} strokeWidth={1.75} />
              </div>
              <h3 className="font-sora font-semibold text-lg text-textPrimary mb-2">Telegram alerts</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Get price change alerts sent straight to your phone so you never miss supplier promotions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accentSoft text-accent flex items-center justify-center mb-5">
                <LineChart size={24} strokeWidth={1.75} />
              </div>
              <h3 className="font-sora font-semibold text-lg text-textPrimary mb-2">Price history & trends</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                View historical pricing charts to identify seasonal discounts and supplier price increases.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accentSoft text-accent flex items-center justify-center mb-5">
                <Layers size={24} strokeWidth={1.75} />
              </div>
              <h3 className="font-sora font-semibold text-lg text-textPrimary mb-2">Unit-price comparison</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Compare case sizes (e.g. 24x vs 30x) easily with normalized unit-price calculations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PRICING */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-sora font-bold text-3xl sm:text-4xl text-textPrimary tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-textSecondary max-w-xl mx-auto">
              Start with a 14-day free trial. No card required at signup.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Trial */}
            <div className="border border-border rounded-2xl p-8 flex flex-col justify-between bg-white">
              <div>
                <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">Free Trial</h3>
                <p className="text-sm text-textSecondary mb-6">Experience full price intelligence for 14 days.</p>
                <div className="font-mono text-4xl font-extrabold text-textPrimary mb-6 tabular-nums">
                  £0
                  <span className="text-sm font-normal text-textSecondary font-inter"> / 14 days</span>
                </div>
                <ul className="space-y-3 text-sm text-textSecondary mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Search all connected wholesalers</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Daily price updates</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Save favorite products</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/signup"
                className="w-full text-center py-3 px-4 rounded-xl text-sm font-semibold border border-border text-textPrimary hover:bg-slate-50 transition-colors"
              >
                Start free trial
              </Link>
            </div>

            {/* Pro Retailer */}
            <div className="border-2 border-accent rounded-2xl p-8 flex flex-col justify-between bg-white relative shadow-lg">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div>
                <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">Pro Retailer</h3>
                <p className="text-sm text-textSecondary mb-6">For active store managers optimizing margins daily.</p>
                <div className="font-mono text-4xl font-extrabold text-textPrimary mb-6 tabular-nums">
                  £29
                  <span className="text-sm font-normal text-textSecondary font-inter"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-textSecondary mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Everything in Free Trial</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Telegram price alerts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Full price history charts</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Unit price breakdown</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/signup"
                className="w-full text-center py-3 px-4 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-teal-800 transition-colors shadow-sm"
              >
                Get Pro Access
              </Link>
            </div>

            {/* Multi-Store */}
            <div className="border border-border rounded-2xl p-8 flex flex-col justify-between bg-white">
              <div>
                <h3 className="font-sora font-bold text-xl text-textPrimary mb-2">Multi-Store</h3>
                <p className="text-sm text-textSecondary mb-6">For store groups requiring multi-user access.</p>
                <div className="font-mono text-4xl font-extrabold text-textPrimary mb-6 tabular-nums">
                  £69
                  <span className="text-sm font-normal text-textSecondary font-inter"> / month</span>
                </div>
                <ul className="space-y-3 text-sm text-textSecondary mb-8">
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Multiple store logins</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check size={16} strokeWidth={2.5} className="text-success" />
                    <span>Custom depot branch config</span>
                  </li>
                </ul>
              </div>
              <Link
                to="/signup"
                className="w-full text-center py-3 px-4 rounded-xl text-sm font-semibold border border-border text-textPrimary hover:bg-slate-50 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FINAL CTA BANNER */}
      <section className="bg-accent py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-sora font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-4">
            Start saving on wholesale purchases today
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
            Join independent retailers using PriceIntel to compare supplier prices before placing every order.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-accent font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-lg text-base cursor-pointer"
          >
            Start 14-day free trial
            <ArrowRight size={18} strokeWidth={2} className="ml-2" />
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Home;
