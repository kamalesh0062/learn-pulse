export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  enrollment_no?: string | null;
  camera_consent: boolean;
  created_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Topic {
  id: number;
  lecture_id: number;
  title: string;
  start_time: number;
  end_time: number;
  description?: string;
}

export interface Lecture {
  id: number;
  course_id: number;
  title: string;
  video_url: string;
  duration_seconds: number;
  created_at?: string;
  topics?: Topic[];
}

export interface Course {
  id: number;
  teacher_id: number;
  title: string;
  course_code: string;
  description?: string;
  created_at?: string;
  lectures?: Lecture[];
}

export interface Quiz {
  id: number;
  topic_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  /** Only present for teachers and admins; students receive it after submitting. */
  correct_option?: string | null;
  explanation?: string | null;
}

export type QuizInput = Omit<Quiz, 'id' | 'correct_option'> & { correct_option: string };

export interface QuizResult {
  quiz_id: number;
  is_correct: boolean;
  score: number;
  correct_option: string;
  explanation?: string | null;
  topic_quiz_score?: number | null;
  difficulty_score?: number | null;
  difficulty_label?: DifficultyLabel | null;
}

export type DifficultyLabel = 'Easy' | 'Moderate' | 'Difficult' | 'Very Difficult';

export interface DifficultTopic {
  topic_id: number;
  lecture_id: number;
  topic_title: string;
  lecture_title?: string | null;
  difficulty_score: number;
  difficulty_label: DifficultyLabel;
  color: string;
  /** null means the signal has not been observed yet (e.g. no quiz attempt, camera off). */
  quiz_score: number | null;
  engagement_score: number | null;
  replay_count: number;
  pause_count: number;
  watch_time_ratio: number | null;
  calculated_at?: string | null;
}

export interface EngagementPoint {
  time: string;
  score: number;
  focus_state: string;
  samples: number;
}

export interface StudentAnalytics {
  student_id: number;
  student_name?: string | null;
  overall_learning_score: number | null;
  engagement_score: number | null;
  quiz_average: number | null;
  quizzes_answered: number;
  engagement_samples: number;
  course_progress: number;
  study_streak_days: number;
  difficult_topics: DifficultTopic[];
  focus_topic: DifficultTopic | null;
  engagement_timeline: {
    lecture_id: number | null;
    lecture_title: string | null;
    points: EngagementPoint[];
  };
  recommendation: string;
}

export interface TopicSummary {
  topic_id: number;
  topic_title: string;
  start_time: number;
  end_time: number;
  avg_difficulty: number | null;
  avg_engagement: number | null;
  avg_quiz_score: number | null;
  total_replays: number;
  total_pauses: number;
  student_count: number;
  quiz_count: number;
}

export interface AtRiskStudent {
  student_id: number;
  name: string;
  avg_difficulty: number | null;
  engagement: number | null;
  difficult_topics: string[];
  reasons: string[];
}

export interface LectureOption {
  id: number;
  title: string;
  course_id: number;
  course_title: string | null;
}

export interface TeacherAnalytics {
  lectures: LectureOption[];
  lecture: { id: number; title: string; course_id: number } | null;
  total_students: number;
  active_students: number;
  total_courses: number;
  average_engagement: number | null;
  average_quiz_score: number | null;
  hardest_topic: string | null;
  students_at_risk_count: number;
  students_at_risk: AtRiskStudent[];
  state_breakdown: Record<string, number>;
  engagement_alert: {
    title: string;
    lecture: string;
    topic: string | null;
    drop_percentage: number;
    message: string;
  } | null;
  topic_summaries: TopicSummary[];
}

export interface RosterStudent {
  student_id: number;
  name: string;
  email: string;
  enrollment_no: string | null;
  topics_tracked: number;
  avg_difficulty: number | null;
  engagement: number | null;
  difficult_topic_count: number;
}

export interface SystemStatus {
  status: string;
  version: string;
  database: {
    path: string;
    size_kb: number;
    teacher_count: number;
    student_count: number;
    admin_count: number;
    course_count: number;
    lecture_count: number;
    topic_count: number;
    quiz_count: number;
    engagement_logs: number;
  };
  ml_engine: {
    model_path: string;
    model_file_exists: boolean;
    model_loaded: boolean;
    classifier: string;
    cv_detector: string;
    server_mediapipe_available: boolean;
  };
  ai_provider: {
    gemini_active: boolean;
    openai_active: boolean;
    active_provider: 'gemini' | 'openai' | 'local';
    fallback_active: boolean;
  };
  audit_logs: { id: number; user_id: number | null; action: string; details: string; timestamp: string | null }[];
}

export interface RevisionKit {
  topic_id: number | null;
  topic_title: string;
  course_title: string;
  source: 'gemini' | 'openai' | 'local';
  summary: string;
  key_takeaways: string[];
  flashcards: { id: number; question: string; answer: string }[];
  practice_questions: {
    id: number;
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  }[];
}

export interface AppNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string | null;
}
