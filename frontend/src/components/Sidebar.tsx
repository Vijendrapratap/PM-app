import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, CheckCircle2, Users, LogOut, Zap } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={18} />
        </div>
        <div>
          <div className="sidebar-logo-text">Pratap AI Innovation</div>
          <div className="sidebar-logo-sub">Project Hub</div>
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

        <div className="sidebar-section-label">People</div>

        <NavLink to="/team" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Users className="nav-link-icon" size={18} />
          <span>Team Members</span>
        </NavLink>

      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">
            G
          </div>
          <div className="user-info">
            <div className="user-name">Admin</div>
            <div className="user-role">Project Manager</div>
          </div>
        </div>
        <button
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
