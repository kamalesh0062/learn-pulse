import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Lock, Eye, Cpu, CheckCircle2, XCircle } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  const { user, updateUserConsent } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Privacy Guarantee</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white font-heading">
          Privacy-First Educational Analytics Protocol
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          What the camera feature does, what it sends, and how to turn it off.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">1. Zero Video Storage</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Raw webcam video stays in your browser's memory for landmark extraction and is discarded immediately. No video or image is recorded, uploaded to the LearnPulse server, or saved to disk.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">2. In-Memory Landmark Mesh</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            MediaPipe computes face landmark coordinates locally in your browser. Every 5 seconds, only averaged numbers are sent to the server: head orientation (pitch, yaw, roll), Eye Aspect Ratio, a gaze offset and the resulting focus state.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">3. No Emotion Recognition</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            LearnPulse AI strictly forbids affective computing or facial expression emotion classification. We track visual focus relative to the screen plane only.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-dark-border space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">4. Full Consent Control</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Camera analytics is off until you enable it, and you can turn it off again at any time. Without consent the server rejects engagement data for your account; quizzes, revision kits and video activity keep working.
          </p>
        </div>
      </div>

      {user && (
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Toggle Camera Processing</h4>
          <p className="text-xs text-slate-400">Current status: {user?.camera_consent ? "Enabled" : "Disabled"}</p>
        </div>

        <button
          onClick={() => updateUserConsent(!user?.camera_consent).catch((err) => console.error("Consent update failed:", err))}
          className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
            user?.camera_consent
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
          }`}
        >
          {user?.camera_consent ? "Disable Camera Analytics" : "Enable Camera Analytics"}
        </button>
      </div>
      )}
    </div>
  );
};
