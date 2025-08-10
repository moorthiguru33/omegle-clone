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
`;

const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 2rem;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  color: #333;
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
  
  &.primary {
    background: #ff6b6b;
    color: white;
  }
  
  &.secondary {
    background: #4ecdc4;
    color: white;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CreditInfo = styled.div`
  background: rgba(255, 255, 255, 0.2);
  padding: 10px;
  border-radius: 8px;
  margin: 10px 0;
  text-align: center;
`;

const Home = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [gender, setGender] = useState(user.gender || '');
  const [preferredGender, setPreferredGender] = useState(user.preferredGender || '');

  const handleStartChat = () => {
    if (!gender) {
      alert('Please select your gender');
      return;
    }

    // Check if user has credits for gender filter
    if (preferredGender && preferredGender !== 'any' && user.filterCredits <= 0 && !user.isPremium) {
      alert('No gender filter credits remaining. Upgrade to premium or use random matching.');
      return;
    }

    // Use credit if gender filter is selected
    let updatedUser = { ...user, gender, preferredGender };
    if (preferredGender && preferredGender !== 'any' && !user.isPremium && user.filterCredits > 0) {
      updatedUser.filterCredits = user.filterCredits - 1;
    }

    updateUser(updatedUser);
    navigate('/chat');
  };

  return (
    <Container>
      <Title>🎥 Omegle Clone</Title>
      <Card>
        <h2>Start Video Chat</h2>
        
        <Select 
          value={gender} 
          onChange={(e) => setGender(e.target.value)}
        >
          <option value="">Select Your Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>

        <Select 
          value={preferredGender} 
          onChange={(e) => setPreferredGender(e.target.value)}
        >
          <option value="">Any Gender (Free)</option>
          <option value="male">Male Only</option>
          <option value="female">Female Only</option>
          <option value="other">Other Only</option>
        </Select>

        {user.isPremium ? (
          <CreditInfo>
            ✨ Premium: Unlimited Filters
          </CreditInfo>
        ) : (
          <CreditInfo>
            🎫 Filter Credits: {user.filterCredits}
          </CreditInfo>
        )}

        <Button className="primary" onClick={handleStartChat}>
          Start Chat
        </Button>

        <Button 
          className="secondary" 
          onClick={() => navigate('/premium')}
        >
          Upgrade to Premium (₹500/month)
        </Button>
      </Card>
    </Container>
  );
};

export default Home;
