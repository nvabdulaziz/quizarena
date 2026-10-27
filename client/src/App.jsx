import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Background, PageLoader } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Editor from './pages/Editor.jsx';
import Preview from './pages/Preview.jsx';
import History from './pages/History.jsx';
import Results from './pages/Results.jsx';
import Join from './pages/Join.jsx';
import Play from './pages/Play.jsx';
import Host from './pages/Host.jsx';

function Private({ children }) {
  const { teacher, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Background><PageLoader /></Background>;
  if (!teacher) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:pin" element={<Join />} />
      <Route path="/play" element={<Play />} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/quiz/:id/edit" element={<Private><Editor /></Private>} />
      <Route path="/quiz/:id/preview" element={<Private><Preview /></Private>} />
      <Route path="/host/:pin" element={<Private><Host /></Private>} />
      <Route path="/history" element={<Private><History /></Private>} />
      <Route path="/history/:id" element={<Private><Results /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
