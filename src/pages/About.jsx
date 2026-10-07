import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiInfo, FiSmartphone, FiGlobe } from 'react-icons/fi';
import './About.css';

function About() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  return (
    <div className="about-page">
      <div className="about-header">
        <div className="page-header-with-back">
          <button onClick={() => navigate('/more')} className="back-button">
            <FiArrowLeft size={20} />
          </button>
          <h1>À propos</h1>
        </div>
      </div>

      <div className="about-content">
        <div className="app-branding">
          <img src="/images/logo-wordmark.png" alt="Logo" className="about-logo" />
          <h2>UBS Mobile Banking</h2>
          <p className="version">Version 2.4.0 (Build 20250126)</p>
        </div>

        <div className="about-section">
          <h3>Mentions légales</h3>
          <div className="legal-text">
            <p>
              Cette application est la propriété exclusive de UBS Group AG.
              L'accès et l'utilisation de cette application sont soumis aux conditions générales d'utilisation.
            </p>
            <p>
              UBS accorde une importance capitale à la sécurité de vos données.
              Toutes les communications sont chiffrées de bout en bout.
            </p>
          </div>
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <div className="feature-icon">
              <FiShield />
            </div>
            <div className="feature-text">
              <h4>Sécurité Avancée</h4>
              <p>Protection biométrique et chiffrement fort.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <FiSmartphone />
            </div>
            <div className="feature-text">
              <h4>Expérience Mobile</h4>
              <p>Optimisé pour tous vos appareils.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <FiGlobe />
            </div>
            <div className="feature-text">
              <h4>Accès Global</h4>
              <p>Gérez vos comptes partout dans le monde.</p>
            </div>
          </div>
        </div>

        <div className="footer-credits">
          <p>© {currentYear} UBS Group AG. Tous droits réservés.</p>
          <p>Made with ❤️ for high-end banking experience.</p>
        </div>
      </div>
    </div>
  );
}

export default About;
