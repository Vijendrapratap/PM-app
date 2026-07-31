import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ImportantMessageModal from './ImportantMessageModal';

const Layout = () => {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
      <ImportantMessageModal />
    </div>
  );
};

export default Layout;
