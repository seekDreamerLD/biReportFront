import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import DashboardList from './pages/DashboardList';
import DashboardDesigner from './pages/designer/DashboardDesigner';
import ChartList from './pages/ChartList';
import ChartEditor from './pages/ChartEditor';
import ChatBI from './pages/ChatBI';
import DatasetList from './pages/DatasetList';
import DatasetEditor from './pages/DatasetEditor';
import DataSourceList from './pages/DataSourceList';
import UserManagement from './pages/UserManagement';
import Embed from './pages/Embed';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/embed/:token" element={<Embed />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboards" replace />} />
          <Route path="/dashboards" element={<DashboardList />} />
          <Route path="/dashboards/:id/design" element={<DashboardDesigner />} />
          <Route path="/chatbi" element={<ChatBI />} />
          <Route path="/charts" element={<ChartList />} />
          <Route path="/charts/new" element={<ChartEditor />} />
          <Route path="/charts/:id/edit" element={<ChartEditor />} />
          <Route path="/datasets" element={<DatasetList />} />
          <Route path="/datasets/:id/edit" element={<DatasetEditor />} />
          <Route path="/datasets/new" element={<DatasetEditor />} />
          <Route path="/datasources" element={<DataSourceList />} />
          <Route path="/users" element={<UserManagement />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
