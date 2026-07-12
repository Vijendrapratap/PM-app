import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CheckCircle2, Users, LogOut, Megaphone, ListChecks, Lightbulb, ChevronDown, ChevronRight, Clock3, Layers3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';
import { useProjects } from '../hooks/useProjects';
import { useTeam } from '../hooks/useTeam';
import { getProjectPortfolio, PROJECT_PORTFOLIOS } from '../utils/projectTaxonomy';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects } = useProjects();
  const { members } = useTeam();
  const [projectsOpen, setProjectsOpen] = useState(location.pathname.startsWith('/projects'));
  const [teamOpen, setTeamOpen] = useState(location.pathname.startsWith('/team'));
  const portfolioCounts = useMemo(() => Object.fromEntries(PROJECT_PORTFOLIOS.map((portfolio) => [portfolio, projects.filter((project) => !project.archived && project.status !== 'Completed' && getProjectPortfolio(project) === portfolio).length])), [projects]);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><img src="/brand/pratap-ai-mark.png" alt="Pratap AI" /></div>
        <div>
          <div className="sidebar-logo-text">PRATAP AI</div>
          <div className="sidebar-logo-sub">Operations Studio</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main</div>

        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard className="nav-link-icon" size={18} />
          <span>Dashboard</span>
        </NavLink>

        <div className="nav-tree">
          <div className={`nav-link nav-parent ${location.pathname.startsWith('/projects') ? 'active' : ''}`}>
            <NavLink to="/projects" className="nav-parent-link"><FolderKanban className="nav-link-icon" size={17} /><span>Projects</span><span className="nav-count">{projects.filter((p) => !p.archived && p.status !== 'Completed').length}</span></NavLink>
            <button className="nav-expand" aria-label="Expand projects" aria-expanded={projectsOpen} onClick={() => setProjectsOpen((value) => !value)}>{projectsOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
          </div>
          {projectsOpen && <div className="nav-children">
            {PROJECT_PORTFOLIOS.map((portfolio) => <NavLink key={portfolio} to={`/projects?portfolio=${encodeURIComponent(portfolio)}`}><Layers3 size={12}/><span>{portfolio}</span><small>{portfolioCounts[portfolio]}</small></NavLink>)}
            <NavLink to="/completed"><CheckCircle2 size={12}/><span>Completed</span></NavLink>
          </div>}
        </div>

        <NavLink to="/daily-todo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <ListChecks className="nav-link-icon" size={18} />
          <span>Daily To-Do</span>
        </NavLink>

        <NavLink to="/ideas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Lightbulb className="nav-link-icon" size={18} />
          <span>Ideas</span>
        </NavLink>

        <div className="sidebar-section-label">People</div>

        <div className="nav-tree">
          <div className={`nav-link nav-parent ${location.pathname.startsWith('/team') ? 'active' : ''}`}>
            <NavLink to="/team" className="nav-parent-link"><Users className="nav-link-icon" size={17}/><span>Team</span><span className="nav-count">{members.length}</span></NavLink>
            <button className="nav-expand" aria-label="Expand team" aria-expanded={teamOpen} onClick={() => setTeamOpen((value) => !value)}>{teamOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
          </div>
          {teamOpen && <div className="nav-children">
            {members.slice(0, 5).map((member) => <NavLink key={member._id} to={`/team?member=${member._id}`}><span className="nav-person-dot">{member.name.charAt(0)}</span><span>{member.name}</span></NavLink>)}
            <NavLink to="/daily-todo"><ListChecks size={12}/><span>Team tasks</span></NavLink>
          </div>}
        </div>

        <div className="nav-link nav-link-disabled" title="Timesheets will connect tracked time to projects and tasks">
          <Clock3 className="nav-link-icon" size={17}/><span>Timesheets</span><span className="nav-soon">Soon</span>
        </div>

        {isSuperAdmin(user?.role) && (
          <NavLink to="/messages" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Megaphone className="nav-link-icon" size={18} />
            <span>Important Messages</span>
          </NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name ?? 'Loading...'}</div>
            <div className="user-role">{user?.role ?? ''}</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="nav-link"
          style={{ width: '100%', marginTop: '0.25rem', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 500 }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
