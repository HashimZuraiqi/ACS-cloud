import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Bell, Moon, Sun, Settings, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ProtectedHeader = ({ onMobileMenuClick }) => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = currentUser?.fullName || currentUser?.email || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="h-16 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="absolute inset-0 bg-card/40 backdrop-blur-md border-b border-white/5 -z-10" />

      <div className="flex items-center gap-3">
        <button 
          onClick={onMobileMenuClick}
          className="md:hidden p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        <h2 className="hidden sm:block text-sm font-medium text-muted-foreground/80">
          Welcome back, <span className="font-bold text-foreground bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">{displayName}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Notification */}
        <button className="relative p-2.5 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-card shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:scale-105 transition-all outline-none ring-2 ring-transparent focus:ring-blue-500/40">
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-card/90 backdrop-blur-xl border-white/10 shadow-2xl p-2" align="end" forceMount>
            <DropdownMenuLabel className="font-normal px-2 py-2">
              <p className="text-sm font-bold text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10 my-1" />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 cursor-pointer rounded-lg focus:bg-white/5 px-2 py-2">
              <Settings className="h-4 w-4 text-blue-400" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-red-500 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 rounded-lg focus:bg-red-500/10 px-2 py-2">
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default ProtectedHeader;