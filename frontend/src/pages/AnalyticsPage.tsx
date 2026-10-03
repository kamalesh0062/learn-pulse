import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { analyticsApi, reportApi, getErrorMessage } from '../services/api';
import { DifficultTopic, RosterStudent, StudentAnalytics } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { EngagementTrendChart } from '../components/charts/EngagementTrendChart';
import { difficultyBadgeClass } from '../components/common/TopicDifficultyCard';
import { LineChart, Eye, HelpCircle, RotateCcw, PauseCircle, ArrowLeft, Download, Users } from 'lucide-react';

const show = (value: number | null | undefined, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`);

// Mirrors the weights in config.py / ml/difficulty_engine.py
const WEIGHTS = { engagement: 0.35, quiz: 0.35, replay: 0.15, pause: 0.10, watch: 0.05 };

/** Plain-language reading of each signal behind one topic's difficulty score. */
const TopicExplanation: React.FC<{ topic: DifficultTopic; forStudent: boolean }> = ({ topic, forStudent }) => {
  const replayPenalty = Math.min(100, (topic.replay_count / 3) * 100);
  const pausePenalty = Math.min(100, (topic.pause_count / 4) * 100);

  const factors = [
    {
      icon: HelpCircle, color: 'text-purple-400', title: 'Quiz accuracy', weight: WEIGHTS.quiz,
      value: topic.quiz_score === null ? 'Not attempted' : `${topic.quiz_score}%`,
      note: topic.quiz_score === null
        ? 'No quiz answers yet, so this signal is left out of the score.'
        : topic.quiz_score >= 70 ? 'Strong quiz results lower the difficulty.' : 'Low quiz accuracy raises the difficulty.'
    },
    {
      icon: Eye, color: 'text-blue-400', title: 'Visual engagement', weight: WEIGHTS.engagement,
      value: topic.engagement_score === null ? 'Not measured' : `${topic.engagement_score}%`,
      note: topic.engagement_score === null
        ? 'No camera samples for this topic, so this signal is left out of the score.'
        : topic.engagement_score >= 70 ? 'Mostly focused while watching.' : 'Attention drifted while watching this segment.'
    },
    {
      icon: RotateCcw, color: 'text-amber-400', title: 'Replays', weight: WEIGHTS.replay,
      value: `${topic.replay_count}`,
      note: replayPenalty === 0 ? 'No rewinds in this segment.' : `Rewinding counts ${Math.round(replayPenalty)}% towards the replay penalty (3 or more is the maximum).`
    },
    {
      icon: PauseCircle, color: 'text-orange-400', title: 'Pauses', weight: WEIGHTS.pause,
      value: `${topic.pause_count}`,
      note: pausePenalty === 0 ? 'No pauses in this segment.' : `Pausing counts ${Math.round(pausePenalty)}% towards the pause penalty (4 or more is the maximum).`
    }
  ];

  return (
    <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
      <div className="flex justify-between items-start border-b border-dark-border pb-4 gap-4">
        <div className="min-w-0">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${difficultyBadgeClass(topic.difficulty_label)}`}>
            {topic.difficulty_label.toUpperCase()}
          </span>
          <h3 className="text-lg font-bold text-white font-heading mt-1">{topic.topic_title}</h3>
          {topic.lecture_title && <div className="text-[11px] text-slate-400">{topic.lecture_title}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-extrabold text-white font-heading">{topic.difficulty_score} / 100</div>
          <div className="text-[10px] text-slate-400 font-mono">Difficulty Score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {factors.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-2">
              <div className={`flex items-center justify-between text-xs font-bold ${f.color}`}>
                <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {f.title}</span>
                <span className="text-[10px] font-mono text-slate-500">weight {Math.round(f.weight * 100)}%</span>
              </div>
              <div className="text-xl font-bold text-white">{f.value}</div>
              <p className="text-[10px] text-slate-400">{f.note}</p>
            </div>
          );
        })}
      </div>

      {forStudent && (
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <Link to={`/player/${topic.lecture_id}`} className="text-brand-400 hover:underline">Rewatch lecture</Link>
          <Link to={`/quiz?lecture=${topic.lecture_id}&topic=${topic.topic_id}`} className="text-brand-400 hover:underline">Take topic quiz</Link>
          <Link to={`/revision?topic=${topic.topic_id}`} className="text-purple-400 hover:underline">Generate revision kit</Link>
        </div>
      )}
    </div>
  );
};

