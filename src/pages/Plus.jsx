import React, { useState } from 'react';
import { FiArrowLeft, FiSettings, FiHelpCircle, FiShield, FiFileText, FiLogOut, FiChevronRight, FiUser, FiBell, FiLock, FiInfo } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Plus.css';

function Plus() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      icon: FiUser,
      label: "Profile",
      description: "Manage your personal information",
      action: () => navigate('/profile')
    },
    {
      icon: FiSettings,
      label: "Settings",
      description: "Configure the app",
      action: () => navigate('/settings')
    },
    {
      icon: FiBell,
      label: 'Notifications',
      description: "Manage alerts and notifications",
    },
    {
      icon: FiLock,
      label: "Security",
      description: "Password and authentication",
    },
    {
      icon: FiShield,
      label: "Privacy",
      description: "Manage personal data",
    },
    {
      icon: FiFileText,
      label: 'Documents',
      description: "Your documents and contracts",
    },
    {
      icon: FiHelpCircle,
      label: "Help",
      description: "Help and support centre",
    },
    {
      icon: FiInfo,
      label: "About",
      description: "About the app",
      action: () => navigate('/about')
    }
  ];

  return (
    <div className="plus-page">
      <div className="plus-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => navigate('/')} 
            className="back-button"
            aria-label="Back"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>More</h1>
        </div>
      </div>

      <div className="plus-content">
        <div className="user-section">
          <div className="user-card">
            <div className="user-avatar">
              <FiUser size={32} />
            </div>
            <div className="user-info">
              <h3>{user ? `${user.firstName || ''} ${user.lastName || ''}` : "User"}</h3>
            </div>
          </div>
        </div>

        <div className="menu-section">
          <div className="menu-grid">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button 
                  key={index}
                  className="menu-item"
                  onClick={item.action}
                  disabled={!item.action}
                >
                  <div className="menu-item-icon">
                    <Icon size={24} />
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-label">{item.label}</span>
                    <span className="menu-item-description">{item.action ? item.description : "Coming soon"}</span>
                  </div>
                  <div className="menu-item-arrow">
                    <FiChevronRight size={20} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="logout-section">
          <button className="logout-button" onClick={handleLogout}>
            <FiLogOut size={24} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Plus;
