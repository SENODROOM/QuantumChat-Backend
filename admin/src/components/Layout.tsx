import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { getWidgetAuthUrl } from '../config';
import { ThemeSwitcher } from './ThemeSwitcher';

const navItems = [
  {
    to: '/',
    label: 'Overview',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    to: '/websites',
    label: 'Sites',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    to: '/users',
    label: 'Users',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

export function Layout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();

  const logout = () => {
    api.clearToken();
    onLogout();
    window.location.href = getWidgetAuthUrl('login');
  };

  const currentPage = navItems.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );

  return (
    <div className="min-h-screen flex flex-col bg-qc-bg">
      <div className="qc-mesh-bg" aria-hidden />

      <header className="sticky top-0 z-40 qc-header">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="qc-logo-ring">
                <img src="/logo.png" alt="QuantumChat" width={36} height={36} className="rounded-lg" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-qc-text leading-tight">QuantumChat</p>
                <p className="text-[10px] uppercase tracking-widest text-qc-accent font-semibold">Control Center</p>
              </div>
            </div>

            <nav className="qc-nav-dock hidden md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `qc-nav-pill ${isActive ? 'qc-nav-pill-active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <ThemeSwitcher compact />
              <button type="button" onClick={logout} className="qc-logout-btn">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline text-sm">Exit</span>
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden border-t border-qc-border px-4 py-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `qc-nav-pill text-xs ${isActive ? 'qc-nav-pill-active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="qc-breadcrumb mb-6">
            <span className="text-qc-muted text-xs font-medium uppercase tracking-wider">Workspace</span>
            <span className="text-qc-muted mx-2">/</span>
            <span className="text-qc-accent text-xs font-semibold">{currentPage?.label || 'Overview'}</span>
          </div>

          <div className="qc-workspace">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
