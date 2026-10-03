import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { courseApi } from '../services/api';
import { Course, Lecture } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { InteractiveVideoPlayer } from '../components/video/InteractiveVideoPlayer';
import { Video, HelpCircle } from 'lucide-react';

export const LecturePage: React.FC = () => {
  const navigate = useNavigate();
  const { lectureId } = useParams<{ lectureId?: string }>();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        setCourses(await courseApi.getCourses());
      } catch (err) {
        console.error("Lecture load error:", err);
        setError("Could not load lectures from the server.");
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, []);

  if (loading) return <LoadingState message="Loading lecture and topic timeline..." />;
  if (error) return <EmptyState title="Lecture unavailable" description={error} />;

  const allLectures: (Lecture & { course: Course })[] = courses.flatMap((c) =>
    (c.lectures || []).map((l) => ({ ...l, course: c }))
  );

  if (allLectures.length === 0) {
    return (
      <EmptyState
        title="No lectures yet"
        description="No lecture has been published in any course yet."
        actionLabel="Browse courses"
        onAction={() => navigate('/courses')}
      />
    );
  }

  const lecture = lectureId ? allLectures.find((l) => l.id === Number(lectureId)) : allLectures[0];

  if (!lecture) {
    return (
      <EmptyState
        title="Lecture not found"
        description={`Lecture #${lectureId} does not exist or has been removed.`}
        actionLabel="Browse courses"
        onAction={() => navigate('/courses')}
      />
    );
  }

  const topics = [...(lecture.topics || [])].sort((a, b) => a.start_time - b.start_time);
  const isStudent = user?.role === 'student';
  const trackEngagement = isStudent && !!user?.camera_consent;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <div className="text-[11px] font-mono text-brand-400 mb-1">
            <Link to="/courses" className="hover:underline">{lecture.course.course_code}</Link> · {lecture.course.title}
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading flex items-center gap-2">
            <Video className="w-6 h-6 text-brand-400" />
            {lecture.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {trackEngagement
              ? "Camera engagement tracking is on. Facial landmarks are processed in your browser's memory only."
              : isStudent
                ? "Camera engagement tracking is off for your account."
                : "Preview mode: your activity on this page is not recorded."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={lecture.id}
            onChange={(e) => navigate(`/player/${e.target.value}`)}
            className="bg-dark-card text-xs text-slate-200 border border-dark-border rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 max-w-[220px]"
          >
            {allLectures.map((l) => (
              <option key={l.id} value={l.id}>{l.course.course_code} — {l.title}</option>
            ))}
          </select>

          {isStudent && (
            <button
              onClick={() => navigate(`/quiz?lecture=${lecture.id}`)}
              className="gradient-btn px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center space-x-2 shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Take Lecture Quiz</span>
            </button>
          )}
        </div>
      </div>

      {/* key: a different lecture gets a fresh player (and a fresh camera aggregation window) */}
      <InteractiveVideoPlayer
        key={lecture.id}
        lectureId={lecture.id}
        videoUrl={lecture.video_url}
        topics={topics}
        recordActivity={isStudent}
        trackEngagement={trackEngagement}
        cameraDisabledReason={isStudent ? 'no_consent' : 'not_student'}
        onQuizTrigger={isStudent ? (topicId) => navigate(`/quiz?lecture=${lecture.id}&topic=${topicId}`) : undefined}
      />
    </div>
  );
};
