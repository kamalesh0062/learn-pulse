import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, getErrorMessage } from '../services/api';
import { StudentAnalytics } from '../types';
import { Award, ShieldCheck, Mail, Flame, Save, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';

const inputClass = "w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500";

export const ProfilePage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (!isStudent) return;
    analyticsApi.getStudentAnalytics()
      .then(setAnalytics)
      .catch((err) => console.error("Profile analytics error:", err));
  }, [isStudent]);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (password && password.length < 8) {
      setError("A new password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        department: isStudent ? undefined : department,
        password: password || undefined
      });
      setPassword('');
      setSaved(true);
    } catch (err) {
      console.error("Profile update error:", err);
      setError(getErrorMessage(err, "Your profile could not be updated."));
    } finally {
      setSaving(false);
    }
  };

  // Milestones are earned from real activity; unearned ones are shown greyed out
  const easyTopics = analytics?.difficult_topics.filter((t) => t.difficulty_label === 'Easy').length ?? 0;
  const badges = analytics ? [
    {
      icon: Flame, color: 'amber', title: `${analytics.study_streak_days}-Day Streak`,
      description: 'Study on 3 consecutive days', earned: analytics.study_streak_days >= 3
    },
    {
      icon: Award, color: 'purple', title: 'Quiz Ace',
      description: 'Quiz average of 90% or higher over at least 3 questions',
      earned: (analytics.quiz_average ?? 0) >= 90 && analytics.quizzes_answered >= 3
    },
    {
      icon: BookOpen, color: 'emerald', title: 'Topic Mastery',
      description: `${easyTopics} topic(s) rated Easy for you — reach 3`, earned: easyTopics >= 3
    }
  ] : [];

  const badgeColors: Record<string, string> = {
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400'
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-card p-8 rounded-3xl border border-dark-border space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-3xl bg-brand-600/30 border border-brand-500 flex items-center justify-center text-brand-400 font-extrabold text-2xl shadow-glow">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white font-heading">{user.name}</h1>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-dark-border text-xs">
          <div className="p-3 bg-dark-bg/60 rounded-xl border border-dark-border">
            <span className="text-slate-400 block">Account Role</span>
            <span className="font-bold text-brand-400 capitalize">{user.role}</span>
          </div>
          <div className="p-3 bg-dark-bg/60 rounded-xl border border-dark-border">
            <span className="text-slate-400 block">{isStudent ? 'Enrollment ID' : 'Department'}</span>
            <span className="font-bold text-white">{(isStudent ? user.enrollment_no : user.department) || 'Not set'}</span>
          </div>
          <div className="p-3 bg-dark-bg/60 rounded-xl border border-dark-border col-span-2 md:col-span-1">
            <span className="text-slate-400 block">Camera Analytics</span>
            <span className={`font-bold flex items-center gap-1 ${user.camera_consent ? 'text-emerald-400' : 'text-slate-300'}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> {user.camera_consent ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Edit profile */}
      <form onSubmit={handleSave} className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
        <h3 className="text-sm font-bold text-white font-heading">Edit Profile</h3>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Profile updated.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          {!isStudent && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">New Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputClass} placeholder="Leave blank to keep your current password" autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="gradient-btn px-6 py-2.5 text-xs font-bold text-white rounded-xl flex items-center space-x-2 disabled:opacity-50">
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </form>

      {/* Milestones (students) */}
      {isStudent && analytics && (
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
          <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Milestones
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.title}
                  className={`p-4 rounded-2xl bg-dark-bg/60 border border-dark-border text-center space-y-2 ${badge.earned ? '' : 'opacity-40'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${badge.earned ? badgeColors[badge.color] : 'bg-slate-700/40 text-slate-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-white">{badge.title}</div>
                  <div className="text-[10px] text-slate-400">{badge.description}</div>
                  <div className={`text-[10px] font-mono font-bold ${badge.earned ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {badge.earned ? 'EARNED' : 'NOT YET EARNED'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
