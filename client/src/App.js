import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Users, LayoutDashboard, Building2 } from 'lucide-react';
import './App.css';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Companies from './pages/Companies';
import InvoiceGenerator from './pages/InvoiceGenerator';
import InvoiceView from './pages/InvoiceView';

function Navigation() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/companies', icon: Building2, label: 'Companies' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/invoice', icon: FileText, label: 'New Invoice' },
  ];
  
  return (
    <nav className="sidebar">
      <div className="logo-section">
        <div className="logo">
          <div className="logo-icon">RB</div>
          <div className="logo-text">
            <div className="firm-name">R Bhargava</div>
            <div className="firm-tagline">& Associates</div>
          </div>
        </div>
      </div>
      
      <div className="nav-items">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="nav-footer">
        <div className="gstin-badge">
          <div className="badge-label">GSTIN</div>
          <div className="badge-value">07AAQFR3892K1ZE</div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/invoice" element={<InvoiceGenerator />} />
            <Route path="/invoice/:id" element={<InvoiceView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
