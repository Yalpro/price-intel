import React, { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, Bookmark, User, LogOut, TrendingUp, Menu, X, 
  Sparkles, Bell, LayoutDashboard, CreditCard
} from 'lucide-react';

const RetailerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/app?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navLinks = [
    { path: '/app', label: 'Search & Compare', icon: Search, exact: true },
    { path: '/app/favourites', label: 'Favourites', icon: Bookmark },
    { path: '/app/account', label: 'Account', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-inter text-textPrimary antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Logo (Left) */}
            <div className="flex items-center gap-6 shrink-0">
              <Link to="/app" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-xs group-hover:bg-teal-800 transition-colors">
                  <TrendingUp size={18} strokeWidth={2.2} />
                </div>
                <span className="font-sora font-bold text-lg text-textPrimary tracking-tight hidden sm:inline">
                  PriceIntel
                </span>
              </Link>
            </div>

            {/* Central Prominent Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-2 sm:mx-4">
              <div className="relative">
                <Search
                  size={17}
                  strokeWidth={2}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name or barcode (e.g. Coca-Cola 24x330ml)..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100/80 border border-transparent rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>
            </form>

            {/* Right Nav Links & Account Dropdown */}
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
                        ? 'bg-accentSoft text-accent'
                        : 'text-textSecondary hover:bg-slate-100 hover:text-textPrimary'
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              <div className="h-5 w-px bg-border mx-2" />

              {/* User Profile Pill */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-semibold text-textPrimary truncate max-w-[120px]">
                    {profile?.company_name || profile?.full_name || 'My Store'}
                  </span>
                  <span className="text-[10px] font-medium text-accent bg-accentSoft px-1.5 py-0.2 rounded w-fit self-end">
                    Trial Plan
                  </span>
                </div>

                <button
                  onClick={logout}
                  title="Logout"
                  className="p-2 text-textSecondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut size={18} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-textSecondary hover:text-textPrimary rounded-lg"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 pt-3 pb-4 space-y-2">
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
                      ? 'bg-accentSoft text-accent'
                      : 'text-textSecondary hover:bg-slate-50'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-2 border-t border-border flex items-center justify-between px-3">
              <div>
                <p className="text-xs font-semibold text-textPrimary">
                  {profile?.company_name || 'My Store'}
                </p>
                <p className="text-[10px] text-accent">Trial Active</p>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-xs text-danger font-medium p-1.5"
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Outlet Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

    </div>
  );
};

export default RetailerLayout;
