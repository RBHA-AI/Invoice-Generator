import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
  useNavigate
} from 'react-router-dom';
import { FileText, Users, LayoutDashboard, Building2, LogOut, Repeat } from 'lucide-react';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Companies from './pages/Companies';
import InvoiceGenerator from './pages/InvoiceGenerator';
import InvoiceView from './pages/InvoiceView';
import Invoices from './pages/Invoices';
import InvoiceSummaryExport from './pages/InvoiceSummaryExport';
import EmailDefaults from './pages/EmailDefaults';
import RecurringBills from './pages/RecurringBills';
import InvoicingPage from './landing/InvoicingPage';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="main-content auth-loading">
        <p>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function PublicLanding() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="main-content auth-loading">
        <p>Loading…</p>
      </div>
    );
  }

  // Signed-in users who hit the marketing root go straight into the app
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <InvoicingPage />;
}

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { workspace, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/recurring-bills', icon: Repeat, label: 'Recurring Bills' },
    { path: '/companies', icon: Building2, label: 'Companies' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/invoice', icon: FileText, label: 'New Invoice' }
  ];

  const displayInitials = (workspace?.displayName || 'IG')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="sidebar">
      <div className="logo-section">
        <div className="logo">
          <div className="logo-icon">{displayInitials}</div>
          <div className="logo-text">
            <div className="firm-name">{workspace?.displayName || 'Invoice Generator'}</div>
            <div className="firm-tagline">{workspace?.slug || ''}</div>
          </div>
        </div>
      </div>

      <div className="nav-items">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="nav-footer">
        <button type="button" className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}

function AppShell() {
  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoice-summary-export" element={<InvoiceSummaryExport />} />
          <Route path="/email-defaults" element={<EmailDefaults />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/recurring-bills" element={<RecurringBills />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/invoice" element={<InvoiceGenerator />} />
          <Route path="/invoice/:id" element={<InvoiceView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicLanding />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
