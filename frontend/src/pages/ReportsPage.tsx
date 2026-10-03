import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, reportApi, getErrorMessage } from '../services/api';
import { RosterStudent } from '../types';
import { FileText, Download, AlertCircle } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { user, role } = useAuth();
  const isStudent = role === 'student';
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | 'self' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isStudent) return;
    analyticsApi.getStudentRoster()
      .then(setRoster)
      .catch((err) => setError(getErrorMessage(err, "Could not load the student roster.")));
  }, [isStudent]);

  const handleDownload = async (studentId?: number) => {
    setError(null);
    setDownloadingId(studentId ?? 'self');
    try {
      await reportApi.downloadReport(studentId);
    } catch (err) {
      console.error("Report download error:", err);
      setError(getErrorMessage(err, "The report could not be downloaded."));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border">
        <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-400" />
          {isStudent ? 'Your Learning Report' : 'Student Learning Reports'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          PDF summary of quiz results, visual engagement, study streak and per-topic difficulty, generated from the live database.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isStudent ? (
        <div className="glass-card p-8 rounded-3xl border border-dark-border space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto shadow-glow">
            <FileText className="w-8 h-8" />
          </div>

          <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border text-left text-xs space-y-2 max-w-md mx-auto">
            <div className="flex justify-between text-slate-300">
              <span>Student Name:</span>
              <span className="font-bold text-white">{user?.name}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Enrollment ID:</span>
              <span className="font-mono text-brand-400 font-bold">{user?.enrollment_no || 'not assigned'}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Report Format:</span>
              <span className="font-mono text-emerald-400 font-bold">PDF</span>
            </div>
          </div>

          <button
            onClick={() => handleDownload()}
            disabled={downloadingId !== null}
            className="gradient-btn px-6 py-3 text-xs font-bold text-white rounded-xl inline-flex items-center space-x-2 shadow-glow disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingId ? 'Preparing report...' : 'Download PDF Report'}</span>
          </button>
        </div>
      ) : (
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-3">
          {roster.length === 0 ? (
            <p className="text-xs text-slate-400">
              No students have recorded activity in your courses yet, so there are no reports to export.
            </p>
          ) : (
            roster.map((s) => (
              <div key={s.student_id} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">{s.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {s.enrollment_no || s.email} · {s.topics_tracked} topic(s) tracked
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(s.student_id)}
                  disabled={downloadingId !== null}
                  className="gradient-btn px-3 py-1.5 text-[11px] font-bold text-white rounded-lg flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingId === s.student_id ? 'Preparing...' : 'PDF'}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
