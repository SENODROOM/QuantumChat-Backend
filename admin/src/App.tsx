import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WebsitesPage } from './pages/WebsitesPage';
import { UsersPage } from './pages/UsersPage';
import { MessagesPage } from './pages/MessagesPage';
import { ChatPage } from './pages/ChatPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { bootstrapAdminAuth } from './utils/adminAuth';
import './index.css';

function App() {
  const [isAuth, setIsAuth] = useState(() => bootstrapAdminAuth());

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={isAuth ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setIsAuth(true)} />}
            />
            <Route
              element={isAuth ? <Layout onLogout={() => setIsAuth(false)} /> : <Navigate to="/login" replace />}
            >
              <Route index element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="websites" element={<WebsitesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="messages" element={<MessagesPage />} />
            </Route>
            <Route path="*" element={<Navigate to={isAuth ? '/' : '/login'} replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
