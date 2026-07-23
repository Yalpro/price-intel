import { useState } from 'react';
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
  Users,
  BadgePercent,
  Settings
} from 'lucide-react';

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth();
  const location = useLocation();

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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-surface border-r border-border flex flex-col transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && <span className="font-sora font-semibold text-lg text-textPrimary truncate">Admin Portal</span>}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="text-textSecondary hover:text-textPrimary transition-colors p-1 rounded"
          >
            <Menu size={18} />
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
                {!collapsed && <span className="ml-3 font-medium text-sm">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={logout}
            className={`flex items-center w-full px-4 py-2 rounded-lg text-textSecondary hover:bg-gray-50 hover:text-textPrimary transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut size={18} strokeWidth={1.75} />
            {!collapsed && <span className="ml-3 font-medium text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center">
            <h1 className="font-sora font-semibold text-textPrimary tracking-tight">
              {breadcrumbs[location.pathname] || 'Admin Portal'}
            </h1>
            <span className="ml-3 text-xs font-medium text-textSecondary bg-gray-100 px-2 py-0.5 rounded">Admin</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative relative w-64 hidden md:block">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary" />
              <input 
                type="text" 
                placeholder="Global search..." 
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-border rounded-lg text-sm text-textPrimary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
            
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-sora font-semibold text-sm">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
