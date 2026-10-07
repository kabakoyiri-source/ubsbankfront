import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiSave, FiLock, FiAlertCircle, FiCheck } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [password, setPassword] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleInitialSave = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setShowPasswordModal(true);
  };

  const handleConfirmUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put('/auth/updatedetails', {
        firstName,
        lastName,
        password
      });

      if (response.data.success) {
        setSuccess('Profil mis à jour avec succès');
        setUser(response.data.user); // Update context
        setIsEditing(false);
        setShowPasswordModal(false);
        setPassword('');
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="page-header-with-back">
          <button onClick={() => navigate('/more')} className="back-button">
            <FiArrowLeft size={20} />
          </button>
          <h1>Mon Profil</h1>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          <div className="large-avatar">
            <FiUser size={48} />
          </div>
          <h2>{user?.email}</h2>
          <p className="account-type">Compte Particulier</p>
        </div>

        {error && (
          <div className="error-message">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-message">
            <FiCheck />
            <span>{success}</span>
          </div>
        )}

        <div className="profile-form-container">
          <div className="form-group">
            <label>Prénom</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!isEditing}
              className={isEditing ? 'editable' : ''}
            />
          </div>

          <div className="form-group">
            <label>Nom</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={!isEditing}
              className={isEditing ? 'editable' : ''}
            />
          </div>

          {!isEditing ? (
            <button 
              className="btn btn-primary btn-block"
              onClick={() => setIsEditing(true)}
            >
              Modifier mes informations
            </button>
          ) : (
            <div className="edit-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  setFirstName(user?.firstName || '');
                  setLastName(user?.lastName || '');
                  setError('');
                }}
              >
                Annuler
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleInitialSave}
              >
                Enregistrer
              </button>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Sécurité</h3>
            <p>Veuillez confirmer votre mot de passe pour enregistrer les modifications.</p>
            
            <form onSubmit={handleConfirmUpdate}>
              <div className="form-group">
                <label>Mot de passe actuel</label>
                <div className="password-input-wrapper">
                  <FiLock className="input-icon" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                  }}
                  disabled={loading}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Vérification...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
