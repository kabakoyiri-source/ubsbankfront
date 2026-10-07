import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import './Cards.css';

const BankCard = () => {
  const [cardData, setCardData] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Simuler les données de la carte avec infos admin
    const mockCardData = {
      cardNumber: '4532 1234 5678 9010',
      cardHolder: user ? `${user.firstName || ''} ${user.lastName || ''}`.toUpperCase() : 'ADMIN USER',
      expiryDate: '12/25',
      cvv: '123',
      cardType: 'VISA',
      cardTier: 'GOLD',
      rib: 'CH93 0076 2011 6238 5295 7'
    };
    setCardData(mockCardData);
  }, [user]);

  if (!cardData) return <div className="loading">Chargement...</div>;

  return (
    <div className="card-container">
      <div className={`bank-card ${isFlipped ? 'flipped' : ''}`}>
        {/* Face avant de la carte */}
        <div className="card-face card-front">
          <div className="card-background"></div>
          
          {/* Logo Visa */}
          <div className="card-logo">
            <img 
              src="https://img.icons8.com/color/48/visa.png" 
              alt="Visa" 
              width={60} 
              height={20}
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* Numéro de carte */}
          <div className="card-number">
            {cardData.cardNumber}
          </div>

          {/* Nom et date d'expiration */}
          <div className="card-details">
            <div className="card-holder">
              <div className="value">{cardData.cardHolder}</div>
            </div>
            <div className="card-expiry">
              <div className="value">{cardData.expiryDate}</div>
            </div>
          </div>

          {/* Badge Gold */}
          <div className="card-tier">GOLD</div>
        </div>

        {/* Face arrière de la carte */}
        <div className="card-face card-back">
          <div className="card-background"></div>
          <div className="magnetic-strip">
            <div className="rib-box-black">
              <span className="rib-value-white">{cardData.rib}</span>
            </div>
          </div>
          <div className="signature-panel">
            <div className="cvv-box">
              <span className="cvv-label">CVV</span>
              <span className="cvv-value">{cardData.cvv}</span>
            </div>
          </div>
          <div className="card-info-text">
            Pour toute question, contactez votre banque
          </div>
        </div>
      </div>

      {/* Bouton pour retourner la carte */}
      <button 
        className="flip-button"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {isFlipped ? 'Voir le recto' : 'Voir le verso'}
      </button>
    </div>
  );
};

function Cards() {
  const [showAddCard, setShowAddCard] = useState(false);

  return (
    <div className="cards-page">
      <div className="cards-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => window.history.back()} 
            className="back-button"
            aria-label="Retour"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1>Mes Cartes</h1>
        </div>
      </div>

      <div className="cards-content">
        <div className="cards-section">
          <h2>Mes Cartes Bancaires</h2>
          <div className="cards-grid">
            <BankCard />
          </div>
        </div>

        {showAddCard && (
          <div className="add-card-section">
            <h2>Ajouter une nouvelle carte</h2>
            <div className="add-card-form">
              <div className="form-group">
                <label>Type de carte</label>
                <select>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nom du titulaire</label>
                <input type="text" placeholder="JEAN DUPONT" />
              </div>
              <div className="form-group">
                <label>Numéro de carte</label>
                <input type="text" placeholder="1234 5678 9012 3456" maxLength="19" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date d'expiration</label>
                  <input type="text" placeholder="MM/AA" maxLength="5" />
                </div>
                <div className="form-group">
                  <label>CVV</label>
                  <input type="text" placeholder="123" maxLength="3" />
                </div>
              </div>
              <button className="submit-btn">Ajouter la carte</button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}

export default Cards;
