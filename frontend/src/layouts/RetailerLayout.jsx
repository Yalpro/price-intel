import React, { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, User, LogOut, Flame, PlusCircle, Menu, X, Building2
} from 'lucide-react';
import AnapriceLogo from '../components/AnapriceLogo';

const RetailerLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
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

            {/* Central Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-2">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search wholesale products by name or barcode..."
                  className="w-full pl-10 pr-4 py-2 bg-[#0A0E0C] border border-border rounded-xl text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all font-inter"
                />
              </div>
            </form>

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

            <div className="pt-2 border-t border-border flex items-center justify-between px-3">
              <div>
                <p className="text-xs font-semibold text-textPrimary">
                  {profile?.company_name || 'Retailer Store'}
                </p>
                <p className="text-[10px] font-mono text-accentMint">Free Pilot Access</p>
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex items-center justify-around h-16 px-2">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-accent' : ''} />
              <span className="mt-1">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default RetailerLayout;
