import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, RoleRoute, GuestRoute, ScrollToTop, PageSkeleton } from './components';
import { AppLayout, AdminLayout, AuthLayout } from './layouts';

const page = (loader) => lazy(loader);
const Landing = page(() => import('./pages/Landing.jsx'));
const Login = page(() => import('./pages/Login.jsx'));
const Register = page(() => import('./pages/Register.jsx'));
const ForgotPassword = page(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = page(() => import('./pages/ResetPassword.jsx'));
const Dashboard = page(() => import('./pages/Dashboard.jsx'));
const ProfileSetup = page(() => import('./pages/ProfileSetup.jsx'));
const AIStudio = page(() => import('./pages/AIStudio.jsx'));
const AIAssistant = page(() => import('./pages/AIAssistant.jsx'));
const Trends = page(() => import('./pages/Trends.jsx'));
const ContentAnalyzer = page(() => import('./pages/ContentAnalyzer.jsx'));
const Content = page(() => import('./pages/Content.jsx'));
const Calendar = page(() => import('./pages/Calendar.jsx'));
const Analytics = page(() => import('./pages/Analytics.jsx'));
const CompetitorAnalysis = page(() => import('./pages/CompetitorAnalysis.jsx'));
const LongToShort = page(() => import('./pages/LongToShort.jsx'));
const EditorDirectory = page(() => import('./pages/EditorDirectory.jsx'));
const Profile = page(() => import('./pages/Profile.jsx'));
const Settings = page(() => import('./pages/Settings.jsx'));
const EditorProfile = page(() => import('./pages/EditorProfile.jsx'));
const NotFound = page(() => import('./pages/NotFound.jsx'));
const AdminOverview = page(() => import('./pages/admin/AdminOverview.jsx'));
const AdminUsers = page(() => import('./pages/admin/AdminUsers.jsx'));
const AdminCreators = page(() => import('./pages/admin/AdminCreators.jsx'));
const AdminEditors = page(() => import('./pages/admin/AdminEditors.jsx'));
const AdminCategories = page(() => import('./pages/admin/AdminCategories.jsx'));
const AdminTrends = page(() => import('./pages/admin/AdminTrends.jsx'));
const AdminContent = page(() => import('./pages/admin/AdminContent.jsx'));
const AdminReports = page(() => import('./pages/admin/AdminReports.jsx'));
const AdminAIUsage = page(() => import('./pages/admin/AdminAIUsage.jsx'));
const AdminSettings = page(() => import('./pages/admin/AdminSettings.jsx'));

const CREATOR = ['creator'];
const creatorOnly = (el) => <RoleRoute roles={CREATOR}>{el}</RoleRoute>;

/** All routes (contract section 7). Pages are lazy; layouts provide the Suspense fallback inside the shell. */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="page"><PageSkeleton /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route element={<AuthLayout />}><Route path="/reset-password" element={<ResetPassword />} /></Route>

          <Route path="/app" element={<ProtectedRoute><RoleRoute roles={['creator', 'editor']}><AppLayout /></RoleRoute></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={creatorOnly(<Dashboard />)} />
            <Route path="studio" element={creatorOnly(<AIStudio />)} />
            <Route path="assistant" element={creatorOnly(<AIAssistant />)} />
            <Route path="trends" element={creatorOnly(<Trends />)} />
            <Route path="analyzer" element={creatorOnly(<ContentAnalyzer />)} />
            <Route path="content" element={creatorOnly(<Content />)} />
            <Route path="calendar" element={creatorOnly(<Calendar />)} />
            <Route path="analytics" element={creatorOnly(<Analytics />)} />
            <Route path="competitors" element={creatorOnly(<CompetitorAnalysis />)} />
            <Route path="long-to-short" element={creatorOnly(<LongToShort />)} />
            <Route path="editors" element={<EditorDirectory />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/setup" element={creatorOnly(<ProfileSetup />)} />
            <Route path="settings" element={<Settings />} />
            <Route path="editor-profile" element={<RoleRoute roles={['editor']}><EditorProfile /></RoleRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/admin" element={<ProtectedRoute><RoleRoute roles={['admin']}><AdminLayout /></RoleRoute></ProtectedRoute>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="creators" element={<AdminCreators />} />
            <Route path="editors" element={<AdminEditors />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="trends" element={<AdminTrends />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="ai-usage" element={<AdminAIUsage />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
