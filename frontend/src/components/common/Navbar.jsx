import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';
import Avatar from './Avatar';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  const formatTimestamp = useCallback((isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotificationsLoading(true);
    try {
      const { data } = await notificationsAPI.list({ limit: 15 });
      setNotifications(data?.notifications || []);
      setUnreadCount(data?.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(intervalId);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (user) return;
    setNotifications([]);
    setUnreadCount(0);
    setNotificationsOpen(false);
    setNotificationsLoading(false);
  }, [user]);

  const menuRef = useRef(null);
  const notificationsRef = useRef(null);

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

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen || unreadCount === 0) return;
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) {
      setUnreadCount(0);
      return;
    }
    const timestamp = new Date().toISOString();
    notificationsAPI.markRead(unreadIds).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true, read_at: timestamp } : item))
    );
    setUnreadCount(0);
  }, [notificationsOpen, unreadCount, notifications]);

  const handleNotificationsToggle = () => {
    setNotificationsOpen((open) => {
      const next = !open;
      if (!open && user) {
        fetchNotifications();
      }
      return next;
    });
  };

  const handleNotificationClick = (notification) => {
    setNotificationsOpen(false);
    const redirect = notification?.payload?.redirect_url || notification?.payload?.href;
    if (redirect) {
      navigate(redirect);
      return;
    }
    if (notification.reference_type === 'department_change') {
      navigate('/profile');
    } else if (notification.reference_type === 'admin' && user?.role === 'admin') {
      navigate('/admin');
    } else if (notification.reference_type === 'shoutout' || notification.reference_type === 'comment') {
      navigate('/feed');
    }
  };

  const handleClearAll = async () => {
    if (!notifications.length) {
      setUnreadCount(0);
      return;
    }
    setNotificationsLoading(true);
    try {
      await notificationsAPI.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      setTimeout(() => {
        if (notificationsOpen) fetchNotifications();
      }, 300);
    } catch (error) {
      console.error('Failed to clear notifications', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

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
            {user && (
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={handleNotificationsToggle}
                  className="relative rounded-full p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-gray-800 transition"
                  aria-label="Open notifications"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="pointer-events-none"
                  >
                    <path
                      d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.73 21a2 2 0 01-3.46 0"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Notifications</span>
                      <div className="flex items-center gap-3">
                        {notificationsLoading && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Refreshing...</span>
                        )}
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                          disabled={!notifications.length || notificationsLoading}
                        >
                          Clear all
                        </button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificationsLoading && !notifications.length ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Loading notifications...</div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">You're all caught up!</div>
                      ) : (
                        notifications.map((notification) => {
                          const actorName = notification.actor?.name || 'System';
                          const isUnread = !notification.is_read;
                          return (
                            <button
                              type="button"
                              key={notification.id}
                              onClick={() => handleNotificationClick(notification)}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                                isUnread
                                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <Avatar
                                src={notification.actor?.avatar_url}
                                name={actorName}
                                size="xs"
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                    {notification.title}
                                  </p>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {formatTimestamp(notification.created_at)}
                                  </span>
                                </div>
                                {notification.message ? (
                                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                    {notification.message}
                                  </p>
                                ) : null}
                                {notification.actor?.name ? (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    From {notification.actor.name}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                    {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/admin'); }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Dashboard
                    </button>
                    )}
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
