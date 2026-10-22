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
          <h1>About</h1>
        </div>
      </div>

      <div className="about-content">
        <div className="app-branding">
          <img src="/images/logo-wordmark.png" alt="Logo" className="about-logo" />
          <h2>UBS Mobile Banking</h2>
          <p className="version">Version 2.4.0 (Build 20250126)</p>
        </div>

        <div className="about-section">
          <h3>Legal information</h3>
          <div className="legal-text">
            <p>
              This application is the exclusive property of UBS Group AG. Access to and use of this application are subject to its terms and conditions.
            </p>
            <p>
              UBS places great importance on the security of your data. All communications are encrypted end to end.
            </p>
          </div>
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <div className="feature-icon">
              <FiShield />
            </div>
            <div className="feature-text">
              <h4>Advanced security</h4>
              <p>Biometric protection and strong encryption.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <FiSmartphone />
            </div>
            <div className="feature-text">
              <h4>Mobile experience</h4>
              <p>Optimised for all your devices.</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <FiGlobe />
            </div>
            <div className="feature-text">
              <h4>Global access</h4>
              <p>Manage your accounts anywhere in the world.</p>
            </div>
          </div>
        </div>

        <div className="footer-credits">
          <p>© {currentYear} UBS Group AG. All rights reserved.</p>
          <p>Made with ❤️ for high-end banking experience.</p>
        </div>
      </div>
    </div>
  );
}

export default About;
