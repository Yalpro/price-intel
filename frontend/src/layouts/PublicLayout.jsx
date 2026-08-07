import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import AnapriceLogo from '../components/AnapriceLogo';

const PublicLayout = () => {
  const [isScrolled, setIsScrolled] = useState(false);

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

            {/* Auth Actions */}
            <div className="flex items-center space-x-4">
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface text-textSecondary border-t border-border">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <AnapriceLogo size={32} />

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-textSecondary">
              <Link to="/login" className="hover:text-textPrimary transition-colors">Login</Link>
              <Link to="/signup" className="hover:text-textPrimary transition-colors">Get Started</Link>
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
