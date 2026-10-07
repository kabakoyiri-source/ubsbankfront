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
      label: 'Profil',
      description: 'Gérer vos informations personnelles',
      action: () => navigate('/profile')
    },
    {
      icon: FiSettings,
      label: 'Paramètres',
      description: 'Configurer l\'application',
      action: () => navigate('/settings')
    },
    {
      icon: FiBell,
      label: 'Notifications',
      description: 'Gérer les alertes et notifications',
    },
    {
      icon: FiLock,
      label: 'Sécurité',
      description: 'Mot de passe et authentification',
    },
    {
      icon: FiShield,
      label: 'Confidentialité',
      description: 'Gestion des données personnelles',
    },
    {
      icon: FiFileText,
      label: 'Documents',
      description: 'Vos documents et contrats',
    },
    {
      icon: FiHelpCircle,
      label: 'Aide',
      description: 'Centre d\'aide et support',
    },
    {
      icon: FiInfo,
      label: 'À propos',
      description: 'Informations sur l\'application',
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
            aria-label="Retour"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>Plus</h1>
        </div>
      </div>

      <div className="plus-content">
        <div className="user-section">
          <div className="user-card">
            <div className="user-avatar">
              <FiUser size={32} />
            </div>
            <div className="user-info">
              <h3>{user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Utilisateur'}</h3>
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
                    <span className="menu-item-description">{item.action ? item.description : 'Bientôt disponible'}</span>
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
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Plus;
