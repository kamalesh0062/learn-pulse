import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, homePathForRole } from './contexts/AuthContext';
import { UserRole } from './types';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { Footer } from './components/common/Footer';
import { LoadingState } from './components/common/LoadingState';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { UsersPage } from './pages/UsersPage';
import { CoursePage } from './pages/CoursePage';
import { LecturePage } from './pages/LecturePage';
import { LectureManagerPage } from './pages/LectureManagerPage';
import { QuizPage } from './pages/QuizPage';
import { QuizBuilderPage } from './pages/QuizBuilderPage';
import { RevisionPage } from './pages/RevisionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AdminVisionDebug } from './pages/AdminVisionDebug';
import { StandaloneVisionTest } from './pages/StandaloneVisionTest';

const queryClient = new QueryClient();

/** Requires a signed-in user, optionally with one of the given roles. */
const RequireAuth: React.FC<{ roles?: UserRole[]; children: React.ReactElement }> = ({ roles, children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState message="Restoring your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;
  return children;
};

/** Login/register are only for signed-out visitors. */
const GuestOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState message="Restoring your session..." />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return children;
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const isLandingPage = ['/', '/landing'].includes(location.pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col justify-between">
      <div>
        <Navbar />
        {isLandingPage ? (
          <div>{children}</div>
        ) : (
          <div className="max-w-7xl mx-auto flex">
            {isAuthenticated && <Sidebar />}
            <main className="flex-1 p-6 overflow-x-hidden min-h-[calc(100vh-4rem)]">
              {children}
            </main>
          </div>
        )}
      </div>
      {!isLandingPage && <Footer />}
    </div>
  );
};

const STAFF: UserRole[] = ['teacher', 'admin'];

export const AppRoutes: React.FC = () => {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

        {/* Student portal */}
        <Route path="/student" element={<RequireAuth roles={['student']}><StudentDashboard /></RequireAuth>} />
        <Route path="/revision" element={<RequireAuth roles={['student']}><RevisionPage /></RequireAuth>} />
        <Route path="/quiz" element={<RequireAuth roles={['student']}><QuizPage /></RequireAuth>} />

        {/* Teacher portal */}
        <Route path="/teacher" element={<RequireAuth roles={STAFF}><TeacherDashboard /></RequireAuth>} />
        <Route path="/lectures" element={<RequireAuth roles={STAFF}><LectureManagerPage /></RequireAuth>} />
        <Route path="/quiz-management" element={<RequireAuth roles={STAFF}><QuizBuilderPage /></RequireAuth>} />

        {/* Admin portal */}
        <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminDashboard /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth roles={['admin']}><UsersPage /></RequireAuth>} />
        <Route path="/admin/vision-debug" element={<RequireAuth roles={['admin']}><AdminVisionDebug /></RequireAuth>} />

        {/* Shared, signed-in */}
        <Route path="/courses" element={<RequireAuth><CoursePage /></RequireAuth>} />
        <Route path="/player" element={<RequireAuth><LecturePage /></RequireAuth>} />
        <Route path="/player/:lectureId" element={<RequireAuth><LecturePage /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/vision-test" element={<RequireAuth><StandaloneVisionTest /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
