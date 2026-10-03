import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homePathForRole } from '../../contexts/AuthContext';
import { notificationApi } from '../../services/api';
import { AppNotification } from '../../types';
import { Zap, ShieldCheck, LogOut, Bell } from 'lucide-react';

const NOTIFICATION_POLL_MS = 60000;

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifications(await notificationApi.getNotifications());
    } catch (err) {
      console.error("Notification fetch error:", err);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setOpen(false);
      return;
    }
    loadNotifications();
    const timer = window.setInterval(loadNotifications, NOTIFICATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [user, loadNotifications]);

  // Close the panel when clicking outside it
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (n: AppNotification) => {
    if (n.read) return;
    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
    try {
      await notificationApi.markRead(n.id);
    } catch (err) {
      console.error("Mark read error:", err);
      loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await notificationApi.markAllRead();
    } catch (err) {
      console.error("Mark all read error:", err);
      loadNotifications();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass-nav sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
      {/* Brand Logo */}
      <Link to={user ? homePathForRole(role) : '/'} className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold font-heading tracking-tight text-white flex items-center gap-1.5">
            LearnPulse <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">AI</span>
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider uppercase font-mono block -mt-1">Educational Analytics</span>
        </div>
      </Link>

      {/* Center Nav Options */}
      <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
        <Link to="/landing" className="text-slate-300 hover:text-white transition-colors">Overview</Link>
        {user && <Link to="/courses" className="text-slate-300 hover:text-white transition-colors">Courses</Link>}
        {user && <Link to="/analytics" className="text-slate-300 hover:text-white transition-colors">Analytics</Link>}
        <Link to="/privacy" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-4 h-4" /> Privacy First
        </Link>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border text-brand-400">
              {user.role}
            </span>

            {/* Notifications */}
            <div className="relative" ref={panelRef}>
              <button
                onClick={() => setOpen(!open)}
                title="Notifications"
                className="relative p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
                    <span className="text-xs font-bold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-[11px] text-brand-400 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleMarkRead(n)}
                          className={`w-full text-left px-4 py-3 border-b border-dark-border/60 last:border-b-0 hover:bg-dark-hover transition-colors ${
                            n.read ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-white">
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span>}
                            <span>{n.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                          {n.created_at && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(n.created_at.endsWith('Z') ? n.created_at : `${n.created_at}Z`).toLocaleString()}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3 pl-2 border-l border-dark-border">
              <Link to="/profile" className="flex items-center space-x-2 text-sm text-slate-200 hover:text-white">
                <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-brand-400 font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden lg:inline text-xs font-semibold">{user.name}</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <Link to="/login" className="px-4 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="gradient-btn px-4 py-1.5 text-xs font-semibold text-white rounded-lg">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};
