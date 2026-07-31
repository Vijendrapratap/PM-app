import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive, Bot, FolderKanban, LayoutDashboard, Lightbulb, ListChecks,
  LogOut, Megaphone, Target, Users, Waypoints,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isLead, isSuperAdmin } from '../utils/roles';
import { workdayApi } from '../api/workdayApi';

const Sidebar = () => {
  const { user, logout, isDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    if (!isDemo) {
      try {
        const workday = await workdayApi.today();
        if (workday?.status === 'Open') {
          navigate('/workday?closeout=1');
          return;
        }
      } catch {
        // Do not trap someone in the app if the closeout check is unavailable.
      }
    }
    logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) => `rail-link ${isActive ? 'active' : ''}`;
  const workdayView = new URLSearchParams(location.search).get('view');
  const canCoordinate = canApproveAgentWork(user?.role) || isLead(user?.role);

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <NavLink to="/" className="sidebar-logo" aria-label="Pratap AI dashboard">
        <span className="sidebar-logo-icon"><img src="/brand/pratap-ai-mark.png" alt="" /></span>
        <span className="rail-tooltip">Pratap AI</span>
      </NavLink>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Workspace</span>
        <NavLink to="/" end className={linkClass} aria-label="Home"><LayoutDashboard size={19}/><span className="rail-tooltip">Home</span></NavLink>
        <NavLink to="/projects" className={linkClass} aria-label="Projects"><FolderKanban size={19}/><span className="rail-tooltip">Projects</span></NavLink>
        <NavLink to="/workday" className={() => `rail-link ${location.pathname === '/workday' && workdayView !== 'team' ? 'active' : ''}`} aria-label="My workday"><Target size={19}/><span className="rail-tooltip">My workday</span></NavLink>
        <NavLink to="/daily-todo" className={linkClass} aria-label="Daily tasks"><ListChecks size={19}/><span className="rail-tooltip">Daily tasks</span></NavLink>

        <span className="sidebar-section-label">{canCoordinate ? 'Company' : 'Explore'}</span>
        {canCoordinate && <NavLink to="/team" className={linkClass} aria-label="Team"><Users size={19}/><span className="rail-tooltip">Team</span></NavLink>}
        {canCoordinate && <NavLink to="/workday?view=team" className={() => `rail-link ${location.pathname === '/workday' && workdayView === 'team' ? 'active' : ''}`} aria-label="Team pulse"><Waypoints size={19}/><span className="rail-tooltip">Team pulse</span></NavLink>}
        <NavLink to="/ideas" className={linkClass} aria-label="Idea bucket"><Lightbulb size={19}/><span className="rail-tooltip">Idea bucket</span></NavLink>
        {canCoordinate && <NavLink to="/agents" className={linkClass} aria-label="Agent Studio"><Bot size={19}/><span className="rail-tooltip">Agent Studio</span></NavLink>}
        <NavLink to="/completed" className={linkClass} aria-label="Completed projects"><Archive size={19}/><span className="rail-tooltip">Completed</span></NavLink>
        {isSuperAdmin(user?.role) && <NavLink to="/messages" className={linkClass} aria-label="Important messages"><Megaphone size={19}/><span className="rail-tooltip">Messages</span></NavLink>}
      </nav>

      <div className="sidebar-footer">
        <div className="rail-user" aria-label={`${user?.name || 'User'}, ${user?.role || ''}`}>
          <span className="rail-user-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
          <span className="rail-tooltip">{user?.name || 'Account'} · {user?.role || ''}</span>
        </div>
        <button onClick={handleSignOut} className="rail-link rail-signout" aria-label="Sign out"><LogOut size={18}/><span className="rail-tooltip">Sign out</span></button>
      </div>
    </aside>
  );
};

export default Sidebar;
