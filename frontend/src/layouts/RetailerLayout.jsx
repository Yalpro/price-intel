import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, User, LogOut, Flame, PlusCircle, Menu, X, Building2, ChevronRight, Package, Heart
} from 'lucide-react';
import AnapriceLogo from '../components/AnapriceLogo';

const RetailerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchTimerRef = useRef(null);

  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchDropdownOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!q.trim() || q.trim().length < 2) {
      setSuggestions([]);
      setSearchDropdownOpen(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/retailer/autocomplete?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setSearchDropdownOpen(true);
        }
      } catch (err) {
        console.error('Retailer autocomplete error:', err);
      }
    }, 250);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchDropdownOpen(false);
      navigate(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { path: '/app', label: 'Daily Deals', icon: Flame, exact: true },
    { path: '/app/search', label: 'Product Search', icon: Search },
    { path: '/app/request', label: 'Request Product', icon: PlusCircle },
    { path: '/app/account', label: 'Account', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter text-textPrimary antialiased pb-20 md:pb-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Logo (Left) */}
            <div className="flex items-center gap-6 shrink-0">
              <Link to="/app" className="flex items-center gap-2">
                <AnapriceLogo size={32} />
              </Link>
            </div>

            {/* Central Search Bar (Desktop) */}
            <div className="relative flex-1 max-w-xl mx-2 hidden sm:block">
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchQuery.length >= 2 && setSearchDropdownOpen(true)}
                    placeholder="Search product or EAN..."
                    className="w-full pl-10 pr-4 py-2 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all font-inter"
                  />
                </div>
              </form>

              {/* Autocomplete Dropdown */}
              {searchDropdownOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="p-2 border-b border-border text-[10px] uppercase font-bold text-textSecondary tracking-wider flex justify-between">
                    <span>Verified Products ({suggestions.length})</span>
                    <span>Press Enter for full search</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          navigate(`/app/product/${item.id}`);
                          setSearchDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-[#1A221D] cursor-pointer transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-contain rounded" />
                          ) : (
                            <div className="w-8 h-8 bg-[#141B17] rounded flex items-center justify-center text-accentMint">
                              <Package size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-xs text-textPrimary">{item.name}</div>
                            <div className="text-[11px] font-mono text-textSecondary">EAN: {item.barcode}</div>
                          </div>
                        </div>

                        {item.bestPrice && (
                          <div className="text-right shrink-0">
                            <div className="font-sora font-bold text-xs text-accentMint">£{item.bestPrice.toFixed(2)}</div>
                            <div className="text-[10px] text-textSecondary uppercase font-mono">{item.bestSupplier}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Nav Links (Desktop) */}
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accentSoft text-accentMint border border-emerald-800/40'
                        : 'text-textSecondary hover:bg-[#1A221D] hover:text-textPrimary'
                    }`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              <div className="h-5 w-px bg-border mx-2" />

              {/* User Profile Pill */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-textPrimary truncate max-w-[120px]">
                    {profile?.company_name || profile?.full_name || 'Retailer Store'}
                  </span>
                  <span className="text-[10px] font-mono text-accentMint bg-savingBg/60 border border-emerald-800 px-1.5 py-0.2 rounded w-fit self-end">
                    Free Pilot Access
                  </span>
                </div>

                <button
                  onClick={logout}
                  title="Logout"
                  className="p-2 text-textSecondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>

            {/* Mobile Header Actions */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="p-2 text-textSecondary hover:text-textPrimary rounded-lg bg-[#0A0E0C]"
              >
                <Search size={20} />
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-textSecondary hover:text-textPrimary rounded-lg"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface px-4 pt-3 pb-4 space-y-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-accentSoft text-accentMint border border-emerald-800/40'
                      : 'text-textSecondary hover:bg-[#1A221D]'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* Mobile Search Modal Overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 p-4 sm:hidden flex flex-col font-inter">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-sora font-bold text-sm text-textPrimary">Search Wholesale Products</h3>
            <button onClick={() => setMobileSearchOpen(false)} className="text-textSecondary p-1">
              <X size={22} />
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input
                type="text"
                placeholder="Type name or EAN..."
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-accent"
              />
            </div>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2">
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  navigate(`/app/product/${item.id}`);
                  setMobileSearchOpen(false);
                }}
                className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-textPrimary">{item.name}</div>
                  <div className="text-[11px] font-mono text-textSecondary">EAN: {item.barcode}</div>
                </div>
                {item.bestPrice && (
                  <div className="text-right">
                    <div className="font-sora font-bold text-xs text-accentMint">£{item.bestPrice.toFixed(2)}</div>
                    <div className="text-[10px] text-textSecondary">{item.bestSupplier}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Retailer Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex items-center justify-around py-2 md:hidden">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-accentMint' : 'text-textSecondary'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default RetailerLayout;
