import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import MyTasks from './pages/MyTasks';
import Stock from './pages/Stock';
import Occurrences from './pages/Occurrences';
import Requests from './pages/Requests';
import Users from './pages/Users';
import Cargos from './pages/Cargos';
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
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/tasks/my" element={<MyTasks />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/occurrences" element={<Occurrences />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/users" element={<Users />} />
            <Route path="/cargos" element={<Cargos />} />
          </Route>
        </Route>

        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
