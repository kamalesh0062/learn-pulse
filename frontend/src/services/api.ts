import axios from 'axios';
import {
  AuthResponse, User, Course, Lecture, Topic, Quiz, QuizInput, QuizResult,
  StudentAnalytics, TeacherAnalytics, RosterStudent, SystemStatus, RevisionKit,
  DifficultTopic, AppNotification, UserRole
} from '../types';

const API_BASE_URL = '/api';
export const TOKEN_KEY = 'learnpulse_token';
/** Fired when the backend rejects the stored token, so AuthContext can sign the user out. */
export const UNAUTHORIZED_EVENT = 'learnpulse:unauthorized';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Bearer Token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from a FastAPI error response. */
export const getErrorMessage = (err: any, fallback = 'Something went wrong. Please try again.'): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the LearnPulse backend. Is the API server running?';
  return fallback;
};

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (name: string, email: string, password: string, role: string, extra_info?: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/register', {
      name,
      email,
      password,
      role,
      department: role === 'teacher' ? extra_info || undefined : undefined,
      enrollment_no: role === 'student' ? extra_info || undefined : undefined
    });
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updateMe: async (data: { name?: string; email?: string; password?: string; department?: string; camera_consent?: boolean }): Promise<User> => {
    const res = await api.put('/auth/me', data);
    return res.data;
  }
};

export const courseApi = {
  getCourses: async (): Promise<Course[]> => {
    const res = await api.get('/courses');
    return res.data;
  },
  getCourse: async (id: number): Promise<Course> => {
    const res = await api.get(`/courses/${id}`);
    return res.data;
  },
  createCourse: async (title: string, course_code: string, description: string): Promise<Course> => {
    const res = await api.post('/courses', { title, course_code, description });
    return res.data;
  },
  deleteCourse: async (id: number): Promise<void> => {
    await api.delete(`/courses/${id}`);
  }
};

export const lectureApi = {
  getLectures: async (courseId?: number): Promise<Lecture[]> => {
    const res = await api.get('/lectures', { params: { course_id: courseId } });
    return res.data;
  },
  getLecture: async (id: number): Promise<Lecture> => {
    const res = await api.get(`/lectures/${id}`);
    return res.data;
  },
  createLecture: async (course_id: number, title: string, video_url: string, duration_seconds: number): Promise<Lecture> => {
    const res = await api.post('/lectures', { course_id, title, video_url, duration_seconds });
    return res.data;
  },
  deleteLecture: async (id: number): Promise<void> => {
    await api.delete(`/lectures/${id}`);
  }
};

export const topicApi = {
  getTopics: async (lectureId: number): Promise<Topic[]> => {
    const res = await api.get('/topics', { params: { lecture_id: lectureId } });
    return res.data;
  },
  createTopic: async (lecture_id: number, title: string, start_time: number, end_time: number, description?: string): Promise<Topic> => {
    const res = await api.post('/topics', { lecture_id, title, start_time, end_time, description });
    return res.data;
  },
  deleteTopic: async (id: number): Promise<void> => {
    await api.delete(`/topics/${id}`);
  }
};

export const quizApi = {
  getQuizzes: async (params: { topicId?: number; lectureId?: number }): Promise<Quiz[]> => {
    const res = await api.get('/quizzes', { params: { topic_id: params.topicId, lecture_id: params.lectureId } });
    return res.data;
  },
  createQuiz: async (data: QuizInput): Promise<Quiz> => {
    const res = await api.post('/quizzes', data);
    return res.data;
  },
  updateQuiz: async (id: number, data: Omit<QuizInput, 'topic_id'>): Promise<Quiz> => {
    const res = await api.put(`/quizzes/${id}`, data);
    return res.data;
  },
  deleteQuiz: async (id: number): Promise<void> => {
    await api.delete(`/quizzes/${id}`);
  },
  submitAnswer: async (quiz_id: number, selected_option: string): Promise<QuizResult> => {
    const res = await api.post('/quizzes/submit', { quiz_id, selected_option });
    return res.data;
  }
};

export const engagementApi = {
  postEvent: async (payload: {
    lecture_id: number;
    topic_id?: number;
    timestamp?: string;
    timestamp_seconds?: number;
    state: string;
    confidence: number;
    metrics?: {
      pitch: number;
      yaw: number;
      roll: number;
      ear: number;
      gaze_offset: number;
      face_detected?: boolean;
    }
  }) => {
    const res = await api.post('/engagement/events', payload);
    return res.data;
  },
  predict: async (metrics: {
    pitch: number;
    yaw: number;
    roll: number;
    ear: number;
    gaze_offset: number;
    face_detected?: boolean;
  }) => {
    const res = await api.post('/engagement/predict', metrics);
    return res.data;
  },
  logVideoEvent: async (lecture_id: number, event_type: string, position_seconds: number) => {
    const res = await api.post('/engagement/events/video', {
      lecture_id,
      event_type,
      position_seconds: Math.max(0, Math.floor(position_seconds))
    });
    return res.data;
  }
};

export const analyticsApi = {
  getStudentAnalytics: async (studentId?: number): Promise<StudentAnalytics> => {
    const res = await api.get('/analytics/student', { params: { student_id: studentId } });
    return res.data;
  },
  getTeacherAnalytics: async (lectureId?: number): Promise<TeacherAnalytics> => {
    const res = await api.get('/analytics/teacher', { params: { lecture_id: lectureId } });
    return res.data;
  },
  getStudentRoster: async (): Promise<RosterStudent[]> => {
    const res = await api.get('/analytics/students');
    return res.data;
  }
};

export const difficultyApi = {
  getMyTopics: async (): Promise<DifficultTopic[]> => {
    const res = await api.get('/difficulty/topics');
    return res.data;
  }
};

export const revisionApi = {
  generateKit: async (params: { topicId?: number; topicTitle?: string; courseTitle?: string }): Promise<RevisionKit> => {
    const res = await api.post('/revision/generate', {
      topic_id: params.topicId,
      topic_title: params.topicTitle,
      course_title: params.courseTitle
    });
    return res.data.revision_kit;
  }
};

export const reportApi = {
  /** Fetches the PDF with the Authorization header (never puts the token in a URL) and saves it. */
  downloadReport: async (studentId?: number): Promise<void> => {
    const res = await api.get('/reports/download', { params: { student_id: studentId }, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `LearnPulse_Report${studentId ? `_${studentId}` : ''}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};

export const notificationApi = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const res = await api.get('/notifications');
    return res.data;
  },
  markRead: async (id: number): Promise<void> => {
    await api.post(`/notifications/${id}/read`);
  },
  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/read-all');
  }
};

export const adminApi = {
  getStatus: async (): Promise<SystemStatus> => {
    const res = await api.get('/admin/status');
    return res.data;
  },
  getUsers: async (): Promise<User[]> => {
    const res = await api.get('/users');
    return res.data;
  },
  updateUserRole: async (id: number, role: UserRole): Promise<User> => {
    const res = await api.put(`/users/${id}/role`, { role });
    return res.data;
  },
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  }
};

export default api;
