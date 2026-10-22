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
      setError("Complete all fields");
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
        setSuccess("Profile updated successfully");
        setUser(response.data.user); // Update context
        setIsEditing(false);
        setShowPasswordModal(false);
        setPassword('');
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update");
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
          <h1>My profile</h1>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-avatar-section">
          <div className="large-avatar">
            <FiUser size={48} />
          </div>
          <h2>{user?.email}</h2>
          <p className="account-type">Personal account</p>
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
            <label>First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!isEditing}
              className={isEditing ? 'editable' : ''}
            />
          </div>

          <div className="form-group">
            <label>Last name</label>
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
              Edit my details
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
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleInitialSave}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Security</h3>
            <p>Confirm your password to save these changes.</p>
            
            <form onSubmit={handleConfirmUpdate}>
              <div className="form-group">
                <label>Current password</label>
                <div className="password-input-wrapper">
                  <FiLock className="input-icon" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
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
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Confirm"}
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
