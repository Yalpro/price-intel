import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

const PublicLayout = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

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

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter text-textPrimary antialiased selection:bg-accentSoft selection:text-accent">
      {/* Sticky Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 bg-white/95 backdrop-blur-md ${
          isScrolled ? 'border-b border-border shadow-xs' : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white shadow-sm group-hover:bg-teal-800 transition-colors">
                <TrendingUp size={20} strokeWidth={2.2} />
              </div>
              <span className="font-sora font-bold text-xl text-textPrimary tracking-tight">PriceIntel</span>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#how-it-works" className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors">
                How it works
              </a>
              <a href="#features" className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors">
                Pricing
              </a>
            </nav>

            {/* Auth Actions */}
            <div className="flex items-center space-x-5">
              <Link
                to="/login"
                className="text-sm font-medium text-textSecondary hover:text-textPrimary transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-lg text-sm font-semibold text-white bg-accent hover:bg-teal-800 transition-colors shadow-sm cursor-pointer"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white">
                <TrendingUp size={18} strokeWidth={2.2} />
              </div>
              <span className="font-sora font-bold text-lg text-white tracking-tight">PriceIntel</span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
              <Link to="/login" className="hover:text-white transition-colors">Login</Link>
              <Link to="/signup" className="hover:text-white transition-colors">Get Started</Link>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} PriceIntel. All rights reserved.</p>
            <p>Built for independent convenience stores & wholesale buyers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
