import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Search, Star, Trash2, ArrowRight } from 'lucide-react';

const SavedProducts = () => {
  const [favorites, setFavorites] = useState([
    // Uncomment for testing list view state:
    // { id: '1', name: 'Coca-Cola Original Taste 24 × 330ml', barcode: '5449000000996', supplier: 'Parfetts', price: '10.89' }
  ]);

  const removeFavorite = (id) => {
    setFavorites(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h1 className="font-sora font-bold text-2xl text-textPrimary tracking-tight">
            Favourite Products
          </h1>
          <p className="text-sm text-textSecondary mt-1">
            Quickly monitor price changes on your store's top selling lines.
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-full font-medium text-slate-700">
          {favorites.length} Saved Items
        </span>
      </div>

      {/* Favorites List or Empty State */}
      {favorites.length === 0 ? (
        // Honest Empty State
        <div className="bg-white border border-border rounded-2xl p-16 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Star size={30} strokeWidth={1.5} />
          </div>

          <h2 className="font-sora font-semibold text-xl text-textPrimary mb-2">
            No favourites yet — star a product to save it here
          </h2>

          <p className="text-sm text-textSecondary max-w-md mx-auto mb-8">
            Staring items adds them to your personal shortlist so you can instantly check Booker, Parfetts, and Costco prices before ordering.
          </p>

          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl text-sm hover:bg-teal-800 transition-colors shadow-sm"
          >
            <Search size={16} />
            Search Products Now
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-border rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-xs transition-shadow"
            >
              <div>
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{item.barcode}</span>
                <Link to={`/app/product/${item.id}`} className="font-sora font-semibold text-base text-textPrimary hover:text-accent block mt-1">
                  {item.name}
                </Link>
              </div>

              <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-xs text-textSecondary block">Cheapest: {item.supplier}</span>
                  <span className="font-mono text-lg font-bold text-accent tabular-nums">£{item.price}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/app/product/${item.id}`}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-textPrimary text-xs font-semibold rounded-lg transition-colors"
                  >
                    View
                  </Link>

                  <button
                    onClick={() => removeFavorite(item.id)}
                    className="p-2 text-textSecondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from favourites"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default SavedProducts;
