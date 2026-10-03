import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { courseApi, getErrorMessage } from '../services/api';
import { Course } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { BookOpen, Plus, Video, Trash2, Play, HelpCircle, AlertCircle, Settings } from 'lucide-react';

export const CoursePage: React.FC = () => {
  const { user, role } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');

  const isStaff = role === 'teacher' || role === 'admin';
  const canManage = (course: Course) => role === 'admin' || (role === 'teacher' && course.teacher_id === user?.id);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await courseApi.getCourses();
      setCourses(res);
    } catch (err) {
      console.error("Course fetch error:", err);
      setError(getErrorMessage(err, "Could not load the course catalog."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await courseApi.createCourse(title, code, desc);
      setShowModal(false);
      setTitle('');
      setCode('');
      setDesc('');
      fetchCourses();
    } catch (err) {
      console.error("Create course error:", err);
      setError(getErrorMessage(err, "Could not create the course."));
      setShowModal(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!confirm(`Delete "${course.title}" and all of its lectures, topics and quizzes?`)) return;
    setError(null);
    try {
      await courseApi.deleteCourse(course.id);
      fetchCourses();
    } catch (err) {
      console.error("Delete course error:", err);
      setError(getErrorMessage(err, "Could not delete the course."));
    }
  };

  if (loading) return <LoadingState message="Loading course catalog from database..." />;

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-3xl border border-dark-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-400" />
            {isStaff ? 'Course Catalog & Curriculum Management' : 'Course Catalog'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isStaff
              ? 'Create courses, then add lectures, topics and quizzes to them.'
              : 'Pick a lecture to watch, then take its topic quizzes.'}
          </p>
        </div>

        {isStaff && (
          <button
            onClick={() => setShowModal(true)}
            className="gradient-btn px-4 py-2.5 text-xs font-bold text-white rounded-xl flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Modal for creating a course */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-3xl border border-dark-border w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200"
                  placeholder="Deep Learning & Vision"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200"
                  placeholder="CS401"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs text-slate-200"
                  placeholder="Course overview and objectives..."
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl">
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {courses.length === 0 && (
        <EmptyState
          title="No courses yet"
          description={isStaff ? 'Create your first course to start adding lectures.' : 'No course has been published yet.'}
        />
      )}

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((c) => {
          const lectures = c.lectures || [];
          return (
            <div key={c.id} className="glass-card p-6 rounded-3xl border border-dark-border space-y-4 flex flex-col">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30">
                    {c.course_code}
                  </span>
                  {canManage(c) && (
                    <div className="flex items-center gap-1">
                      <Link to={`/lectures?course=${c.id}`} className="text-slate-400 hover:text-brand-400 p-1" title="Manage lectures & topics">
                        <Settings className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDeleteCourse(c)} className="text-slate-400 hover:text-rose-400 p-1" title="Delete course">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white font-heading">{c.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{c.description || "No description provided."}</p>
              </div>

              <div className="pt-4 border-t border-dark-border space-y-2 flex-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-purple-400" />
                  <span>{lectures.length} {lectures.length === 1 ? 'Lecture' : 'Lectures'}</span>
                </div>

                {lectures.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No lectures have been added to this course yet.</p>
                ) : (
                  lectures.map((l) => (
                    <div key={l.id} className="p-3 rounded-xl bg-dark-bg/60 border border-dark-border flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{l.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {Math.round(l.duration_seconds / 60)} min · {(l.topics || []).length} topics
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {role === 'student' && (l.topics || []).length > 0 && (
                          <Link
                            to={`/quiz?lecture=${l.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <HelpCircle className="w-3.5 h-3.5" /> Quiz
                          </Link>
                        )}
                        <Link
                          to={`/player/${l.id}`}
                          className="gradient-btn px-2.5 py-1.5 text-[11px] font-bold text-white rounded-lg flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5" /> {role === 'student' ? 'Watch' : 'Preview'}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
