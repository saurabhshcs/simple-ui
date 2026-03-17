import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/layout/AppShell';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/device-confirmed" element={
          <div className="min-h-screen bg-bg-primary flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-xl font-semibold text-text-primary">Device registered!</h1>
              <p className="text-text-secondary mt-2">You can now sign in from this device.</p>
              <a href="/login" className="text-accent hover:underline mt-4 block">Sign in</a>
            </div>
          </div>
        } />
        <Route path="/auth/device-error" element={
          <div className="min-h-screen bg-bg-primary flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-xl font-semibold text-text-primary">Link expired</h1>
              <p className="text-text-secondary mt-2">The device registration link has expired. Please sign in again.</p>
              <a href="/login" className="text-accent hover:underline mt-4 block">Sign in</a>
            </div>
          </div>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
