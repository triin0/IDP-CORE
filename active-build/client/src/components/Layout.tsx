import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { HomeIcon } from './icons/HomeIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { href: '/', label: 'Events', icon: HomeIcon },
  { href: '/admin', label: 'Admin', icon: SettingsIcon },
];

export function Layout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1];
    if (!path) return 'Events';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 240 : 64 }}
        className="bg-[#020617] border-r border-[var(--glass-border)] flex flex-col shrink-0"
      >
        <div className="h-14 flex items-center px-4 border-b border-[var(--glass-border)]">
            <motion.div layout="position" className="flex items-center gap-2">
                <span className="text-xl">🎉</span>
                <AnimatePresence>
                    {isSidebarOpen && <motion.span initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="font-bold text-lg whitespace-nowrap">Event RSVP</motion.span>}
                </AnimatePresence>
            </motion.div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-indigo-500/10 text-slate-300 hover:text-white',
                  isActive && 'bg-indigo-500/15 text-white border-l-2 border-indigo-500'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {isSidebarOpen && <motion.span initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="whitespace-nowrap">{item.label}</motion.span>}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>
      </motion.aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-6 bg-[var(--glass-bg)] backdrop-blur-lg border-b border-[var(--glass-border)] shrink-0">
          <h1 className="text-lg font-semibold tracking-tight">{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-slate-400">{user.name}</span>
                <button onClick={logout} className="text-sm text-slate-400 hover:text-white">Logout</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="text-sm text-slate-400 hover:text-white">Login</NavLink>
                <NavLink to="/register" className="text-sm text-slate-400 hover:text-white">Register</NavLink>
              </>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-700"></div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
