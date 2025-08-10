import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  text-align: center;
`;

const PriceTag = styled.div`
  font-size: 3rem;
  font-weight: bold;
  color: #ffd700;
  margin: 20px 0;
`;

const FeatureList = styled.ul`
  text-align: left;
  margin: 20px 0;
  
  li {
    margin: 10px 0;
    padding-left: 20px;
    position: relative;
    
    &:before {
      content: '✨';
      position: absolute;
      left: 0;
    }
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 15px;
  margin: 10px 0;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &.premium {
    background: #ffd700;
    color: #333;
  }
  
  &.back {
    background: #6c757d;
    color: white;
  }
`;

const Premium = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    
    // Simulate payment process
    setTimeout(() => {
      const updatedUser = {
        ...user,
        isPremium: true,
        filterCredits: 999,
        subscriptionId: 'premium_' + Math.random().toString(36).substring(7)
      };
      updateUser(updatedUser);
      alert('Premium activated successfully!');
      navigate('/');
      setLoading(false);
    }, 2000);
  };

  if (user.isPremium) {
    return (
      <Container>
        <Card>
          <h1>✨ Premium Active</h1>
          <p>You already have premium subscription!</p>
          
          <FeatureList>
            <li>Unlimited gender filtering</li>
            <li>Priority matching</li>
            <li>HD video quality</li>
            <li>Ad-free experience</li>
          </FeatureList>

          <Button className="back" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <h1>🚀 Upgrade to Premium</h1>
        <PriceTag>₹500/month</PriceTag>
        
        <FeatureList>
          <li>Unlimited gender filtering</li>
          <li>Priority matching (faster connections)</li>
          <li>HD video quality</li>
          <li>Ad-free experience</li>
          <li>Extended session duration</li>
          <li>Advanced reporting tools</li>
        </FeatureList>

        <Button 
          className="premium" 
          onClick={handlePurchase}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Subscribe Now with Razorpay'}
        </Button>

        <Button className="back" onClick={() => navigate('/')}>
          Maybe Later
        </Button>

        <p style={{ fontSize: '12px', marginTop: '20px', opacity: 0.8 }}>
          Secure payment powered by Razorpay. Cancel anytime.
        </p>
      </Card>
    </Container>
  );
};

export default Premium;
