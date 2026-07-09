import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import CompletedProjects from './pages/CompletedProjects';
import Team from './pages/Team';
import Login from './pages/Login';
import Register from './pages/Register';
import Messages from './pages/Messages';
import DailyPlanner from './pages/DailyPlanner';
import Ideas from './pages/Ideas';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Dedicated Super Admin entry point, reusing the exact same login
              flow/JWT - see plan Design Decision 7. */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="completed" element={<CompletedProjects />} />
            <Route path="team" element={<Team />} />
            <Route path="messages" element={<Messages />} />
            <Route path="daily-todo" element={<DailyPlanner />} />
            <Route path="ideas" element={<Ideas />} />
            <Route path="*" element={<div>Page Not Found</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
