import { Search, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const BREADCRUMB_MAP: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Active Projects',
  '/completed': 'Completed Projects',
  '/team': 'Team Members',
};

const Header = () => {
  const location = useLocation();
  const isProjectDetail = location.pathname.startsWith('/projects/') && location.pathname.length > 10;
  const current = isProjectDetail
    ? 'Project Details'
    : BREADCRUMB_MAP[location.pathname] ?? 'Page';

  return (
    <header className="header">
      {/* Breadcrumb */}
      <div className="header-breadcrumb">
        <span>Pratap AI Innovation</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{current}</span>
      </div>

      {/* Search */}
      <div className="header-search">
        <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input type="text" placeholder="Search projects, members..." />
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>⌘K</span>
      </div>

      {/* Actions */}
      <div className="header-actions">
        <button className="icon-btn">
          <Bell size={17} />
        </button>
        <div className="avatar" style={{ cursor: 'pointer' }}>G</div>
      </div>
    </header>
  );
};

export default Header;
