import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, LayoutDashboard, Store } from 'lucide-react';
import AnapriceLogo from '../components/AnapriceLogo';

const PublicLayout = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { session, profile, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = profile && ['admin', 'manager'].includes(profile.role);
  const isRetailer = profile && profile.role === 'retailer';
  const dashboardPath = isAdmin ? '/admin' : '/app';

  return (
    <div className="min-h-screen bg-background flex flex-col font-inter text-textPrimary antialiased selection:bg-accent/30 selection:text-accentMint">
      {/* Sticky Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-200 bg-background/90 backdrop-blur-md ${
          isScrolled ? 'border-b border-border shadow-md' : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <AnapriceLogo size={36} />
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#how-it-works" className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors">
                How It Works
              </a>
              <a href="#pricing" className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors">
                Pilot Access
              </a>
            </nav>

            {/* Auth Actions Header */}
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="w-24 h-8 bg-surface animate-pulse rounded-lg border border-border" />
              ) : session && profile ? (
                <div className="flex items-center gap-3">
                  <Link
                    to={dashboardPath}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accentSoft text-accentMint border border-emerald-800/60 hover:bg-savingBg transition-colors"
                  >
                    {isAdmin ? <LayoutDashboard size={14} /> : <Store size={14} />}
                    <span>{isAdmin ? 'Admin Dashboard' : 'Retailer Portal'}</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="p-2 text-textSecondary hover:text-danger hover:bg-surface border border-transparent hover:border-border rounded-xl transition-colors cursor-pointer"
                    title="Log out"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-accentHover transition-colors shadow-sm cursor-pointer"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface text-textSecondary border-t border-border">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <AnapriceLogo size={32} />

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-textSecondary">
              {session && profile ? (
                <Link to={dashboardPath} className="hover:text-textPrimary transition-colors">Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="hover:text-textPrimary transition-colors">Login</Link>
                  <Link to="/signup" className="hover:text-textPrimary transition-colors">Get Started</Link>
                </>
              )}
              <a href="#pricing" className="hover:text-textPrimary transition-colors">Pilot Access</a>
              <a href="#" className="hover:text-textPrimary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-textPrimary transition-colors">Contact</a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-textSecondary">
            <p>&copy; {new Date().getFullYear()} Anaprice. All rights reserved.</p>
            <p>Wholesale Price Intelligence built for independent UK convenience & grocery retailers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
