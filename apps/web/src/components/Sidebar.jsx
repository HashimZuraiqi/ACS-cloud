import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Activity, Settings, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const Sidebar = ({ className }) => {
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/activity', icon: Activity, label: 'Activity Log' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className={cn('w-60 bg-card border-r border-border flex flex-col', className)}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-600/15">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent leading-tight">CloudGuard</h1>
            <p className="text-[10px] text-muted-foreground font-medium">Security Hub</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-blue-500/[0.08] text-blue-600 dark:text-blue-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-[18px] h-[18px]', isActive ? 'text-blue-600 dark:text-blue-400' : '')} />
                  <span>{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-border">
        <div className="px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Status</p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active & Scanning</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;