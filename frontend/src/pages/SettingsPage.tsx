import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../services/api';
import { Settings, ShieldCheck, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateUserConsent } = useAuth();
  const [consent, setConsent] = useState<boolean>(user?.camera_consent ?? false);
  const [saved, setSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the toggle in sync if consent is changed elsewhere (e.g. the Privacy page)
  useEffect(() => {
    setConsent(user?.camera_consent ?? false);
  }, [user?.camera_consent]);

  const handleSave = async () => {
    setError(null);
    try {
      await updateUserConsent(consent);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Settings save error:", err);
      setError(getErrorMessage(err, "Your preferences could not be saved."));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border">
        <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" />
          Account & Global Platform Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">Control whether your webcam is used for engagement analytics while you watch lectures.</p>
      </div>

      <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Computer Vision & Privacy Settings
          </h3>

          <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">In-Memory Webcam Frame Analysis</div>
              <div className="text-[11px] text-slate-400">
                Face landmarks are computed in your browser; only numeric head-pose and eye-openness values are sent to the server.
                {user?.role !== 'student' && ' Engagement is only recorded for student accounts.'}
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {saved && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Preferences updated in database!
          </div>
        )}

        <button
          onClick={handleSave}
          className="gradient-btn px-6 py-2.5 text-xs font-bold text-white rounded-xl flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>
      </div>
    </div>
  );
};
