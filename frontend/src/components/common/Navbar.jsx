import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import Avatar from './Avatar';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { return false; }
  });

  const applyTheme = useCallback((dark) => {
    const root = document.documentElement;
    const body = document.body;
    // Avoid layout thrash: toggle class only if needed
    if (dark) {
      if (!root.classList.contains('dark')) root.classList.add('dark');
      if (!body.classList.contains('dark')) body.classList.add('dark');
    } else if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
    setIsDark(dark);
  }, []);

  // Sync state -> DOM and respond to system changes (when user hasn't set a preference)
  useEffect(() => {
    applyTheme(isDark);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Only auto-switch if user hasn't explicitly chosen (no stored theme)
      const stored = localStorage.getItem('theme');
      if (!stored) applyTheme(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyTheme, isDark]);

  // Mount + scroll detection for animated, blurred navbar
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    applyTheme(next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };

  const resetToSystem = () => {
    try { localStorage.removeItem('theme'); } catch {}
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const navClasses = `sticky top-0 z-50 theme-transition backdrop-blur-md border-b transition-[background-color,backdrop-filter,border-color,transform,opacity] duration-300 ${
    scrolled
      ? 'bg-white/70 dark:bg-gray-900/60 border-gray-200/20 dark:border-gray-800/60 shadow-sm'
      : 'bg-white/40 dark:bg-gray-900/40 border-transparent'
  } ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`;

  return (
  <nav className={navClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              Brag Board
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={toggleTheme}
              className={`no-anim relative inline-flex h-7 w-14 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'}`}
              aria-pressed={isDark}
              aria-label="Toggle dark mode"
            >
              {/* Sun icon (left) */}
              <span className="absolute left-1 text-yellow-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4V2M12 22v-2M4.93 4.93L3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              {/* Moon icon (right) */}
              <span className="absolute right-1 text-blue-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
                </svg>
              </span>
              {/* Knob */}
              <span
                className={`inline-flex items-center justify-center h-6 w-6 transform rounded-full bg-white shadow transition-transform
                  ${isDark ? 'translate-x-7' : 'translate-x-1'}`}
              >
                {isDark ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-700">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-yellow-500">
                    <path d="M12 4V2M12 22v-2M4.93 4.93L3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={resetToSystem}
              className="btn btn-outline px-2 py-1 text-xs md:inline hidden"
              title="Reset to system theme"
            >
              System
            </button>
            
            {/* {user?.role === 'admin' && ( */}
              <Link
                to="/feed"
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                Feed
              </Link>
            {/* )} */}
            
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 hover:border-gray-300 dark:hover:border-gray-700 transition"
                >
                  <Avatar src={user.avatar_url} name={user.name} size="sm" />
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</span>
                    {user.department ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{user.department}</span>
                    ) : null}
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{user.name}</p>
                      {user.department ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.department}</p>
                      ) : null}
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/my-shoutouts'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      My Shout-Outs
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/shoutouts-for-me'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Tagged For Me
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); handleLogout(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
