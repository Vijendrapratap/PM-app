import { Lightbulb, Search } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Active Projects',
  '/completed': 'Completed Projects',
  '/team': 'Team Members',
  '/messages': 'Important Messages',
  '/daily-todo': 'Daily To-Do',
  '/workday': 'Workday',
  '/ideas': 'Ideas',
  '/agents': 'Agent Studio',
};

const Header = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isProjectDetail = location.pathname.startsWith('/projects/') && location.pathname.length > 10;
  const current = isProjectDetail
    ? 'Project Details'
    : BREADCRUMB_MAP[location.pathname] ?? 'Page';

  return (
    <header className="header">
      <div className="header-context">
        <span>Pratap AI</span>
        <strong>{current}</strong>
      </div>

      <div className="header-search">
        <Search size={15}/>
        <input type="search" placeholder="Search work, people, projects" aria-label="Search" />
        <kbd>⌘ K</kbd>
      </div>

      <nav className="header-quick-nav" aria-label="Quick navigation">
        <NavLink to="/ideas" className={({ isActive }) => isActive ? 'active' : ''}>
          <Lightbulb size={15}/><span>Idea bucket</span>
        </NavLink>
      </nav>

      <div className="header-actions">
        <NotificationBell />
        <div className="header-identity"><div className="avatar">{user?.name?.charAt(0)?.toUpperCase() ?? '?'}</div><span><strong>{user?.name || 'Account'}</strong><small>{user?.role}</small></span></div>
      </div>
    </header>
  );
};

export default Header;
