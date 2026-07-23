import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
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
  Settings
} from 'lucide-react';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    '/admin/suppliers': 'Supplier Management',
    '/admin/catalogue': 'SKU Catalogue',
    '/admin/products': 'Product Logs',
    '/admin/review-queue': 'Review Queue',
    '/admin/subscribers': 'Subscriber Management',
    '/admin/daily-deals': 'Daily Deals Preview',
    '/admin/settings': 'Settings',
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
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
          <span className={`font-sora font-semibold text-lg text-textPrimary truncate ${collapsed ? 'lg:hidden' : ''}`}>
            Admin Portal
          </span>
          
          {/* Desktop collapse toggle */}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-textSecondary hover:text-textPrimary transition-colors p-1 rounded items-center justify-center"
          >
            <Menu size={18} />
          </button>
          
          {/* Mobile close toggle */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden flex text-textSecondary hover:text-textPrimary transition-colors p-1 rounded items-center justify-center"
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
                className={`flex items-center px-4 py-2.5 mx-2 rounded-lg transition-colors group ${
                  isActive 
                    ? 'bg-accentSoft text-accent' 
                    : 'text-textSecondary hover:bg-gray-50 hover:text-textPrimary'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.75} className={isActive ? 'text-accent' : 'text-textSecondary group-hover:text-textPrimary'} />
                <span className={`ml-3 font-medium text-sm ${collapsed ? 'lg:hidden' : ''}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={logout}
            className={`flex items-center w-full px-4 py-2 rounded-lg text-textSecondary hover:bg-gray-50 hover:text-textPrimary transition-colors ${
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
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
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
            <span className="hidden sm:inline-block text-xs font-medium text-textSecondary bg-gray-100 px-2 py-0.5 rounded">
              Admin
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-48 lg:w-64 hidden sm:block">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input 
                type="text" 
                placeholder="Global search..." 
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-border rounded-lg text-sm text-textPrimary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
            
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-sora font-semibold text-sm shrink-0">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
