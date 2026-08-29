import { NavLink, useNavigate } from 'react-router-dom';
import {
  Archive, BarChart3, Bell, Bot, CalendarCheck2, CalendarRange, CheckSquare2, FolderKanban,
  Lightbulb, Link2, LogOut, MessageSquareText, Target, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canApproveAgentWork, isLead, isSuperAdmin } from '../utils/roles';

const Sidebar = () => {
  const { user, logout, isDemo } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handlePlanMyDay = () => {
    const request = Date.now();
    navigate(isDemo ? `/?plan=${request}` : `/workday?start=${request}`);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) => `rail-link ${isActive ? 'active' : ''}`;
  const canCoordinate = canApproveAgentWork(user?.role) || isLead(user?.role);
  const isTeamMember = user?.platformRole === 'TEAM_MEMBER' || user?.role === 'Team Member';
  const isCEO = isSuperAdmin(user?.platformRole || user?.role);

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <NavLink to="/" className="sidebar-logo" aria-label="Pratap AI dashboard">
        <span className="sidebar-logo-icon"><img src="/brand/pratap-ai-mark.png" alt="" /></span>
        <span className="rail-tooltip">Pratap AI</span>
      </NavLink>

      {!isCEO && <button type="button" onClick={handlePlanMyDay} className="sidebar-plan-cta" aria-label="Start my day">
        <span className="sidebar-plan-icon"><CalendarCheck2 size={18}/></span>
        <span className="sidebar-plan-copy"><strong>Start my day</strong><small>Choose assigned work</small></span>
      </button>}

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Daily work</span>
        <NavLink to="/" end className={linkClass} aria-label="Home"><Target size={19}/><span className="rail-tooltip">Home</span></NavLink>
        {!isCEO && <NavLink to="/workday?history=1" className={linkClass} aria-label="Work history"><CalendarRange size={19}/><span className="rail-tooltip">Work history</span></NavLink>}
        <NavLink to="/daily-todo" className={linkClass} aria-label="Tasks"><CheckSquare2 size={19}/><span className="rail-tooltip">Tasks</span></NavLink>

        <span className="sidebar-section-label">Projects &amp; ideas</span>
        <NavLink to="/projects" className={linkClass} aria-label={isTeamMember ? 'My Projects' : 'Projects'}><FolderKanban size={19}/><span className="rail-tooltip">{isTeamMember ? 'My Projects' : 'Projects'}</span></NavLink>
        <NavLink to="/documents-links" className={linkClass} aria-label="Documents and Links"><Link2 size={19}/><span className="rail-tooltip">Documents &amp; Links</span></NavLink>
        <NavLink to="/completed" className={linkClass} aria-label="Completed projects"><Archive size={19}/><span className="rail-tooltip">Completed projects</span></NavLink>
        <NavLink to="/ideas" className={linkClass} aria-label="Idea bucket"><Lightbulb size={19}/><span className="rail-tooltip">Idea bucket</span></NavLink>

        <span className="sidebar-section-label">{canCoordinate ? 'Organization' : 'Workspace'}</span>
        {canCoordinate && <NavLink to="/team" className={linkClass} aria-label="Team"><Users size={19}/><span className="rail-tooltip">Team</span></NavLink>}
        <NavLink to="/reports" className={linkClass} aria-label="Reports"><BarChart3 size={19}/><span className="rail-tooltip">{isTeamMember ? 'My reports' : 'Reports'}</span></NavLink>
        {canCoordinate && <NavLink to="/agents" className={linkClass} aria-label="AI workspace"><Bot size={19}/><span className="rail-tooltip">AI workspace</span></NavLink>}
        {isCEO && <NavLink to="/messages" className={linkClass} aria-label="Team messages"><MessageSquareText size={19}/><span className="rail-tooltip">Team messages</span></NavLink>}
        <NavLink to="/notifications" className={linkClass} aria-label="Notifications"><Bell size={19}/><span className="rail-tooltip">Notifications</span></NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="rail-user" aria-label={`${user?.name || 'User'}, ${user?.role || ''}`}>
          <span className="rail-user-avatar">{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</span>
          <span className="rail-tooltip">{user?.name || 'Account'} · {user?.role || ''}{user?.department ? ` · ${user.department}` : ''}</span>
        </div>
        <button onClick={handleSignOut} className="rail-link rail-signout" aria-label="Sign out"><LogOut size={18}/><span className="rail-tooltip">Sign out</span></button>
      </div>
    </aside>
  );
};

export default Sidebar;
