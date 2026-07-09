import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CheckCircle2, Users, LogOut, Megaphone, ListChecks, Lightbulb } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/roles';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

        <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FolderKanban className="nav-link-icon" size={18} />
          <span>Active Projects</span>
        </NavLink>

        <NavLink to="/completed" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <CheckCircle2 className="nav-link-icon" size={18} />
          <span>Completed</span>
        </NavLink>

        <NavLink to="/daily-todo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <ListChecks className="nav-link-icon" size={18} />
          <span>Daily To-Do</span>
        </NavLink>

        <NavLink to="/ideas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Lightbulb className="nav-link-icon" size={18} />
          <span>Ideas</span>
        </NavLink>

        <div className="sidebar-section-label">People</div>

        <NavLink to="/team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Users className="nav-link-icon" size={18} />
          <span>Team Members</span>
        </NavLink>

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
