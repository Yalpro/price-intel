import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Search, Zap, CheckCircle2, ShieldCheck, RefreshCw, ChevronRight, Building2, TrendingDown, PackageCheck, Layers, BarChart3, Smartphone, Clock, Scale, Sparkles, Check
} from 'lucide-react';
import IntroSplash from '../../components/IntroSplash';

// Hero Floating Comparison Card (Public-Safe Generic Labels)
const HeroComparisonCard = () => (
  <div className="relative w-full max-w-md mx-auto lg:max-w-none">
    {/* Ambient Glow */}
    <div className="absolute -inset-1.5 bg-gradient-to-r from-accent/30 to-accentHover/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

    <div className="relative bg-surface/90 backdrop-blur-xl rounded-2xl border border-border p-6 shadow-2xl space-y-5">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <span className="font-sora font-semibold text-textPrimary text-sm">Live Intelligence Stream</span>
        </div>
        <span className="text-xs font-mono text-accentMint bg-savingBg/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-md">
          Updated Today 06:00
        </span>
      </div>

      {/* Tracked Item */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="font-sora font-bold text-base text-textPrimary">Cola Original Taste 8 × 330ml</h4>
          <span className="font-mono text-[11px] text-textSecondary bg-[#1A221D] px-2 py-0.5 rounded">
            5000112693676
          </span>
        </div>
        <p className="text-xs text-textSecondary font-mono">Category: Soft Drinks / Cans</p>
      </div>

      {/* Supplier Comparison Rows (Public-Safe Generic Labels) */}
      <div className="space-y-2.5 pt-1">
        <div className="p-3.5 rounded-xl border border-accent bg-savingBg/40 ring-1 ring-accent/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-sora font-bold text-xs">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-textPrimary">Wholesale Source A</p>
              <span className="text-[11px] text-accentMint font-mono font-semibold">Save £5.80 vs next best</span>
            </div>
          </div>
          <div className="text-right font-mono">
            <p className="text-base font-bold text-accentMint">£11.49</p>
            <p className="text-[10px] text-textSecondary">£1.43/unit</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-[#0E1310] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E2621] text-textSecondary flex items-center justify-center font-sora font-bold text-xs">
              B
            </div>
            <p className="text-sm font-semibold text-textPrimary">Wholesale Source B</p>
          </div>
          <div className="text-right font-mono">
            <p className="text-base font-semibold text-textPrimary">£17.29</p>
            <p className="text-[10px] text-textSecondary">£2.16/unit</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-[#0E1310] flex items-center justify-between opacity-80">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1E2621] text-textSecondary flex items-center justify-center font-sora font-bold text-xs">
              C
            </div>
            <p className="text-sm font-semibold text-textPrimary">Wholesale Source C</p>
          </div>
          <div className="text-right font-mono">
            <p className="text-base font-semibold text-textPrimary">£30.95</p>
            <p className="text-[10px] text-textSecondary">£3.86/unit</p>
          </div>
        </div>
      </div>

      {/* Sparkline & Stats Row */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono text-textSecondary">
        <span className="flex items-center gap-1.5 text-accentMint font-semibold">
          <TrendingDown size={14} /> 63% Max Price Variation
        </span>
        <span>100 Pilot SKUs Tracked</span>
      </div>
    </div>
  </div>
);

const Home = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="space-y-24 pb-20 font-inter text-textPrimary bg-background antialiased selection:bg-accent/30 selection:text-accentMint">
      {showSplash && <IntroSplash onComplete={() => setShowSplash(false)} />}
      
      {/* 1. HERO SECTION */}
      <section className="pt-12 md:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accentSoft border border-emerald-800/60 text-xs font-semibold text-accentMint font-mono">
              <Zap size={14} className="text-accent" />
              <span>Wholesale Buying Intelligence</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sora font-extrabold text-textPrimary tracking-tight leading-[1.1]">
              Wholesale price intelligence, <span className="text-accent">built for independent UK retailers.</span>
            </h1>

            <p className="text-base sm:text-lg text-textSecondary max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Compare current wholesale prices, spot meaningful savings and make faster buying decisions without checking multiple portals manually.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white bg-accent hover:bg-accentHover transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 cursor-pointer"
              >
                <span>Get started</span>
                <ArrowRight size={18} />
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-textPrimary bg-surface border border-border hover:bg-[#1A221D] transition-colors flex items-center justify-center"
              >
                See how it works
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-textSecondary font-mono">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-accent" /> Free pilot access
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-accent" /> Multiple wholesale sources
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-accent" /> Refreshed daily
              </span>
            </div>
          </div>

          {/* Right Visual */}
          <div className="lg:col-span-5 flex justify-center">
            <HeroComparisonCard />
          </div>

        </div>
      </section>

      {/* 2. REASON FOR RETAILERS (PAIN POINT SECTION) */}
      <section className="py-16 bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-sora font-bold text-textPrimary tracking-tight">
              Stop checking multiple wholesaler portals one by one.
            </h2>
            <p className="text-textSecondary text-base">
              Independent convenience store owners lose hours every week manually comparing cash & carry pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#0A0E0C] border border-border space-y-4">
              <div className="w-10 h-10 rounded-xl bg-accentSoft flex items-center justify-center text-accent">
                <TrendingDown size={22} />
              </div>
              <h3 className="font-sora font-bold text-lg text-textPrimary">Price Variations Across Sources</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Wholesale prices fluctuate daily. Identical soft drink & confectionery SKUs vary by up to £19 per case across suppliers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0A0E0C] border border-border space-y-4">
              <div className="w-10 h-10 rounded-xl bg-accentSoft flex items-center justify-center text-accent">
                <Scale size={22} />
              </div>
              <h3 className="font-sora font-bold text-lg text-textPrimary">Confusing Pack & Unit Sizes</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Cases of 24 × 330ml vs 12 × 330ml make true price evaluation tedious. Anaprice calculates comparable unit cost instantly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0A0E0C] border border-border space-y-4">
              <div className="w-10 h-10 rounded-xl bg-accentSoft flex items-center justify-center text-accent">
                <Clock size={22} />
              </div>
              <h3 className="font-sora font-bold text-lg text-textPrimary">Wasted Ordering Time</h3>
              <p className="text-sm text-textSecondary leading-relaxed">
                Shopkeepers spend 45+ minutes every morning checking separate logins. Anaprice unifies intelligence into one dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accentMint font-mono text-xs font-semibold">
            3-STEP PROCESS
          </div>
          <h2 className="text-3xl sm:text-4xl font-sora font-bold text-textPrimary">
            How Anaprice Works
          </h2>
          <p className="text-textSecondary text-base">
            Automated intelligence that powers smarter buying decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="p-8 rounded-2xl bg-surface border border-border space-y-4 relative">
            <span className="font-mono text-4xl font-extrabold text-accent/40">01</span>
            <h3 className="font-sora font-bold text-xl text-textPrimary">We Collect Wholesale Pricing</h3>
            <p className="text-sm text-textSecondary leading-relaxed">
              Our automated system scans active catalogue products across multiple leading UK wholesale sources every morning at 06:00.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-surface border border-border space-y-4 relative">
            <span className="font-mono text-4xl font-extrabold text-accent/40">02</span>
            <h3 className="font-sora font-bold text-xl text-textPrimary">Anaprice Compares Valid Matches</h3>
            <p className="text-sm text-textSecondary leading-relaxed">
              Strict barcode EAN & volume normalization ensures you only compare exact, review-safe product matches.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-surface border border-border space-y-4 relative">
            <span className="font-mono text-4xl font-extrabold text-accent/40">03</span>
            <h3 className="font-sora font-bold text-xl text-textPrimary">You Buy at the Lowest Price</h3>
            <p className="text-sm text-textSecondary leading-relaxed">
              Log into your retailer account to see ranked deal opportunities, calculated unit savings, and in-stock availability.
            </p>
          </div>
        </div>
      </section>

      {/* 4. PACK VS UNIT PRICE EDUCATION SECTION */}
      <section className="py-16 bg-surface border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accentMint font-mono text-xs font-semibold">
                SMART UNIT ECONOMICS
              </div>
              <h2 className="text-3xl sm:text-4xl font-sora font-bold text-textPrimary leading-tight">
                Case prices can be misleading. <span className="text-accent">Unit prices tell the truth.</span>
              </h2>
              <p className="text-textSecondary text-base leading-relaxed">
                Wholesalers often sell different pack formats (e.g. 24-pack vs 12-pack). Anaprice keeps total case price visible while automatically computing the comparable unit cost.
              </p>

              <div className="space-y-3 font-mono text-sm">
                <div className="flex items-center gap-3 text-textPrimary">
                  <CheckCircle2 size={18} className="text-accent shrink-0" />
                  <span>24 × 330ml @ £18.00 = <strong>£0.75 per unit</strong></span>
                </div>
                <div className="flex items-center gap-3 text-textPrimary">
                  <CheckCircle2 size={18} className="text-accent shrink-0" />
                  <span>12 × 330ml @ £10.50 = <strong>£0.88 per unit</strong></span>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0E0C] border border-border p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <span className="font-sora font-bold text-sm text-textPrimary">Unit Price Comparison Demo</span>
                <span className="font-mono text-xs text-accentMint">True Cost Evaluator</span>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-surface border border-accent flex justify-between items-center">
                  <div>
                    <span className="text-xs font-mono text-textSecondary block">Format: 24 × 330ml Case</span>
                    <span className="font-sora font-bold text-base text-textPrimary">Source 1</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-lg font-bold text-accentMint">£18.00</span>
                    <span className="text-xs text-accentMint block">£0.75 / unit (Cheaper)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface border border-border flex justify-between items-center opacity-70">
                  <div>
                    <span className="text-xs font-mono text-textSecondary block">Format: 12 × 330ml Case</span>
                    <span className="font-sora font-bold text-base text-textPrimary">Source 2</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-lg font-semibold text-textPrimary">£10.50</span>
                    <span className="text-xs text-textSecondary block">£0.88 / unit (+17%)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. MOBILE RETAILER EXPERIENCE PREVIEW */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
        <div className="max-w-3xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-sora font-bold text-textPrimary">
            Built for Mobile Retailers
          </h2>
          <p className="text-textSecondary text-base">
            Check daily deals on your phone while walking the store floor or preparing your wholesale order.
          </p>
        </div>

        <div className="max-w-sm mx-auto bg-surface border border-border rounded-3xl p-4 shadow-2xl space-y-4">
          <div className="w-16 h-1.5 bg-[#1E2621] rounded-full mx-auto" />
          <div className="bg-[#0A0E0C] border border-border p-4 rounded-2xl space-y-3 text-left">
            <div className="flex justify-between items-start">
              <span className="font-sora font-bold text-sm text-textPrimary">Lucozade Raspberry 500ml</span>
              <span className="text-[10px] font-mono bg-savingBg text-accentMint px-2 py-0.5 rounded">Save £16.80</span>
            </div>
            <div className="flex justify-between items-end font-mono">
              <div>
                <span className="text-[10px] text-textSecondary block">Best Price</span>
                <span className="text-lg font-bold text-accentMint">£1.99</span>
              </div>
              <span className="text-xs text-accent font-semibold">Compare (3) →</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FREE PILOT ACCESS CTA */}
      <section id="pricing" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface border border-border rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-white font-mono text-xs font-semibold">
            FREE LAUNCH ACCESS
          </div>
          <h2 className="text-3xl sm:text-4xl font-sora font-bold text-textPrimary">
            Get 100% Free Access During Our Pilot Period
          </h2>
          <p className="text-textSecondary text-base max-w-xl mx-auto">
            All registered UK convenience, grocery and off-licence retailers receive full access to daily wholesale deal comparisons.
          </p>
          <div className="pt-2">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-white bg-accent hover:bg-accentHover transition-colors gap-2 shadow-lg shadow-accent/20 cursor-pointer"
            >
              <span>Create free retailer account</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
