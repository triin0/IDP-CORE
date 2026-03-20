import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HomeIcon, TransactionsIcon, EntitiesIcon, AdminIcon, LogoIcon } from './icons/NavigationIcons';

const navItems = [
  { href: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/transactions', label: 'Transactions', icon: <TransactionsIcon /> },
  { href: '/entities', label: 'Entities', icon: <EntitiesIcon /> },
];

const Sidebar = ({ isExpanded }: { isExpanded: boolean }) => (
  <aside className={`fixed top-0 left-0 h-full bg-[#020617] border-r border-[--glass-border] z-20 transition-all duration-300 ease-in-out ${isExpanded ? 'w-60' : 'w-16'}`}>
    <div className="flex items-center h-14 px-4 border-b border-[--glass-border]">
      <LogoIcon />
      <AnimatePresence>
        {isExpanded && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="ml-3 font-bold text-lg text-slate-100 whitespace-nowrap"
          >
            Sovereign
          </motion.span>
        )}
      </AnimatePresence>
    </div>
    <nav className="mt-4">
      <ul>
        {navItems.map(item => (
          <li key={item.href} className="px-2">
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                `flex items-center p-2 rounded-lg text-slate-400 hover:bg-indigo-500/10 hover:text-slate-100 transition-colors relative ${isActive ? 'bg-indigo-500/15 text-white' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.div layoutId="active-nav-indicator" className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r-full" />}
                  <span className="w-8 flex justify-center">{item.icon}</span>
                  {isExpanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">{item.label}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="absolute bottom-4 w-full px-2">
         <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center p-2 rounded-lg text-slate-500 hover:bg-indigo-500/10 hover:text-slate-300 transition-colors relative ${isActive ? 'bg-indigo-500/15 text-white' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.div layoutId="active-nav-indicator" className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-500 rounded-r-full" />}
                <span className="w-8 flex justify-center"><AdminIcon /></span>
                {isExpanded && <span className="ml-3 text-xs font-medium whitespace-nowrap">Admin Dashboard</span>}
              </>
            )}
          </NavLink>
      </div>
    </nav>
  </aside>
);

const TopBar = ({ pageTitle }: { pageTitle: string }) => (
  <header className="fixed top-0 right-0 h-14 bg-[--glass-bg] backdrop-blur-lg border-b border-[--glass-border] z-10 transition-all duration-300 ease-in-out lg:left-60">
    <div className="flex items-center justify-between h-full px-6">
      <h1 className="text-lg font-semibold text-slate-100 tracking-tight">{pageTitle}</h1>
      <div className="w-8 h-8 bg-slate-700 rounded-full"></div>
    </div>
  </header>
);

const Layout = ({ children }: { children: ReactNode }) => {
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    const navItem = navItems.find(item => path.startsWith(item.href) && item.href !== '/');
    if (navItem) return navItem.label;
    if (path.startsWith('/admin')) return 'Admin Dashboard';
    return 'Sovereign';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Sidebar isExpanded={isSidebarExpanded} />
      <div className={`transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'lg:pl-60' : 'lg:pl-16'}`}>
        <TopBar pageTitle={getPageTitle()} />
        <main className="pt-14">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
