import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const Sidebar = ({ className, onCloseMobile }) => {
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/activity', icon: Activity, label: 'Activity Log' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className={cn('w-64 bg-card/60 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl shadow-black/5', className)}>
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/20 group cursor-pointer overflow-hidden">
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Shield className="w-5 h-5 text-white relative z-10" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift leading-tight">
              CloudGuard
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Security Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              onClick={onCloseMobile}
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'text-white shadow-lg shadow-blue-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 opacity-100" />
                  )}
                  <Icon className={cn('relative z-10 w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-110', isActive ? 'text-white' : 'group-hover:text-blue-400')} />
                  <span className="relative z-10">{item.label}</span>
                  {isActive && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-sm z-10 animate-pulse" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-5 py-6 border-t border-white/5">
        <div className="relative group px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-bold uppercase tracking-widest mb-1.5">System Status</p>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500 transition-colors">Active & Scanning</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;