const StudentAnalyticsView: React.FC<{ studentId?: number; forStudent: boolean }> = ({ studentId, forStudent }) => {
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await analyticsApi.getStudentAnalytics(studentId);
        if (!cancelled) setData(res);
      } catch (err) {
        console.error("Analytics fetch error:", err);
        if (!cancelled) setError(getErrorMessage(err, "Could not load analytics."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (loading) return <LoadingState message="Calculating explainable analytics and topic difficulty metrics..." />;
  if (error || !data) return <EmptyState title="Analytics unavailable" description={error || 'No data returned.'} />;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await reportApi.downloadReport(studentId);
    } catch (err) {
      setError(getErrorMessage(err, "The report could not be downloaded."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {!forStudent && (
            <Link to="/analytics" className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to student roster
            </Link>
          )}
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <LineChart className="w-6 h-6 text-brand-400" />
            {forStudent ? 'Explainable Learning Analytics' : `Analytics: ${data.student_name}`}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Why each topic received its difficulty score, signal by signal. Signals that were never measured are excluded rather than guessed.
          </p>
        </div>
        {!forStudent && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="gradient-btn px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {downloading ? 'Preparing...' : 'Download PDF Report'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Learning Score', value: show(data.overall_learning_score), color: 'text-brand-400' },
          { label: 'Quiz Average', value: show(data.quiz_average, '%'), color: 'text-purple-400' },
          { label: 'Visual Engagement', value: show(data.engagement_score, '%'), color: 'text-blue-400' },
          { label: 'Course Progress', value: `${data.course_progress}%`, color: 'text-emerald-400' },
          { label: 'Study Streak', value: `${data.study_streak_days} d`, color: 'text-amber-400' }
        ].map((m) => (
          <div key={m.label} className="glass-card p-4 rounded-2xl border border-dark-border space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 font-mono uppercase">{m.label}</div>
            <div className={`text-2xl font-extrabold font-heading ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {data.engagement_timeline.points.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-3">
          <h3 className="text-sm font-bold text-white font-heading">
            Engagement over "{data.engagement_timeline.lecture_title}"
          </h3>
          <EngagementTrendChart data={data.engagement_timeline.points} />
        </div>
      )}

      {data.difficult_topics.length === 0 ? (
        <EmptyState
          title="No topic activity yet"
          description={forStudent
            ? 'Watch a lecture or answer a topic quiz and the breakdown for that topic will appear here.'
            : 'This student has not watched a lecture or answered a quiz yet.'}
        />
      ) : (
        data.difficult_topics.map((topic) => (
          <TopicExplanation key={topic.topic_id} topic={topic} forStudent={forStudent} />
        ))
      )}
    </div>
  );
};

const RosterView: React.FC = () => {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setRoster(await analyticsApi.getStudentRoster());
      } catch (err) {
        console.error("Roster fetch error:", err);
        setError(getErrorMessage(err, "Could not load the student roster."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingState message="Loading student roster..." />;
  if (error) return <EmptyState title="Roster unavailable" description={error} />;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border">
        <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-400" />
          Class Analytics — Student Roster
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Students with recorded activity in your courses. Open a student to see the signals behind each of their topic scores.
          For per-lecture heatmaps, use the <Link to="/teacher" className="text-brand-400 hover:underline">teacher dashboard</Link>.
        </p>
      </div>

      {roster.length === 0 ? (
        <EmptyState title="No student activity yet" description="Students appear here once they watch one of your lectures or answer one of your quizzes." />
      ) : (
        <div className="glass-card p-6 rounded-3xl border border-dark-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-dark-border text-slate-400 uppercase font-mono text-[10px]">
                <th className="pb-3">Student</th>
                <th className="pb-3">Enrollment</th>
                <th className="pb-3">Topics Tracked</th>
                <th className="pb-3">Avg Difficulty</th>
                <th className="pb-3">Engagement</th>
                <th className="pb-3">Difficult Topics</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50 text-slate-300">
              {roster.map((s) => (
                <tr key={s.student_id} className="hover:bg-dark-card/50">
                  <td className="py-3">
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-[10px] text-slate-500">{s.email}</div>
                  </td>
                  <td className="py-3 font-mono">{s.enrollment_no || '—'}</td>
                  <td className="py-3 font-mono">{s.topics_tracked}</td>
                  <td className="py-3 font-bold text-amber-400">{show(s.avg_difficulty)}</td>
                  <td className="py-3 font-bold text-blue-400">{show(s.engagement, '%')}</td>
                  <td className="py-3 font-mono">
                    {s.difficult_topic_count > 0 ? <span className="text-rose-400">{s.difficult_topic_count}</span> : 0}
                  </td>
                  <td className="py-3 text-right">
                    <Link to={`/analytics?student=${s.student_id}`} className="text-[11px] font-semibold text-brand-400 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const studentParam = Number(searchParams.get('student')) || undefined;

  if (role === 'student') return <StudentAnalyticsView forStudent />;
  if (studentParam) return <StudentAnalyticsView studentId={studentParam} forStudent={false} />;
  return <RosterView />;
};
