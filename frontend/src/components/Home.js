import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
  color: white;
  padding: 20px;
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

const Title = styled.h1`
  font-size: 4rem;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 900;
  text-shadow: 0 8px 30px rgba(0,0,0,0.4);
  
  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.4rem;
  margin-bottom: 3rem;
  text-align: center;
  opacity: 0.95;
  font-weight: 400;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(25px);
  border-radius: 28px;
  padding: 3.5rem;
  max-width: 500px;
  width: 95%;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.18);
  text-align: center;
`;

const Button = styled.button`
  width: 100%;
  padding: 20px;
  margin: 15px 0;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.4s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  background: linear-gradient(45deg, #ff6b6b, #ee5a52, #ff8a80);
  color: white;
  box-shadow: 0 10px 35px rgba(255, 107, 107, 0.5);
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 45px rgba(255, 107, 107, 0.6);
  }
  
  &:active {
    transform: translateY(-1px);
  }
`;

const FeatureList = styled.div`
  margin-top: 2rem;
  text-align: left;
  
  .feature {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.95rem;
    opacity: 0.9;
    
    .icon {
      margin-right: 1rem;
      font-size: 1.3rem;
      width: 24px;
      text-align: center;
    }
  }
`;

const Home = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStartChat = async () => {
    setLoading(true);
    
    try {
      // Test camera access
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      testStream.getTracks().forEach(track => track.stop());
      
      // Navigate to chat
      setTimeout(() => {
        navigate('/chat');
      }, 500);
      
    } catch (error) {
      alert('Camera and microphone access required. Please allow permissions and try again.');
      setLoading(false);
    }
  };

  return (
    <Container>
      <Title>🎥 OmegleClone</Title>
      <Subtitle>Connect with strangers around the world through video chat</Subtitle>
      
      <Card>
        <Button onClick={handleStartChat} disabled={loading}>
          {loading ? '⏳ Starting...' : '🚀 Start Video Chat'}
        </Button>
        
        <FeatureList>
          <div className="feature">
            <span className="icon">🔒</span>
            <span>100% Anonymous & Secure</span>
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
          <div className="feature">
            <span className="icon">🎥</span>
            <span>HD Video & Audio</span>
          </div>
        </FeatureList>
      </Card>
    </Container>
  );
};

export default Home;
