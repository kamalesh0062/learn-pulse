import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { courseApi, lectureApi, topicApi, getErrorMessage } from '../services/api';
import { Course, Lecture } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Video, Plus, Trash2, AlertCircle, Play, HelpCircle, ListTree } from 'lucide-react';

const inputClass = "w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500";

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

/** Accepts "mm:ss" or plain seconds. Returns null when the text is not a valid time. */
const parseTime = (text: string): number | null => {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return null;
};

export const LectureManagerPage: React.FC = () => {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New lecture form
  const [lectureTitle, setLectureTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('10');

  // New topic form (one open at a time, per lecture)
  const [topicLectureId, setTopicLectureId] = useState<number | null>(null);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicStart, setTopicStart] = useState('');
  const [topicEnd, setTopicEnd] = useState('');
  const [topicDesc, setTopicDesc] = useState('');

  const fetchCourses = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      setCourses(await courseApi.getCourses());
    } catch (err) {
      console.error("Course fetch error:", err);
      setError(getErrorMessage(err, "Could not load courses."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses(true);
  }, []);

  if (loading) return <LoadingState message="Loading your courses and lectures..." />;

  const myCourses = courses.filter((c) => role === 'admin' || c.teacher_id === user?.id);
  if (myCourses.length === 0) {
    return (
      <EmptyState
        title="You have no courses yet"
        description="Create a course first, then come back here to add lectures and topics to it."
      />
    );
  }

  const selectedCourse = myCourses.find((c) => c.id === Number(searchParams.get('course'))) || myCourses[0];
  const lectures = selectedCourse.lectures || [];

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
      await fetchCourses();
      return true;
    } catch (err) {
      console.error(fallback, err);
      setError(getErrorMessage(err, fallback));
      return false;
    }
  };

  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseFloat(durationMinutes);
    if (!(minutes > 0)) {
      setError("Lecture duration must be a positive number of minutes.");
      return;
    }
    const ok = await run(
      () => lectureApi.createLecture(selectedCourse.id, lectureTitle, videoUrl, Math.round(minutes * 60)),
      "Could not create the lecture."
    );
    if (ok) {
      setLectureTitle('');
      setVideoUrl('');
      setDurationMinutes('10');
    }
  };

  const handleDeleteLecture = (lecture: Lecture) => {
    if (!confirm(`Delete "${lecture.title}" with its topics and quizzes?`)) return;
    run(() => lectureApi.deleteLecture(lecture.id), "Could not delete the lecture.");
  };

  const openTopicForm = (lecture: Lecture) => {
    const lastEnd = Math.max(0, ...(lecture.topics || []).map((t) => t.end_time));
    setTopicLectureId(lecture.id);
    setTopicTitle('');
    setTopicDesc('');
    setTopicStart(formatTime(lastEnd ? lastEnd + 1 : 0));
    setTopicEnd(formatTime(lecture.duration_seconds));
  };

  const handleCreateTopic = async (e: React.FormEvent, lecture: Lecture) => {
    e.preventDefault();
    const start = parseTime(topicStart);
    const end = parseTime(topicEnd);
    if (start === null || end === null) {
      setError("Topic times must be written as mm:ss (for example 3:05) or as seconds.");
      return;
    }
    if (end <= start) {
      setError("A topic's end time must be after its start time.");
      return;
    }
    if (end > lecture.duration_seconds) {
      setError(`The topic ends after the lecture does (${formatTime(lecture.duration_seconds)}).`);
      return;
    }
    const ok = await run(
      () => topicApi.createTopic(lecture.id, topicTitle, start, end, topicDesc),
      "Could not create the topic."
    );
    if (ok) setTopicLectureId(null);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <Video className="w-6 h-6 text-brand-400" />
            Lectures & Topics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Add lecture videos to a course and split them into timed topics. Engagement, quizzes and difficulty are tracked per topic.
          </p>
        </div>

        <select
          value={selectedCourse.id}
          onChange={(e) => setSearchParams({ course: e.target.value })}
          className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
        >
          {myCourses.map((c) => (
            <option key={c.id} value={c.id}>{c.course_code} — {c.title}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add lecture */}
      <form onSubmit={handleCreateLecture} className="glass-card p-6 rounded-3xl border border-dark-border space-y-3">
        <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-400" /> Add a lecture to {selectedCourse.course_code}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="text" required value={lectureTitle} onChange={(e) => setLectureTitle(e.target.value)}
            className={`${inputClass} md:col-span-2`} placeholder="Lecture title"
          />
          <input
            type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            className={`${inputClass} md:col-span-2`} placeholder="Video URL (https://.../lecture.mp4)"
          />
          <input
            type="number" required min="1" step="0.5" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
            className={inputClass} placeholder="Minutes" title="Duration in minutes"
          />
          <button type="submit" className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl">
            Add Lecture
          </button>
        </div>
      </form>

      {lectures.length === 0 && (
        <EmptyState title="No lectures in this course" description="Use the form above to add the first lecture." />
      )}

      {lectures.map((lecture) => {
        const topics = [...(lecture.topics || [])].sort((a, b) => a.start_time - b.start_time);
        return (
          <div key={lecture.id} className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white font-heading">{lecture.title}</h3>
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  {formatTime(lecture.duration_seconds)} · {lecture.video_url}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/player/${lecture.id}`} className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-[11px] font-semibold text-slate-200 hover:bg-dark-hover flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" /> Preview
                </Link>
                <Link to={`/quiz-management?lecture=${lecture.id}`} className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Quizzes
                </Link>
                <button onClick={() => handleDeleteLecture(lecture)} className="text-slate-400 hover:text-rose-400 p-1" title="Delete lecture">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                <ListTree className="w-3.5 h-3.5" /> Topics ({topics.length})
              </div>
              {topics.length === 0 && (
                <p className="text-xs text-slate-500">
                  No topics yet. Without topics, engagement and quiz results for this lecture cannot be attributed to anything.
                </p>
              )}
              {topics.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">
                      <span className="font-mono text-brand-400 mr-2">{formatTime(t.start_time)} - {formatTime(t.end_time)}</span>
                      {t.title}
                    </div>
                    {t.description && <div className="text-[11px] text-slate-400 mt-0.5">{t.description}</div>}
                  </div>
                  <button
                    onClick={() => confirm(`Delete topic "${t.title}" and its quizzes?`) && run(() => topicApi.deleteTopic(t.id), "Could not delete the topic.")}
                    className="text-slate-400 hover:text-rose-400 p-1 shrink-0" title="Delete topic"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {topicLectureId === lecture.id ? (
              <form onSubmit={(e) => handleCreateTopic(e, lecture)} className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text" required value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)}
                    className={`${inputClass} md:col-span-2`} placeholder="Topic title"
                  />
                  <input
                    type="text" required value={topicStart} onChange={(e) => setTopicStart(e.target.value)}
                    className={inputClass} placeholder="Start (mm:ss)"
                  />
                  <input
                    type="text" required value={topicEnd} onChange={(e) => setTopicEnd(e.target.value)}
                    className={inputClass} placeholder="End (mm:ss)"
                  />
                </div>
                <textarea
                  value={topicDesc} onChange={(e) => setTopicDesc(e.target.value)}
                  className={inputClass} placeholder="Short description (shown to students and used in revision kits)"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setTopicLectureId(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl">
                    Save Topic
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => openTopicForm(lecture)}
                className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border text-[11px] font-semibold text-slate-200 hover:bg-dark-hover flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Topic
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
