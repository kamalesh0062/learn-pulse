import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getErrorMessage } from '../services/api';
import { EmptyState } from '../components/common/EmptyState';
import { SystemStatus } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { 
  Shield, Database, Cpu, Sparkles, Activity, 
  FileText, CheckCircle2, AlertCircle, RefreshCw 
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getStatus();
      setStatus(res);
    } catch (err) {
      console.error("Admin status fetch error:", err);
      setError(getErrorMessage(err, "Could not load system status."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) return <LoadingState message="Connecting to system administration & database diagnostics..." />;
  if (error || !status) {
    return <EmptyState title="System status unavailable" description={error || 'No data returned.'} actionLabel="Retry" onAction={fetchStatus} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex items-center justify-between">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>System Administrator Mode</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading">
            System Admin & Infrastructure Diagnostics 🛠️
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of SQLite database tables, ML inference engine, AI providers, and system audit logs.
          </p>
        </div>

        <button onClick={fetchStatus} className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>Refresh System Diagnostic</span>
        </button>
      </div>

      {/* System Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Database Diagnostic */}
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center space-x-2 text-brand-400 font-bold text-sm">
              <Database className="w-5 h-5" />
              <span>Database Status</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">{status.status.toUpperCase()}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Database Size:</span>
              <span className="font-mono text-white font-bold">{status.database.size_kb} KB</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Users:</span>
              <span className="font-mono text-white font-bold">{status.database.student_count} students · {status.database.teacher_count} teachers · {status.database.admin_count} admins</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Courses:</span>
              <span className="font-mono text-white font-bold">{status.database.course_count}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Lectures & Topics:</span>
              <span className="font-mono text-white font-bold">{status.database.lecture_count} / {status.database.topic_count}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Quiz Questions:</span>
              <span className="font-mono text-white font-bold">{status.database.quiz_count}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Engagement Logs Recorded:</span>
              <span className="font-mono text-white font-bold">{status.database.engagement_logs}</span>
            </div>
            <Link to="/users" className="block text-[11px] font-semibold text-brand-400 hover:underline pt-1">Open user directory →</Link>
          </div>
        </div>

        {/* ML Engine Status */}
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
              <Cpu className="w-5 h-5" />
              <span>Machine Learning & CV</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status.ml_engine.model_loaded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {status.ml_engine.model_loaded ? 'MODEL LOADED' : 'RULE FALLBACK'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Server Classifier:</span>
              <span className="font-mono text-white font-bold">{status.ml_engine.classifier}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Model File:</span>
              <span className="font-mono text-white font-bold">{status.ml_engine.model_file_exists ? 'random_forest.pkl present' : 'missing'}</span>
            </div>
            <div className="flex justify-between text-slate-400 gap-3">
              <span className="shrink-0">Landmark Detection:</span>
              <span className="font-mono text-white font-bold text-right">{status.ml_engine.cv_detector}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Server-side MediaPipe:</span>
              <span className="font-mono text-white font-bold">{status.ml_engine.server_mediapipe_available ? 'Installed' : 'Not installed'}</span>
            </div>
          </div>
        </div>

        {/* AI Generative Provider Status */}
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <Sparkles className="w-5 h-5" />
              <span>AI Provider Status</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status.ai_provider.fallback_active ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {status.ai_provider.active_provider.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Google Gemini API:</span>
              <span className="font-mono text-white font-bold">{status.ai_provider.gemini_active ? "API key configured" : "No API key"}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>OpenAI API:</span>
              <span className="font-mono text-white font-bold">{status.ai_provider.openai_active ? "API key configured" : "No API key"}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Revision kits currently use:</span>
              <span className="font-mono text-white font-bold">{status.ai_provider.fallback_active ? 'Offline kit (no AI)' : status.ai_provider.active_provider}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
        <h3 className="text-sm font-bold text-white font-heading">Recent Security & System Audit Logs</h3>

        <div className="space-y-2">
          {status.audit_logs.length === 0 && <p className="text-xs text-slate-400">No audit events recorded yet.</p>}
          {status.audit_logs.map((log) => (
            <div key={log.id} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-brand-400 font-mono">[{log.action}]</span>{' '}
                <span className="text-slate-300">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
