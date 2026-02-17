import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Menu, X, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

const PublicHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-600/15">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              CloudGuard
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {isDark ? <Sun className="w-[18px] h-[18px] text-amber-500" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
            >
              Get Started
            </Link>
          </nav>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              {isDark ? <Sun className="w-[18px] h-[18px] text-amber-500" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-background border-t border-border">
          <div className="px-4 py-3 space-y-1">
            <Link to="/" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setIsMenuOpen(false)}>
              Home
            </Link>
            <Link to="/login" className="block px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setIsMenuOpen(false)}>
              Sign In
            </Link>
            <Link to="/signup" className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 text-center" onClick={() => setIsMenuOpen(false)}>
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;