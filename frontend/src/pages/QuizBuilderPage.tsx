import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { courseApi, quizApi, getErrorMessage } from '../services/api';
import { Course, Lecture, Quiz } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { HelpCircle, Plus, Trash2, AlertCircle, Pencil, CheckCircle2 } from 'lucide-react';

const inputClass = "w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500";
const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

const emptyForm = {
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  explanation: ''
};

export const QuizBuilderPage: React.FC = () => {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [topicId, setTopicId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const lectureParam = Number(searchParams.get('lecture')) || null;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setCourses(await courseApi.getCourses());
      } catch (err) {
        console.error("Course fetch error:", err);
        setError(getErrorMessage(err, "Could not load courses."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const myLectures: (Lecture & { course: Course })[] = courses
    .filter((c) => role === 'admin' || c.teacher_id === user?.id)
    .flatMap((c) => (c.lectures || []).map((l) => ({ ...l, course: c })));
  const lecture = myLectures.find((l) => l.id === lectureParam) || myLectures[0] || null;
  const lectureId = lecture?.id ?? null;

  const fetchQuizzes = async (id: number) => {
    try {
      setQuizzes(await quizApi.getQuizzes({ lectureId: id }));
    } catch (err) {
      console.error("Quiz fetch error:", err);
      setError(getErrorMessage(err, "Could not load quiz questions."));
    }
  };

  useEffect(() => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setTopicId(null);
    if (lectureId) fetchQuizzes(lectureId);
    else setQuizzes([]);
  }, [lectureId]);

  if (loading) return <LoadingState message="Loading your lectures and quiz questions..." />;

  if (!lecture) {
    return (
      <EmptyState
        title="No lectures to attach quizzes to"
        description="Create a course and add a lecture with topics first. Quiz questions belong to a topic."
      />
    );
  }

  const topics = [...(lecture.topics || [])].sort((a, b) => a.start_time - b.start_time);
  const activeTopicId = topicId ?? topics[0]?.id ?? null;

  const startEdit = (quiz: Quiz) => {
    setEditingId(quiz.id);
    setTopicId(quiz.topic_id);
    setForm({
      question: quiz.question,
      option_a: quiz.option_a,
      option_b: quiz.option_b,
      option_c: quiz.option_c,
      option_d: quiz.option_d,
      correct_option: quiz.correct_option || 'A',
      explanation: quiz.explanation || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTopicId) return;
    setError(null);
    try {
      if (editingId) {
        await quizApi.updateQuiz(editingId, form);
      } else {
        await quizApi.createQuiz({ topic_id: activeTopicId, ...form });
      }
      cancelEdit();
      await fetchQuizzes(lecture.id);
    } catch (err) {
      console.error("Quiz save error:", err);
      setError(getErrorMessage(err, "Could not save the quiz question."));
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    if (!confirm("Delete this question? Students' recorded answers to it are deleted too.")) return;
    setError(null);
    try {
      await quizApi.deleteQuiz(quiz.id);
      if (editingId === quiz.id) cancelEdit();
      await fetchQuizzes(lecture.id);
    } catch (err) {
      console.error("Quiz delete error:", err);
      setError(getErrorMessage(err, "Could not delete the quiz question."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-brand-400" />
            Quiz Builder
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Multiple-choice questions per topic. Students' answers feed directly into each topic's difficulty score.
          </p>
        </div>

        <select
          value={lecture.id}
          onChange={(e) => setSearchParams({ lecture: e.target.value })}
          className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 max-w-[260px]"
        >
          {myLectures.map((l) => (
            <option key={l.id} value={l.id}>{l.course.course_code} — {l.title}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {topics.length === 0 ? (
        <EmptyState
          title="This lecture has no topics"
          description="Add topics to the lecture under Lectures & Topics before writing quiz questions for it."
        />
      ) : (
        <>
          {/* Question form */}
          <form onSubmit={handleSubmit} className="glass-card p-6 rounded-3xl border border-dark-border space-y-3">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-brand-400" />}
              {editingId ? `Edit question #${editingId}` : 'Add a question'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={activeTopicId ?? ''}
                onChange={(e) => setTopicId(Number(e.target.value))}
                disabled={!!editingId}
                className={`${inputClass} disabled:opacity-60`}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <input
                type="text" required value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                className={`${inputClass} md:col-span-2`} placeholder="Question"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {OPTION_KEYS.map((key) => {
                const field = `option_${key.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';
                return (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="radio" name="correct_option" checked={form.correct_option === key}
                      onChange={() => setForm({ ...form, correct_option: key })}
                      className="accent-emerald-500" title={`Mark ${key} as the correct answer`}
                    />
                    <span className="text-xs font-mono font-bold text-slate-400 w-4">{key}</span>
                    <input
                      type="text" required value={form[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className={inputClass} placeholder={`Option ${key}`}
                    />
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">Select the radio button next to the correct option.</p>

            <textarea
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              className={inputClass} placeholder="Explanation shown after the student answers (also used in revision kits)"
            />

            <div className="flex justify-end gap-2">
              {editingId && (
                <button type="button" onClick={cancelEdit} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                  Cancel
                </button>
              )}
              <button type="submit" className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl">
                {editingId ? 'Save Changes' : 'Add Question'}
              </button>
            </div>
          </form>

          {/* Existing questions grouped by topic */}
          {topics.map((t) => {
            const topicQuizzes = quizzes.filter((q) => q.topic_id === t.id);
            return (
              <div key={t.id} className="glass-card p-6 rounded-3xl border border-dark-border space-y-3">
                <h3 className="text-sm font-bold text-white font-heading">
                  {t.title} <span className="text-[11px] font-mono text-slate-400 font-normal">· {topicQuizzes.length} question(s)</span>
                </h3>
                {topicQuizzes.length === 0 && (
                  <p className="text-xs text-slate-500">No questions yet. Students cannot be quizzed on this topic.</p>
                )}
                {topicQuizzes.map((q) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-semibold text-white">{q.question}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(q)} className="text-slate-400 hover:text-amber-400 p-1" title="Edit question">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(q)} className="text-slate-400 hover:text-rose-400 p-1" title="Delete question">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
                      {OPTION_KEYS.map((key) => {
                        const text = q[`option_${key.toLowerCase()}` as 'option_a'];
                        const isCorrect = q.correct_option === key;
                        return (
                          <div key={key} className={`flex items-center gap-1.5 ${isCorrect ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                            {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                            <span className="font-mono">{key})</span> {text}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && <p className="text-[11px] text-slate-500">Explanation: {q.explanation}</p>}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
