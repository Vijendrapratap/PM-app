import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ImportantMessageModal from './ImportantMessageModal';

const Layout = () => {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
      <ImportantMessageModal />
    </div>
  );
};

export default Layout;
