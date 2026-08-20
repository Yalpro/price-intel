import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, TrendingDown, Clock, Package, Heart, CheckCircle2, AlertTriangle, Building2, Flame } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

const ProductDetail = () => {
  const { id } = useParams();
  const [productData, setProductData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyDays, setHistoryDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchProductDetails();
    fetchPriceHistory(30);
  }, [id]);

  const fetchProductDetails = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/retailer/product/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.product) setProductData(data.product);
      }
    } catch (err) {
      console.error('Error loading product details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPriceHistory = async (days) => {
    setHistoryDays(days);
    try {
      const res = await fetch(`/api/retailer/product/${id}/history?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        if (data.history) setHistoryData(data.history);
      }
    } catch (err) {
      console.error('Error loading price history:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6 font-inter text-textPrimary">
        <div className="h-8 w-32 bg-[#1A221D] rounded-xl animate-pulse" />
        <div className="h-64 bg-[#1A221D] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center space-y-4 font-inter text-textPrimary">
        <h2 className="text-xl font-sora font-bold">Product Not Found</h2>
        <p className="text-xs text-textSecondary">The requested product could not be found or has no verified supplier offers.</p>
        <Link to="/app" className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold">
          <ArrowLeft size={14} /> Back to Daily Deals
        </Link>
      </div>
    );
  }

  const cheapestOffer = productData.offers?.[0];
  const nextOffer = productData.offers?.[1];
  const saving = cheapestOffer && nextOffer ? (nextOffer.casePrice - cheapestOffer.casePrice).toFixed(2) : '0.00';

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6 font-inter text-textPrimary">
      {/* Back Link */}
      <Link to="/app" className="inline-flex items-center gap-2 text-xs font-semibold text-textSecondary hover:text-textPrimary transition-colors">
        <ArrowLeft size={16} />
        <span>Back to Daily Deals</span>
      </Link>

      {/* Main Product Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
        {/* Left: Product Image */}
        <div className="flex flex-col items-center justify-center p-6 bg-[#0A0E0C] border border-border rounded-xl">
          {productData.imageUrl ? (
            <img src={productData.imageUrl} alt={productData.name} className="max-h-48 object-contain rounded-lg" loading="lazy" />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-[#141B17] border border-border flex flex-col items-center justify-center gap-2 text-textSecondary">
              <Package size={40} className="text-accentMint" />
              <span className="text-[10px] font-mono font-bold text-accentMint">ANAPRICE VERIFIED</span>
            </div>
          )}
        </div>

        {/* Right: Product Metadata & Overview */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-bold text-accentMint bg-savingBg px-2 py-0.5 rounded border border-emerald-800 uppercase tracking-wider">
                {productData.category}
              </span>
              <h1 className="font-sora font-bold text-xl lg:text-2xl text-textPrimary mt-2 tracking-tight">
                {productData.name}
              </h1>
              <div className="flex items-center gap-3 text-xs font-mono text-textSecondary mt-1">
                <span>EAN: {productData.barcode}</span>
                {productData.priceMark && <span>• Price Mark: £{productData.priceMark}</span>}
              </div>
            </div>

            <button
              onClick={() => setIsSaved(!isSaved)}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isSaved ? 'bg-danger/20 text-danger border-danger/40' : 'bg-[#0A0E0C] text-textSecondary border-border hover:text-textPrimary'
              }`}
              title="Add to Watchlist"
            >
              <Heart size={18} className={isSaved ? 'fill-danger' : ''} />
            </button>
          </div>

          {cheapestOffer && (
            <div className="bg-[#0A0E0C] p-4 rounded-xl border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-accentMint uppercase tracking-wider">Cheapest Verified Wholesaler</span>
                <div className="font-sora font-bold text-lg text-accentMint mt-0.5">{cheapestOffer.supplierName}</div>
                <div className="text-xs text-textSecondary font-mono">{cheapestOffer.packInfo || 'Verified Pack'}</div>
              </div>

              <div className="text-right">
                <div className="font-sora font-extrabold text-2xl text-accentMint">£{cheapestOffer.casePrice.toFixed(2)}</div>
                <div className="text-xs text-textSecondary font-mono">£{cheapestOffer.unitPrice} / unit</div>
                {parseFloat(saving) > 0 && (
                  <div className="text-xs font-bold text-accentMint flex items-center justify-end gap-1 mt-1">
                    <TrendingDown size={14} />
                    <span>Save £{saving} vs next best</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verified Supplier Offers Comparison Table */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-sora font-bold text-sm text-textPrimary">Verified Supplier Price Comparison ({productData.offers?.length || 0})</h3>
          <span className="text-xs text-textSecondary font-mono flex items-center gap-1">
            <ShieldCheck size={14} className="text-accentMint" /> Real DB Verified Offers Only
          </span>
        </div>

        <div className="space-y-3">
          {productData.offers?.map((offer, idx) => (
            <div
              key={offer.supplierId || idx}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors ${
                idx === 0 ? 'bg-[#0E1712] border-emerald-800/60' : 'bg-[#0A0E0C] border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-sora font-bold text-sm ${idx === 0 ? 'bg-accent text-white' : 'bg-[#1A221D] text-textSecondary'}`}>
                  {idx + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-sora font-bold text-sm text-textPrimary">{offer.supplierName}</span>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 bg-accentMint text-black font-extrabold text-[10px] rounded uppercase tracking-wider">
                        Cheapest
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-textSecondary mt-0.5">
                    {offer.packInfo || 'Verified Pack'} • Code: {offer.supplierCode || '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 self-end sm:self-auto text-right">
                <div>
                  <div className="font-sora font-extrabold text-lg text-textPrimary">£{offer.casePrice.toFixed(2)}</div>
                  <div className="text-xs text-textSecondary font-mono">£{offer.unitPrice} / unit</div>
                  {offer.previousPrice && (
                    <div className="text-[11px] font-mono text-textSecondary mt-0.5">
                      Previous: £{offer.previousPrice} {offer.priceDiff && <span className={parseFloat(offer.priceDiff) < 0 ? 'text-accentMint' : 'text-danger'}>({offer.priceDiff > 0 ? '+' : ''}£{offer.priceDiff})</span>}
                    </div>
                  )}
                </div>

                {offer.supplierUrl ? (
                  <a
                    href={offer.supplierUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#1A221D] hover:bg-[#25322B] text-textPrimary rounded-lg text-xs font-semibold border border-border"
                  >
                    View Wholesaler
                  </a>
                ) : (
                  <span className="px-2.5 py-1 bg-[#141B17] text-textSecondary rounded-lg text-xs font-mono">
                    Verified
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Price Trend */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-sora font-bold text-sm text-textPrimary">Historical Wholesale Price Trends</h3>
            <p className="text-xs text-textSecondary">Verified historical price snapshot observations over time</p>
          </div>

          <div className="flex items-center gap-2 bg-[#0A0E0C] p-1 rounded-xl border border-border text-xs">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => fetchPriceHistory(days)}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  historyDays === days ? 'bg-accent text-white' : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* History Chart Render */}
        <div className="h-44 bg-[#0A0E0C] border border-border rounded-xl p-4 flex items-end justify-between gap-2">
          {historyData && historyData.length > 0 ? (
            historyData.map((pt, i) => {
              const maxP = Math.max(...historyData.map(h => h.casePrice));
              const heightPct = maxP > 0 ? (pt.casePrice / maxP) * 100 : 50;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full bg-accentMint/30 hover:bg-accentMint/60 rounded-t-sm transition-all" style={{ height: `${heightPct}%` }}>
                    <div className="w-full bg-accentMint rounded-t-sm" style={{ height: `${heightPct * 0.7}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-textSecondary truncate max-w-[36px]">{pt.supplierName}</span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-[10px] p-2 rounded shadow-lg whitespace-nowrap z-20">
                    <div>{pt.supplierName}</div>
                    <div className="font-bold text-accentMint">£{pt.casePrice.toFixed(2)}</div>
                    <div className="text-gray-400">{formatDateTime(pt.date)}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-textSecondary">
              No historical price snapshots recorded over the last {historyDays} days.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
