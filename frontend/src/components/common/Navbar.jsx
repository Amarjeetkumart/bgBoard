import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState, useCallback } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

  const applyTheme = useCallback((dark) => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(dark);
  }, []);

  // Initialize theme from localStorage or prefers-color-scheme, always overriding stale class
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = stored === 'dark' || (!stored && prefersDark);
      applyTheme(dark);
    } catch {
      applyTheme(false);
    }
  }, [applyTheme]);

  const toggleTheme = () => {
    const next = !isDark;
    applyTheme(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm dark:bg-gray-900 dark:shadow-black/20">
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
              className="relative inline-flex h-6 w-11 items-center rounded-full border border-gray-300 dark:border-gray-600 transition-colors
                         bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-pressed={isDark}
              aria-label="Toggle dark mode"
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-1'}`}></span>
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
