import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import HomePage from './pages/HomePage';
import PublicDrawPage from './pages/PublicDrawPage';
import PrivacyPage from './pages/PrivacyPage';
import AdminApp from './pages/admin/AdminApp';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sorteio/:slug" element={<PublicDrawPage />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
