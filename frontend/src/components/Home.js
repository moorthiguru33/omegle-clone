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

const Title = styled.h1`
  font-size: 3.5rem;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 800;
  text-shadow: 0 4px 20px rgba(0,0,0,0.3);
  
  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  margin-bottom: 3rem;
  text-align: center;
  opacity: 0.9;
  font-weight: 300;
  
  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 2rem;
  }
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 3rem;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  @media (max-width: 768px) {
    padding: 2rem;
    max-width: 400px;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.9;
`;

const Select = styled.select`
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 18px;
  margin: 12px 0;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &.primary {
    background: linear-gradient(45deg, #ff6b6b, #ee5a52);
    color: white;
    box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(255, 107, 107, 0.5);
    }
  }
  
  &.secondary {
    background: linear-gradient(45deg, #4ecdc4, #44a08d);
    color: white;
    box-shadow: 0 8px 25px rgba(78, 205, 196, 0.4);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(78, 205, 196, 0.5);
    }
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &:active {
    transform: translateY(1px);
  }
`;

const CreditInfo = styled.div`
  background: rgba(255, 255, 255, 0.15);
  padding: 16px;
  border-radius: 12px;
  margin: 20px 0;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  .icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .text {
    font-weight: 600;
    font-size: 0.9rem;
  }
`;

const FeatureList = styled.div`
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  
  .feature {
    display: flex;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 0.9rem;
    opacity: 0.8;
    
    .icon {
      margin-right: 0.8rem;
      font-size: 1.1rem;
    }
  }
`;

const Home = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [gender, setGender] = useState(user.gender || '');
  const [preferredGender, setPreferredGender] = useState(user.preferredGender || '');

  const handleStartChat = () => {
    if (!gender) {
      alert('Please select your gender to continue');
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
      <Title>🎥 OmegleClone</Title>
      <Subtitle>Connect with strangers around the world</Subtitle>
      
      <Card>
        <FormGroup>
          <Label>Your Gender</Label>
          <Select 
            value={gender} 
            onChange={(e) => setGender(e.target.value)}
            required
          >
            <option value="">Select Your Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Partner Preference</Label>
          <Select 
            value={preferredGender} 
            onChange={(e) => setPreferredGender(e.target.value)}
          >
            <option value="any">Any Gender (Free)</option>
            <option value="male">Male Only</option>
            <option value="female">Female Only</option>
            <option value="other">Other Only</option>
          </Select>
        </FormGroup>

        {user.isPremium ? (
          <CreditInfo>
            <div className="icon">✨</div>
            <div className="text">Premium: Unlimited Filters</div>
          </CreditInfo>
        ) : (
          <CreditInfo>
            <div className="icon">🎫</div>
            <div className="text">Filter Credits: {user.filterCredits}</div>
          </CreditInfo>
        )}

        <Button 
          className="primary" 
          onClick={handleStartChat}
          disabled={!gender}
        >
          Start Video Chat
        </Button>

        <Button 
          className="secondary" 
          onClick={() => navigate('/premium')}
        >
          Upgrade to Premium
        </Button>
        
        <FeatureList>
          <div className="feature">
            <span className="icon">🔒</span>
            <span>100% Anonymous & Safe</span>
          </div>
          <div className="feature">
            <span className="icon">🌍</span>
            <span>Connect Globally</span>
          </div>
          <div className="feature">
            <span className="icon">📱</span>
            <span>Works on All Devices</span>
          </div>
          <div className="feature">
            <span className="icon">⚡</span>
            <span>Instant Matching</span>
          </div>
        </FeatureList>
      </Card>
    </Container>
  );
};

export default Home;
