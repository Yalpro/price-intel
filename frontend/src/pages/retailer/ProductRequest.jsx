import React, { useState } from 'react';
import { PlusCircle, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const ProductRequest = () => {
  const { profile } = useAuth();
  const [productName, setProductName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [preferredSupplier, setPreferredSupplier] = useState('Any');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productName.trim()) return;

    setLoading(true);
    try {
      // Simulate recording product request into database or admin queue
      await new Promise(r => setTimeout(r, 600));
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit product request:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto font-inter">
      <div>
        <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">Request Untracked Product</h1>
        <p className="text-textSecondary text-sm mt-1">
          Can't find a product in our database? Request it here and our team will add it to the daily price comparison catalogue.
        </p>
      </div>

      {submitted ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-savingBg text-accentMint flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-xl font-sora font-bold text-textPrimary">Product Request Submitted!</h2>
          <p className="text-sm text-textSecondary max-w-md mx-auto">
            Thank you. We have received your request for <strong className="text-textPrimary">"{productName}"</strong>. Our admin team reviews requested SKUs daily.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setProductName('');
              setBarcode('');
              setNotes('');
            }}
            className="px-6 py-2.5 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Request Another Product
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold text-textSecondary uppercase">
              Product Name / Description <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Lucozade Energy Cherry 500ml 12-pack"
              className="w-full px-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent font-inter"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-mono font-semibold text-textSecondary uppercase">
                EAN / Barcode (Optional)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="e.g. 5054267016439"
                className="w-full px-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-mono font-semibold text-textSecondary uppercase">
                Preferred Wholesaler (Optional)
              </label>
              <select
                value={preferredSupplier}
                onChange={e => setPreferredSupplier(e.target.value)}
                className="w-full px-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-accent font-inter"
              >
                <option value="Any">Any Wholesaler</option>
                <option value="Booker">Booker</option>
                <option value="Parfetts">Parfetts</option>
                <option value="Bestway">Bestway</option>
                <option value="Costco">Costco</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono font-semibold text-textSecondary uppercase">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Mention pack size, price mark, or target cost..."
              className="w-full px-4 py-3 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent font-inter"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !productName.trim()}
              className="w-full sm:w-auto px-8 py-3 bg-accent hover:bg-accentHover text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle size={18} />
              <span>{loading ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ProductRequest;
