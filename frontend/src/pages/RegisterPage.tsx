import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homePathForRole } from '../contexts/AuthContext';
import { getErrorMessage } from '../services/api';
import { Zap, Lock, Mail, User as UserIcon, AlertCircle, Loader2, BookOpen } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleChoice, setRoleChoice] = useState('student');
  const [extraInfo, setExtraInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const created = await register(name, email, password, roleChoice, extraInfo);
      navigate(homePathForRole(created.role), { replace: true });
    } catch (err: any) {
      setError(getErrorMessage(err, 'Registration failed. Email may already be in use.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-dark-border space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white mx-auto shadow-glow">
            <Zap className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white font-heading">Create Account</h2>
          <p className="text-xs text-slate-400">Join LearnPulse AI educational analytics platform</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Account Role</label>
            <select
              value={roleChoice}
              onChange={(e) => setRoleChoice(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="student">🎓 Student Account</option>
              <option value="teacher">📊 Educator / Teacher Account</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Full Name</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="Dr. Alan Turing"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="alan.turing@university.edu"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              {roleChoice === 'teacher' ? 'Department' : 'Enrollment Number'} <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                placeholder={roleChoice === 'teacher' ? 'Computer Science & AI' : 'ENR2026001'}
              />
            </div>
          </div>

          {roleChoice === 'student' && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Camera-based engagement analytics is <strong className="text-slate-200">off by default</strong>. You can turn it on later under Privacy Controls.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-btn py-3 text-xs font-bold text-white rounded-xl flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Register Account</span>}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-dark-border">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
