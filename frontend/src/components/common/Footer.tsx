import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-dark-border bg-dark-bg/80 py-12 px-6 mt-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
              ⚡
            </div>
            <span className="text-lg font-bold text-white">LearnPulse AI</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Privacy-first educational analytics and personalized AI revision platform empowering students and educators.
          </p>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero Video Storage Guarantee</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 font-mono">Product</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link to="/login" className="hover:text-white transition-colors">Sign In to Your Portal</Link></li>
            <li><Link to="/courses" className="hover:text-white transition-colors">Course Catalog</Link></li>
            <li><Link to="/player" className="hover:text-white transition-colors">Interactive Video Player</Link></li>
            <li><Link to="/analytics" className="hover:text-white transition-colors">Learning Analytics</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 font-mono">Analytics</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link to="/analytics" className="hover:text-white transition-colors">Topic Difficulty Engine</Link></li>
            <li><Link to="/analytics" className="hover:text-white transition-colors">Engagement Tracking</Link></li>
            <li><Link to="/courses" className="hover:text-white transition-colors">Micro-Quizzes</Link></li>
            <li><Link to="/reports" className="hover:text-white transition-colors">PDF Export Reports</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 font-mono">Privacy & Security</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link to="/privacy" className="hover:text-white transition-colors">Local CV Processing</Link></li>
            <li><Link to="/privacy" className="hover:text-white transition-colors">Webcam Consent Controls</Link></li>
            <li><Link to="/privacy" className="hover:text-white transition-colors">No Emotion Recognition</Link></li>
            <li><Link to="/settings" className="hover:text-white transition-colors">Account Settings</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-dark-border/50 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
        <div>© 2026 LearnPulse AI. All rights reserved.</div>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/privacy" className="hover:text-white">Terms of Service</Link>
          <Link to="/profile" className="hover:text-white">Your Account</Link>
        </div>
      </div>
    </footer>
  );
};
