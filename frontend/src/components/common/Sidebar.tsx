import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, BookOpen, Video, HelpCircle, Sparkles, 
  LineChart, FileText, UserCheck, Shield, Settings, Home, Compass
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();

  const studentLinks = [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/courses', label: 'My Courses', icon: BookOpen },
    { to: '/player', label: 'Video Player', icon: Video },
    { to: '/quiz', label: 'Micro-Quizzes', icon: HelpCircle },
    { to: '/revision', label: 'AI Revision Kit', icon: Sparkles },
    { to: '/analytics', label: 'Analytics', icon: LineChart },
    { to: '/reports', label: 'Reports', icon: FileText },
  ];

  const teacherLinks = [
    { to: '/teacher', label: 'Overview', icon: LayoutDashboard },
    { to: '/courses', label: 'Course Management', icon: BookOpen },
    { to: '/lectures', label: 'Lectures & Topics', icon: Video },
    { to: '/analytics', label: 'Class Analytics', icon: LineChart },
    { to: '/quiz-management', label: 'Quiz Builder', icon: HelpCircle },
    { to: '/reports', label: 'Student Reports', icon: FileText },
  ];

  const adminLinks = [
    { to: '/admin', label: 'System Admin', icon: Shield, end: true },
    { to: '/users', label: 'User Directory', icon: UserCheck },
    { to: '/courses', label: 'Course Management', icon: BookOpen },
    { to: '/lectures', label: 'Lectures & Topics', icon: Video },
    { to: '/quiz-management', label: 'Quiz Builder', icon: HelpCircle },
    { to: '/analytics', label: 'Class Analytics', icon: LineChart },
    { to: '/admin/vision-debug', label: 'Vision Debug', icon: Compass },
  ];

  const links = role === 'admin' ? adminLinks : (role === 'teacher' ? teacherLinks : studentLinks);

  return (
    <aside className="w-64 glass-card border-r border-dark-border min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 mb-2 font-mono">
            {(role || '').toUpperCase()} PORTAL
          </div>
          <nav className="space-y-1">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-dark-border">
          <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-3 mb-2 font-mono">
            ACCOUNT & LEGAL
          </div>
          <nav className="space-y-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
                }`
              }
            >
              <UserCheck className="w-4 h-4" />
              <span>Profile & Badges</span>
            </NavLink>
            <NavLink
              to="/privacy"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
                }`
              }
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Privacy Controls</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-hover'
                }`
              }
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </NavLink>
          </nav>
        </div>
      </div>

      <div className="p-3 bg-dark-bg/60 rounded-xl border border-dark-border text-center">
        <div className="text-[11px] font-medium text-slate-400">Privacy Status</div>
        <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          In-Memory Only CV
        </div>
      </div>
    </aside>
  );
};
