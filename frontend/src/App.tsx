import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import ImportProjects from './pages/ImportProjects';
import MyTasks from './pages/MyTasks';
import Stock from './pages/Stock';
import Communications from './pages/Communications';
import Users from './pages/Users';
import Cargos from './pages/Cargos';
import Suppliers from './pages/Suppliers';
import Categories from './pages/Categories';
import NotificationsPage from './pages/NotificationsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/ToastContainer';
import { useAuthStore } from './store/auth';
import { getFirstAllowedPage } from './utils/getFirstAllowedPage';

function DefaultRedirect() {
  const user = useAuthStore((state) => state.user);
  const firstPage = getFirstAllowedPage(user);
  return <Navigate to={firstPage} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/import" element={<ImportProjects />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/tasks/my" element={<MyTasks />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/communications" element={<Communications />} />
            {/* Redirecionamento para compatibilidade com rota antiga */}
            <Route path="/requests" element={<Navigate to="/communications" replace />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/users" element={<Users />} />
            <Route path="/cargos" element={<Cargos />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/categories" element={<Categories />} />
          </Route>
        </Route>

        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
