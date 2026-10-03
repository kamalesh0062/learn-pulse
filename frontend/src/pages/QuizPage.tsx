import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { courseApi, quizApi, getErrorMessage } from '../services/api';
import { Course, Lecture, Quiz, QuizResult } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { HelpCircle, CheckCircle2, XCircle, ArrowRight, Award, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lectureParam = Number(searchParams.get('lecture')) || null;
  const topicParam = Number(searchParams.get('topic')) || null;

  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [finished, setFinished] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        setCourses(await courseApi.getCourses());
      } catch (err) {
        console.error("Course fetch error:", err);
        setError(getErrorMessage(err, "Could not load lectures."));
      } finally {
        setLoadingCatalog(false);
      }
    };
    load();
  }, []);

  const allLectures: (Lecture & { course: Course })[] = courses.flatMap((c) =>
    (c.lectures || []).map((l) => ({ ...l, course: c }))
  );
  const lecture = allLectures.find((l) => l.id === lectureParam) || allLectures[0] || null;
  const lectureId = lecture?.id ?? null;
  const topics = [...(lecture?.topics || [])].sort((a, b) => a.start_time - b.start_time);
  const topic = topics.find((t) => t.id === topicParam) || null;

  const resetAttempt = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setResult(null);
    setResults([]);
    setFinished(false);
  };

  useEffect(() => {
    if (!lectureId) return;
    let cancelled = false;
    const fetchQuizzes = async () => {
      setLoadingQuizzes(true);
      setError(null);
      resetAttempt();
      try {
        const list = await quizApi.getQuizzes(topicParam ? { topicId: topicParam } : { lectureId });
        if (!cancelled) setQuizzes(list);
      } catch (err) {
        console.error("Quiz fetch error:", err);
        if (!cancelled) setError(getErrorMessage(err, "Could not load quiz questions."));
      } finally {
        if (!cancelled) setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
    return () => {
      cancelled = true;
    };
  }, [lectureId, topicParam]);

  if (loadingCatalog) return <LoadingState message="Loading micro-quiz questions from database..." />;

  if (!lecture) {
    return (
      <EmptyState
        title="No lectures available"
        description="There are no lectures to be quizzed on yet."
        actionLabel="Browse courses"
        onAction={() => navigate('/courses')}
      />
    );
  }

  const currentQuiz = quizzes[currentIndex];
  const topicTitle = (id: number) => topics.find((t) => t.id === id)?.title || `Topic #${id}`;

  const handleSubmit = async () => {
    if (!selectedOption || !currentQuiz) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await quizApi.submitAnswer(currentQuiz.id, selectedOption);
      setResult(res);
      setResults((prev) => [...prev, res]);
    } catch (err) {
      console.error("Quiz submit error:", err);
      setError(getErrorMessage(err, "Your answer could not be saved. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    setSelectedOption(null);
    setResult(null);
    if (currentIndex < quizzes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
    }
  };

  const correctCount = results.filter((r) => r.is_correct).length;
  // Topics from this attempt whose latest difficulty came back as hard
  const hardTopics = Array.from(
    new Map(
      results
        .map((r) => ({ r, quiz: quizzes.find((q) => q.id === r.quiz_id) }))
        .filter(({ r, quiz }) => quiz && (r.difficulty_label === 'Difficult' || r.difficulty_label === 'Very Difficult'))
        .map(({ r, quiz }) => [quiz!.topic_id, r])
    ).entries()
  );

  const optionStyle = (key: string) => {
    if (result) {
      if (key === result.correct_option) return 'bg-emerald-500/20 border-emerald-500 text-white';
      if (key === selectedOption) return 'bg-rose-500/20 border-rose-500 text-white';
      return 'bg-dark-bg/60 border-dark-border text-slate-400';
    }
    return selectedOption === key
      ? 'bg-brand-600/30 border-brand-500 text-white shadow-glow'
      : 'bg-dark-bg/60 border-dark-border text-slate-300 hover:border-slate-600';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border space-y-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold mb-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Interactive Micro-Quiz System</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading">
            {topic ? `Topic Quiz: ${topic.title}` : `Lecture Quiz: ${lecture.title}`}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {quizzes.length > 0 && !finished
              ? `Question ${currentIndex + 1} of ${quizzes.length} • every answer is saved and updates your topic difficulty`
              : 'Every answer is saved and updates your topic difficulty'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={lecture.id}
            onChange={(e) => setSearchParams({ lecture: e.target.value })}
            className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            {allLectures.map((l) => (
              <option key={l.id} value={l.id}>{l.course.course_code} — {l.title}</option>
            ))}
          </select>
          <select
            value={topic?.id ?? ''}
            onChange={(e) => setSearchParams(e.target.value ? { lecture: String(lecture.id), topic: e.target.value } : { lecture: String(lecture.id) })}
            className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="">All topics in this lecture</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loadingQuizzes && <LoadingState message="Loading questions..." />}

      {!loadingQuizzes && quizzes.length === 0 && !error && (
        <EmptyState
          title="No quiz questions here yet"
          description={topic ? `Your teacher has not added questions for "${topic.title}".` : 'Your teacher has not added questions for this lecture.'}
          actionLabel="Watch the lecture"
          onAction={() => navigate(`/player/${lecture.id}`)}
        />
      )}

      {/* Summary after the last question */}
      {!loadingQuizzes && finished && (
        <div className="glass-card p-8 rounded-3xl border border-dark-border space-y-5 text-center">
          <div className="w-14 h-14 rounded-3xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white font-heading">
              {correctCount} / {results.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {Math.round((correctCount / results.length) * 100)}% correct on this attempt
            </div>
          </div>

          {hardTopics.length > 0 && (
            <div className="text-left space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase font-mono">Topics now rated difficult for you</div>
              {hardTopics.map(([topicId, r]) => (
                <div key={topicId} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border flex items-center justify-between gap-3">
                  <div className="text-xs text-white font-semibold">
                    {topicTitle(topicId)}
                    <span className="ml-2 text-[11px] font-mono text-amber-400">{r.difficulty_label} ({r.difficulty_score})</span>
                  </div>
                  <Link
                    to={`/revision?topic=${topicId}`}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-[11px] font-semibold text-purple-300 flex items-center gap-1 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Revision Kit
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={resetAttempt} className="px-4 py-2.5 text-xs font-bold text-slate-200 glass-card hover:bg-dark-hover rounded-xl border border-dark-border flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retake Quiz
            </button>
            <Link to="/student" className="gradient-btn px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center justify-center gap-2">
              View Updated Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {!loadingQuizzes && !finished && currentQuiz && (
        <div className="glass-card p-8 rounded-3xl border border-dark-border space-y-6">
          <div>
            <div className="text-[11px] font-mono text-brand-400 mb-2">{topicTitle(currentQuiz.topic_id)}</div>
            <h3 className="text-base font-bold text-white leading-relaxed">
              {currentQuiz.question}
            </h3>
          </div>

          <div className="space-y-3">
            {OPTION_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => !result && setSelectedOption(key)}
                disabled={!!result}
                className={`w-full text-left p-4 rounded-2xl border text-xs font-semibold transition-all ${optionStyle(key)}`}
              >
                <span className="font-mono mr-2">{key})</span>
                {currentQuiz[`option_${key.toLowerCase()}` as 'option_a']}
              </button>
            ))}
          </div>

          {!result ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption || submitting}
              className="w-full gradient-btn py-3 text-xs font-bold text-white rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Saving answer...' : 'Submit Answer'}</span>
            </button>
          ) : (
            <div className={`p-6 rounded-2xl border space-y-3 ${
              result.is_correct ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
            }`}>
              <div className="flex items-center space-x-2 font-bold text-sm">
                {result.is_correct ? (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" /> Correct Answer!
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-5 h-5" /> Incorrect — the correct answer is {result.correct_option}
                  </span>
                )}
              </div>

              {result.explanation && (
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Explanation:</strong> {result.explanation}
                </p>
              )}

              {result.difficulty_label && (
                <p className="text-[11px] text-slate-400 font-mono">
                  Topic quiz score: {result.topic_quiz_score}% · Topic difficulty now: {result.difficulty_label} ({result.difficulty_score}/100)
                </p>
              )}

              <button
                onClick={nextQuestion}
                className="w-full gradient-btn py-2.5 text-xs font-bold text-white rounded-xl flex items-center justify-center space-x-2"
              >
                <span>{currentIndex < quizzes.length - 1 ? 'Next Question' : 'See Results'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
