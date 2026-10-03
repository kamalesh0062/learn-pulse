import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, getErrorMessage } from '../services/api';
import { StudentAnalytics } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { EngagementTrendChart } from '../components/charts/EngagementTrendChart';
import { TopicDifficultyCard } from '../components/common/TopicDifficultyCard';
import {
  BrainCircuit, Sparkles, Video, AlertTriangle, Flame, ArrowRight, BookOpen, RefreshCw, CheckCircle2
} from 'lucide-react';

/** A number, or an em dash when the signal has not been measured yet. */
const show = (value: number | null | undefined, suffix = '') => (value === null || value === undefined ? '—' : `${value}${suffix}`);

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await analyticsApi.getStudentAnalytics());
    } catch (err) {
      console.error("Failed to load student analytics:", err);
      setError(getErrorMessage(err, "Could not load your analytics."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) return <LoadingState message="Calculating overall learning score and engagement metrics..." />;
  if (error || !data) {
    return <EmptyState title="Analytics unavailable" description={error || 'No data returned.'} actionLabel="Retry" onAction={fetchAnalytics} />;
  }

  const focus = data.focus_topic;
  const timeline = data.engagement_timeline;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Student Performance Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading">
            Welcome back, {user?.name || 'Student'}! 🎓
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Computed from your lecture engagement, video events, and micro-quizzes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to={timeline.lecture_id ? `/player/${timeline.lecture_id}` : '/courses'}
            className="gradient-btn px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center space-x-2"
          >
            <Video className="w-4 h-4" />
            <span>{timeline.lecture_id ? 'Resume Lecture' : 'Start a Lecture'}</span>
          </Link>
          <Link to="/revision" className="px-4 py-2.5 text-xs font-bold text-slate-200 glass-card hover:bg-dark-hover rounded-xl border border-dark-border flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI Revision Kit</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 font-mono uppercase">Overall Learning Score</div>
          <div className="text-3xl font-extrabold text-brand-400 font-heading">
            {show(data.overall_learning_score)} <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {data.overall_learning_score === null ? 'No quiz or camera data yet' : `Course progress: ${data.course_progress}%`}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 font-mono uppercase">Visual Engagement</div>
          <div className="text-3xl font-extrabold text-blue-400 font-heading">
            {show(data.engagement_score, '%')}
          </div>
          <div className="text-[11px] text-slate-400">
            {data.engagement_samples > 0
              ? `${data.engagement_samples} camera samples`
              : user?.camera_consent ? 'No camera samples yet' : 'Camera analytics is off'}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 font-mono uppercase">Quiz Average</div>
          <div className="text-3xl font-extrabold text-purple-400 font-heading">
            {show(data.quiz_average, '%')}
          </div>
          <div className="text-[11px] text-slate-400">{data.quizzes_answered} question(s) answered</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-dark-border space-y-2">
          <div className="text-[11px] font-semibold text-slate-400 font-mono uppercase">Study Streak</div>
          <div className="text-3xl font-extrabold text-amber-400 font-heading flex items-center gap-1">
            <Flame className={`w-6 h-6 ${data.study_streak_days > 0 ? 'text-amber-500 fill-amber-500' : 'text-slate-600'}`} />
            {data.study_streak_days} <span className="text-xs font-normal text-slate-400">{data.study_streak_days === 1 ? 'Day' : 'Days'}</span>
          </div>
          <div className="text-[11px] text-slate-400">Consecutive days with activity</div>
        </div>
      </div>

      {/* Main Grid: Engagement Chart & Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engagement Trend Timeline */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-dark-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-brand-400" />
                Engagement Timeline
              </h3>
              <p className="text-[11px] text-slate-400">
                {timeline.lecture_title
                  ? `Average focus per 30 seconds of "${timeline.lecture_title}"`
                  : 'Average focus per 30 seconds of your most recent lecture'}
              </p>
            </div>
            <button onClick={fetchAnalytics} className="p-2 text-slate-400 hover:text-white" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {timeline.points.length > 0 ? (
            <EngagementTrendChart data={timeline.points} />
          ) : (
            <div className="h-64 flex items-center justify-center text-center text-xs text-slate-400 px-6">
              {user?.camera_consent
                ? 'No engagement has been recorded yet. Watch a lecture with your camera on to see your focus over time.'
                : 'Camera analytics is off for your account, so there is no engagement timeline. You can enable it under Privacy Controls.'}
            </div>
          )}
        </div>

        {/* Personalized Recommendation Card */}
        <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4 bg-gradient-to-b from-dark-card to-brand-900/10">
          <div className="flex items-center space-x-2 text-purple-400 font-semibold text-xs uppercase tracking-wider font-mono">
            <Sparkles className="w-4 h-4" />
            <span>Learning Assistant</span>
          </div>

          <h3 className="text-base font-bold text-white font-heading">
            Personalized Revision Focus
          </h3>

          <div className="p-4 rounded-2xl bg-dark-bg/80 border border-dark-border space-y-2">
            {focus ? (
              <>
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Target Weak Topic</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[10px]">Difficulty: {focus.difficulty_score}</span>
                </div>
                <div className="text-sm font-bold text-white">{focus.topic_title}</div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> No weak topic identified
              </div>
            )}
            <p className="text-xs text-slate-400 leading-relaxed">{data.recommendation}</p>
          </div>

          <Link
            to={focus ? `/revision?topic=${focus.topic_id}` : '/courses'}
            className="w-full gradient-btn py-3 text-xs font-bold text-white rounded-xl flex items-center justify-center space-x-2"
          >
            <span>{focus ? 'Generate Revision Kit' : 'Browse Lectures'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Topic Difficulties Section */}
      <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
        <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-400" />
          Your Topic Difficulties & Contributing Signals
        </h3>

        {data.difficult_topics.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nothing here yet. Topic difficulty appears once you watch a lecture or answer a topic quiz.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.difficult_topics.map((topic) => (
              <TopicDifficultyCard key={topic.topic_id} topic={topic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
