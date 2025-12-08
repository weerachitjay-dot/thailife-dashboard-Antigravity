import React, { useState, useEffect } from 'react';
import { DataProvider, useData } from './context/DataContext';
import MainLayout from './layout/MainLayout';
import DashboardOverview from './pages/DashboardOverview';
import IntelligencePage from './pages/IntelligencePage';
import TimeAnalysisPage from './pages/TimeAnalysisPage';
import CreativeAnalysis from './components/analysis/CreativeAnalysis';
import AudienceAnalysis from './components/analysis/AudienceAnalysis';
import UserManagement from './components/auth/UserManagement';
import LoginPage from './components/auth/LoginPage';
import { DEFAULT_USERS } from './utils/constants';
import ErrorBoundary from './components/common/ErrorBoundary';
import CostProfitPage from './pages/CostProfitPage';
import ProductMasterPage from './pages/ProductMasterPage';
import './App.css';

// --- Authenticated App Content ---
const AuthenticatedApp = ({ user, onLogout, users, onAddUser, onDeleteUser }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { appendData } = useData(); // Access data from context for analysis props

  return (
    <MainLayout
      user={user}
      onLogout={onLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {activeTab === 'dashboard' && <DashboardOverview />}

      {activeTab === 'smart-analysis' && (
        <CreativeAnalysis
          data={appendData}
          targetCpl={280} // Default target, maybe move to config later
        />
      )}

      {activeTab === 'smart-audience' && (
        <AudienceAnalysis
          data={appendData}
          targetCpl={280}
        />
      )}

      {activeTab === 'intelligence' && <IntelligencePage />}

      {activeTab === 'time-analysis' && (
        <ErrorBoundary>
          <TimeAnalysisPage />
        </ErrorBoundary>
      )}

      {activeTab === 'cost-profit' && (
        <ErrorBoundary>
          <CostProfitPage />
        </ErrorBoundary>
      )}

      {activeTab === 'product-master' && (
        <ErrorBoundary>
          <ProductMasterPage />
        </ErrorBoundary>
      )}

      {activeTab === 'users' && user?.role === 'admin' && (
        <UserManagement
          users={users}
          onAddUser={onAddUser}
          onDeleteUser={onDeleteUser}
          currentUser={user}
        />
      )}
    </MainLayout>
  );
};

// --- Main App Entry ---
const App = () => {
  // User Management State
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('app_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('app_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('app_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('app_current_user');
    }
  }, [currentUser]);

  const handleLogin = (authedUser) => setCurrentUser(authedUser);
  const handleLogout = () => setCurrentUser(null);

  const handleAddUser = (newUser) => {
    const id = Date.now();
    setUsers([...users, { ...newUser, id }]);
  };

  const handleDeleteUser = (id, username) => {
    if (window.confirm(`Delete user ${username}?`)) {
      setUsers(users.filter(u => u.id !== id && u.username !== username));
    }
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} users={users} />;
  }

  return (
    <DataProvider>
      <AuthenticatedApp
        user={currentUser}
        onLogout={handleLogout}
        users={users}
        onAddUser={handleAddUser}
        onDeleteUser={handleDeleteUser}
      />
    </DataProvider>
  );
};

export default App;
