import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState, useCallback } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  return (
  <nav className="bg-white shadow-sm dark:bg-gray-900 dark:shadow-black/20 theme-transition">
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
              className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
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
              className="px-2 py-1 text-xs border rounded md:inline hidden text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 border-gray-300 dark:border-gray-700"
              title="Reset to system theme"
            >
              System
            </button>
            <Link to="/" className="text-gray-700 hover:text-blue-600 text-lg dark:text-gray-200 dark:hover:text-blue-400">
              Home
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-gray-700 hover:text-blue-600 text-lg dark:text-gray-200 dark:hover:text-blue-400">
                Admin
              </Link>
            )}
            <div className="flex items-center space-x-2">
              <Link to="/profile" className="text-gray-700 hover:text-blue-600 text-lg dark:text-gray-200 dark:hover:text-blue-400">
                {user?.name}
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-700 hover:text-blue-600 text-lg dark:text-gray-200 dark:hover:text-blue-400"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
