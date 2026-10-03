import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi, getErrorMessage } from '../services/api';
import { TeacherAnalytics } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { TopicDifficultyHeatmap } from '../components/charts/TopicDifficultyHeatmap';
import {
  Users, AlertTriangle, BarChart3, Plus, HelpCircle, RefreshCw
} from 'lucide-react';

const show = (value: number | null | undefined, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`);
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

const STATE_COLORS: Record<string, string> = {
  'Focused': 'bg-emerald-500',
  'Distracted': 'bg-amber-500',
  'Low Engagement': 'bg-orange-500',
  'Away': 'bg-rose-500'
};

export const TeacherDashboard: React.FC = () => {
  const [data, setData] = useState<TeacherAnalytics | null>(null);
  const [lectureId, setLectureId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (id?: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(await analyticsApi.getTeacherAnalytics(id));
    } catch (err) {
      console.error("Error fetching teacher analytics:", err);
      setError(getErrorMessage(err, "Could not load class analytics."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(lectureId);
  }, [lectureId]);

  if (loading && !data) return <LoadingState message="Fetching cohort analytics and difficulty heatmaps..." />;
  if (error || !data) {
    return <EmptyState title="Analytics unavailable" description={error || 'No data returned.'} actionLabel="Retry" onAction={() => fetchAnalytics(lectureId)} />;
  }

  const totalSamples = Object.values(data.state_breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-semibold mb-2">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Educator & Curriculum Analytics</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading">
            Teacher Dashboard & Topic Heatmaps 📊
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cohort engagement, quiz results and topic difficulty for the lectures in your courses.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/courses" className="gradient-btn px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </Link>
          <Link to="/quiz-management" className="px-4 py-2.5 text-xs font-bold text-slate-200 glass-card hover:bg-dark-hover rounded-xl border border-dark-border flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-brand-400" />
            <span>Add Quiz Questions</span>
          </Link>
        </div>
      </div>

      {data.lectures.length === 0 ? (
        <EmptyState
          title="No lectures in your courses yet"
          description="Create a course and add a lecture with topics. Analytics appear here once students start watching and answering quizzes."
        />
      ) : (
        <>
          {/* Lecture selector */}
          <div className="flex items-center gap-3">
            <select
              value={data.lecture?.id ?? ''}
              onChange={(e) => setLectureId(Number(e.target.value))}
              className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
            >
              {data.lectures.map((l) => (
                <option key={l.id} value={l.id}>{l.course_title ? `${l.course_title} — ` : ''}{l.title}</option>
              ))}
            </select>
            <button onClick={() => fetchAnalytics(data.lecture?.id)} className="p-2 text-slate-400 hover:text-white" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Class Engagement Drop Alert */}
          {data.engagement_alert && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-rose-200 backdrop-blur-md flex items-start space-x-3 shadow-xl">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-white uppercase font-heading tracking-wider flex items-center space-x-2">
                  <span>{data.engagement_alert.title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-mono text-[10px]">
                    {data.engagement_alert.drop_percentage}% not focused
                  </span>
                </div>
                <p className="text-slate-300 font-medium">
                  Lecture: <strong>{data.engagement_alert.lecture}</strong>
                  {data.engagement_alert.topic && <> | Topic: <strong>{data.engagement_alert.topic}</strong></>}
                </p>
                <p className="text-slate-400">{data.engagement_alert.message}</p>
              </div>
            </div>
          )}

          {/* Educator Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-dark-border space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">Active Students</div>
              <div className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-400" />
                {data.active_students} <span className="text-xs font-normal text-slate-400">/ {data.total_students}</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-dark-border space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">Avg Class Engagement</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-heading">
                {show(data.average_engagement, '%')}
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-dark-border space-y-1">
              <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">Avg Quiz Performance</div>
              <div className="text-2xl font-extrabold text-purple-400 font-heading">
                {show(data.average_quiz_score, '%')}
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-dark-border space-y-1 col-span-2 md:col-span-1">
              <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">Students At Risk</div>
              <div className="text-2xl font-extrabold text-rose-400 font-heading flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                {data.students_at_risk_count}
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-dark-border space-y-1 col-span-2 md:col-span-1">
              <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">Hardest Topic</div>
              <div className="text-xs font-bold text-amber-400 truncate" title={data.hardest_topic || undefined}>
                {data.hardest_topic || '—'}
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-400" />
              Topic Difficulty — {data.lecture?.title}
            </h3>
            {data.topic_summaries.some((t) => t.avg_difficulty !== null) ? (
              <TopicDifficultyHeatmap topics={data.topic_summaries} />
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                {data.topic_summaries.length === 0
                  ? 'This lecture has no topics yet. Add topics under Lectures & Topics.'
                  : 'No student activity has been recorded for this lecture yet.'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Focus state breakdown */}
            <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
              <h3 className="text-sm font-bold text-white font-heading">Focus State Breakdown</h3>
              {totalSamples === 0 ? (
                <p className="text-xs text-slate-400">No camera engagement samples for this lecture yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.state_breakdown).map(([state, count]) => {
                    const pct = Math.round((count / totalSamples) * 100);
                    return (
                      <div key={state}>
                        <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                          <span>{state}</span>
                          <span className="font-mono">{count} samples · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-dark-bg overflow-hidden">
                          <div className={`h-full ${STATE_COLORS[state] || 'bg-slate-500'}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Students at risk */}
            <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
              <h3 className="text-sm font-bold text-white font-heading">Students At Risk</h3>
              {data.students_at_risk.length === 0 ? (
                <p className="text-xs text-slate-400">No student in this lecture is currently flagged.</p>
              ) : (
                <div className="space-y-2">
                  {data.students_at_risk.map((s) => (
                    <div key={s.student_id} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-white">{s.name}</span>
                        <Link to={`/analytics?student=${s.student_id}`} className="text-[11px] font-semibold text-brand-400 hover:underline shrink-0">
                          View analytics
                        </Link>
                      </div>
                      <div className="text-[11px] text-rose-300 mt-0.5">{s.reasons.join(' · ')}</div>
                      {s.difficult_topics.length > 0 && (
                        <div className="text-[11px] text-slate-400 mt-0.5">Struggling with: {s.difficult_topics.join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Topic Breakdown Table */}
          <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
            <h3 className="text-sm font-bold text-white font-heading">Lecture Topic Breakdown & Student Replay Behavior</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-dark-border text-slate-400 uppercase font-mono text-[10px]">
                    <th className="pb-3">Topic Title</th>
                    <th className="pb-3">Time Marker</th>
                    <th className="pb-3">Students</th>
                    <th className="pb-3">Difficulty</th>
                    <th className="pb-3">Avg Engagement</th>
                    <th className="pb-3">Avg Quiz Score</th>
                    <th className="pb-3">Replays</th>
                    <th className="pb-3">Quiz Qs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/50 text-slate-300">
                  {data.topic_summaries.map((t) => (
                    <tr key={t.topic_id} className="hover:bg-dark-card/50">
                      <td className="py-3 font-semibold text-white">{t.topic_title}</td>
                      <td className="py-3 font-mono">{formatTime(t.start_time)} - {formatTime(t.end_time)}</td>
                      <td className="py-3 font-mono">{t.student_count}</td>
                      <td className="py-3">
                        {t.avg_difficulty === null ? '—' : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.avg_difficulty > 75 ? 'bg-rose-500/20 text-rose-400'
                              : t.avg_difficulty > 55 ? 'bg-amber-500/20 text-amber-400'
                              : t.avg_difficulty > 30 ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {t.avg_difficulty} / 100
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-bold text-blue-400">{show(t.avg_engagement, '%')}</td>
                      <td className="py-3 font-bold text-purple-400">{show(t.avg_quiz_score, '%')}</td>
                      <td className="py-3 font-bold text-amber-400">{t.total_replays}</td>
                      <td className="py-3 font-mono">
                        {t.quiz_count === 0 ? <span className="text-rose-400">none</span> : t.quiz_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
