import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Activity,
  Building2,
  BookOpen,
  Database,
  Sparkles,
  Search,
  LogOut,
  Menu,
  X,
  Users,
  BadgePercent,
  Settings,
  ChevronRight
} from 'lucide-react';
import AnapriceLogo from '../components/AnapriceLogo';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchTimerRef = useRef(null);

  // Close mobile menu & search on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchDropdownOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setGlobalSearchQuery(q);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      setSearchDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/catalogues/global-search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setSearchDropdownOpen(true);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/scraper-runs', label: 'Scraper Runs', icon: Activity },
    { path: '/admin/suppliers', label: 'Suppliers', icon: Building2 },
    { path: '/admin/catalogue', label: 'SKU Catalogue', icon: BookOpen },
    { path: '/admin/products', label: 'Product Logs', icon: Database },
    { path: '/admin/review-queue', label: 'Review Queue', icon: Sparkles },
    { path: '/admin/subscribers', label: 'Subscribers', icon: Users },
    { path: '/admin/daily-deals', label: 'Daily Deals', icon: BadgePercent },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const breadcrumbs = {
    '/admin': 'Dashboard',
    '/admin/scraper-runs': 'Scraper Monitoring',
    '/admin/scraper-runs/history': 'Scraper Run History',
    '/admin/suppliers': 'Supplier Management',
    '/admin/catalogue': 'SKU Catalogue',
    '/admin/products': 'Product Logs',
    '/admin/review-queue': 'Review Queue',
    '/admin/subscribers': 'Subscriber Management',
    '/admin/daily-deals': 'Daily Deals Preview',
    '/admin/settings': 'Settings',
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative font-inter text-textPrimary antialiased selection:bg-accent/30 selection:text-accentMint">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-surface border-r border-border flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16 w-64' : 'w-64'}`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <AnapriceLogo size={28} showText={!collapsed} />
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-textSecondary hover:text-textPrimary transition-colors p-1 rounded items-center justify-center cursor-pointer"
          >
            <Menu size={18} />
          </button>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden flex text-textSecondary hover:text-textPrimary transition-colors p-1 rounded items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2.5 mx-2 rounded-xl transition-colors group ${
                  isActive
                    ? 'bg-accentSoft text-accentMint font-semibold border border-emerald-800/40'
                    : 'text-textSecondary hover:bg-[#1A221D] hover:text-textPrimary'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.75} className={isActive ? 'text-accent' : 'text-textSecondary group-hover:text-textPrimary'} />
                <span className={`ml-3 text-sm ${collapsed ? 'lg:hidden' : ''}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={logout}
            className={`flex items-center w-full px-4 py-2 rounded-xl text-textSecondary hover:bg-[#1A221D] hover:text-danger transition-colors cursor-pointer ${
              collapsed ? 'lg:justify-center' : ''
            }`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut size={18} strokeWidth={1.75} />
            <span className={`ml-3 font-medium text-sm ${collapsed ? 'lg:hidden' : ''}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0 relative z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-textSecondary hover:text-textPrimary transition-colors p-1 rounded flex items-center justify-center"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-sora font-semibold text-textPrimary tracking-tight truncate">
              {breadcrumbs[location.pathname] || 'Admin Portal'}
            </h1>
            <span className="hidden sm:inline-block text-xs font-mono font-bold text-accentMint bg-savingBg border border-emerald-800 px-2 py-0.5 rounded">
              System Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop Global Search */}
            <div className="relative w-48 lg:w-72 hidden sm:block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input
                type="text"
                placeholder="Global admin search EAN / SKU / Run..."
                value={globalSearchQuery}
                onChange={handleSearchChange}
                onFocus={() => globalSearchQuery.length >= 2 && setSearchDropdownOpen(true)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#0A0E0C] border border-border rounded-xl text-xs text-textPrimary focus:outline-none focus:border-accent transition-all font-inter"
              />

              {/* Search Dropdown */}
              {searchDropdownOpen && searchResults.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="p-2 border-b border-border text-[10px] uppercase font-bold text-textSecondary tracking-wider">
                    Search Results ({searchResults.length})
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                    {searchResults.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => {
                          navigate(res.path);
                          setSearchDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-[#1A221D] cursor-pointer transition-colors space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-xs text-textPrimary truncate">{res.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-savingBg text-accentMint border border-emerald-800">
                            {res.badgeText}
                          </span>
                        </div>
                        <div className="text-[11px] text-textSecondary flex justify-between items-center">
                          <span>{res.sublabel}</span>
                          <ChevronRight size={12} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Search Button */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="sm:hidden text-textSecondary hover:text-textPrimary p-1.5 rounded-lg bg-[#0A0E0C]"
            >
              <Search size={18} />
            </button>

            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-sora font-semibold text-sm shrink-0">
              A
            </div>
          </div>
        </header>

        {/* Mobile Search Modal Overlay */}
        {mobileSearchOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 p-4 sm:hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-sora font-bold text-sm text-textPrimary">Global Admin Search</h3>
              <button onClick={() => setMobileSearchOpen(false)} className="text-textSecondary">
                <X size={20} />
              </button>
            </div>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input
                type="text"
                placeholder="Search EAN, product name, run #..."
                value={globalSearchQuery}
                onChange={handleSearchChange}
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-[#0A0E0C] border border-border rounded-xl text-xs text-textPrimary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {searchResults.map((res) => (
                <div
                  key={res.id}
                  onClick={() => {
                    navigate(res.path);
                    setMobileSearchOpen(false);
                  }}
                  className="p-3 bg-surface border border-border rounded-xl space-y-1"
                >
                  <div className="font-semibold text-xs text-textPrimary">{res.label}</div>
                  <div className="text-[11px] text-textSecondary">{res.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-background">
          <div className="max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
