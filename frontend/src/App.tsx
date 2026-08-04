import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';

const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const CompletedProjects = lazy(() => import('./pages/CompletedProjects'));
const Team = lazy(() => import('./pages/Team'));
const Login = lazy(() => import('./pages/Login'));
const Messages = lazy(() => import('./pages/Messages'));
const DailyPlanner = lazy(() => import('./pages/DailyPlanner'));
const Ideas = lazy(() => import('./pages/Ideas'));
const DemoDashboard = lazy(() => import('./pages/DemoDashboard'));
const Workday = lazy(() => import('./pages/Workday'));
const AgentStudio = lazy(() => import('./pages/AgentStudio'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Reports = lazy(() => import('./pages/Reports'));

const Home = () => {
  const { isDemo } = useAuth();
  return isDemo ? <DemoDashboard /> : <Workday />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading page"><div className="skeleton"/></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Dedicated Super Admin entry point, reusing the exact same login
              flow/JWT - see plan Design Decision 7. */}
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="completed" element={<CompletedProjects />} />
            <Route path="team" element={<Team />} />
            <Route path="messages" element={<Messages />} />
            <Route path="daily-todo" element={<DailyPlanner />} />
            <Route path="workday" element={<Workday />} />
            <Route path="ideas" element={<Ideas />} />
            <Route path="agents" element={<AgentStudio />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="*" element={<div>Page Not Found</div>} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
