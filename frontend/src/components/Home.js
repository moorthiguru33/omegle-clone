import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c);
  background-size: 400% 400%;
  animation: ${gradientShift} 15s ease infinite;
  color: white;
  padding: 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    animation: ${pulse} 10s ease-in-out infinite;
    pointer-events: none;
  }
`;

const Title = styled.h1`
  font-size: 4rem;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 900;
  text-shadow: 0 8px 30px rgba(0,0,0,0.4);
  animation: ${fadeIn} 1s ease-out;
  background: linear-gradient(45deg, #fff, #f0f8ff, #fff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: 768px) {
    font-size: 3rem;
  }
  
  @media (max-width: 480px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.4rem;
  margin-bottom: 3rem;
  text-align: center;
  opacity: 0.95;
  font-weight: 400;
  animation: ${fadeIn} 1.2s ease-out;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
  
  @media (max-width: 768px) {
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }
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
  animation: ${fadeIn} 1.4s ease-out;
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    padding: 2.5rem;
    max-width: 450px;
  }
  
  @media (max-width: 480px) {
    padding: 2rem;
    max-width: 350px;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 2rem;
  animation: ${fadeIn} 1.6s ease-out;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.8rem;
  font-weight: 700;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.95;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
`;

const Select = styled.select`
  width: 100%;
  padding: 18px 20px;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  font-weight: 600;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 1);
  }
  
  &:invalid {
    color: #999;
  }

  option {
    padding: 10px;
    font-weight: 600;
  }
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
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  text-transform: uppercase;
  letter-spacing: 1px;
  touch-action: manipulation;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s;
  }
  
  &:hover::before {
    left: 100%;
  }
  
  &.primary {
    background: linear-gradient(45deg, #ff6b6b, #ee5a52, #ff8a80);
    color: white;
    box-shadow: 0 10px 35px rgba(255, 107, 107, 0.5);
    
    &:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 15px 45px rgba(255, 107, 107, 0.6);
    }
    
    &:active:not(:disabled) {
      transform: translateY(-1px);
    }
  }
  
  &.secondary {
    background: linear-gradient(45deg, #4ecdc4, #44a08d, #68d8f0);
    color: white;
    box-shadow: 0 10px 35px rgba(78, 205, 196, 0.5);
    
    &:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 15px 45px rgba(78, 205, 196, 0.6);
    }
    
    &:active:not(:disabled) {
      transform: translateY(-1px);
    }
  }
  
  &.tertiary {
    background: linear-gradient(45deg, #a8edea, #fed6e3, #d1c4e9);
    color: #333;
    box-shadow: 0 10px 35px rgba(168, 237, 234, 0.4);
    
    &:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 15px 45px rgba(168, 237, 234, 0.5);
    }
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    
    &::before {
      display: none;
    }
  }
`;

const CreditInfo = styled.div`
  background: rgba(255, 255, 255, 0.2);
  padding: 20px;
  border-radius: 16px;
  margin: 25px 0;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
  animation: ${fadeIn} 1.8s ease-out;
  
  .icon {
    font-size: 2rem;
    margin-bottom: 0.8rem;
    display: block;
    animation: ${pulse} 2s ease-in-out infinite;
  }
  
  .text {
    font-weight: 700;
    font-size: 1rem;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  
  .subtext {
    font-size: 0.85rem;
    opacity: 0.8;
    margin-top: 0.5rem;
  }
`;

const FeatureList = styled.div`
  margin-top: 2.5rem;
  padding-top: 2.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  animation: ${fadeIn} 2s ease-out;
  
  .feature {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.95rem;
    opacity: 0.9;
    transition: opacity 0.3s ease;
    
    &:hover {
      opacity: 1;
    }
    
    .icon {
      margin-right: 1rem;
      font-size: 1.3rem;
      width: 24px;
      text-align: center;
    }
    
    .text {
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
  }
`;

const ValidationMessage = styled.div`
  background: rgba(255, 193, 7, 0.25);
  border: 2px solid rgba(255, 193, 7, 0.6);
  color: #ffc107;
  padding: 15px 20px;
  border-radius: 12px;
  margin: 15px 0;
  font-size: 0.95rem;
  text-align: center;
  font-weight: 600;
  animation: ${fadeIn} 0.3s ease-out;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ServerStatus = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  backdrop-filter: blur(10px);
  
  .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 8px;
    background: ${props => props.online ? '#22c55e' : '#ef4444'};
    animation: ${pulse} 2s infinite;
  }
`;

const Home = ({ user, updateUser }) => {
  const navigate = useNavigate();
  const [gender, setGender] = useState(user?.gender || '');
  const [preferredGender, setPreferredGender] = useState(user?.preferredGender || 'any');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [serverOnline, setServerOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);

  // Check server status
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch(process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app');
        if (response.ok) {
          const data = await response.json();
          setServerOnline(true);
          setOnlineUsers(data.statistics?.activeUsers || 0);
        }
      } catch (error) {
        console.log('[SERVER] Server check failed:', error.message);
        setServerOnline(false);
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const validateForm = () => {
    setValidationError('');
    
    if (!gender) {
      setValidationError('Please select your gender to continue');
      return false;
    }

    // Check server status
    if (!serverOnline) {
      setValidationError('Server is currently offline. Please try again in a few moments.');
      return false;
    }

    // Check if user has credits for gender filter
    if (preferredGender && preferredGender !== 'any') {
      if (!user?.isPremium && (!user?.filterCredits || user.filterCredits <= 0)) {
        setValidationError('No gender filter credits remaining. Upgrade to premium or select "Any Gender".');
        return false;
      }
    }

    return true;
  };

  const handleStartChat = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setValidationError('');

    try {
      // Check if browser supports required features
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setValidationError('Your browser does not support video chat. Please use a modern browser like Chrome, Firefox, or Safari.');
        setLoading(false);
        return;
      }

      // Test camera access before proceeding
      try {
        console.log('[MEDIA] Testing camera access...');
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 }, 
          audio: true 
        });
        testStream.getTracks().forEach(track => track.stop()); // Stop test stream
        console.log('[SUCCESS] Camera access test passed');
      } catch (mediaError) {
        console.error('[ERROR] Camera access test failed:', mediaError);
        let errorMessage = 'Camera access denied. Please allow camera and microphone access.';
        
        if (mediaError.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a device and try again.';
        } else if (mediaError.name === 'NotAllowedError') {
          errorMessage = 'Camera and microphone permissions are required. Please allow access and try again.';
        } else if (mediaError.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another application. Please close other apps and try again.';
        }
        
        setValidationError(errorMessage);
        setLoading(false);
        return;
      }

      // Deduct filter credit if using filter
      let updatedCredits = user.filterCredits;
      if (preferredGender !== 'any' && !user.isPremium) {
        updatedCredits = Math.max(0, user.filterCredits - 1);
      }

      // Update user data
      const updatedUser = {
        ...user,
        gender,
        preferredGender: preferredGender || 'any',
        filterCredits: updatedCredits
      };

      updateUser(updatedUser);
      console.log('[USER] Updated user data:', updatedUser);
      
      // Navigate to chat with a slight delay for better UX
      setTimeout(() => {
        navigate('/chat');
      }, 800);

    } catch (error) {
      console.error('[ERROR] Error starting chat:', error);
      setValidationError('Failed to start chat. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  const handleGenderChange = (e) => {
    const value = e.target.value;
    setGender(value);
    setValidationError('');
    console.log('[FORM] Gender selected:', value);
  };

  const handlePreferredGenderChange = (e) => {
    const value = e.target.value;
    setPreferredGender(value);
    setValidationError('');
    console.log('[FORM] Preferred gender selected:', value);
  };

  const handlePremiumClick = () => {
    navigate('/premium');
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(process.env.REACT_APP_BACKEND_URL || 'https://omegle-clone-backend-production-8f06.up.railway.app');
      if (response.ok) {
        const data = await response.json();
        alert(`Server is online! 
        Active users: ${data.statistics?.activeUsers || 0}
        Server uptime: ${data.uptime || 'Unknown'}
        Version: ${data.version || 'Unknown'}`);
        setServerOnline(true);
        setOnlineUsers(data.statistics?.activeUsers || 0);
      } else {
        throw new Error('Server responded with error');
      }
    } catch (error) {
      alert('Server connection failed. Please try again later.');
      setServerOnline(false);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <Container>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <LoadingSpinner />
            Initializing...
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Title>🎥 OmegleClone</Title>
      <Subtitle>Connect with strangers around the world through video chat</Subtitle>
      
      <Card>
        <FormGroup>
          <Label>Your Gender *</Label>
          <Select value={gender} onChange={handleGenderChange} required>
            <option value="">Select Your Gender</option>
            <option value="male">♂️ Male</option>
            <option value="female">♀️ Female</option>
            <option value="other">⚧️ Other</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Partner Preference</Label>
          <Select value={preferredGender} onChange={handlePreferredGenderChange}>
            <option value="any">🌍 Any Gender (Free)</option>
            <option value="male">♂️ Male Only {!user.isPremium && `(${user.filterCredits} credits)`}</option>
            <option value="female">♀️ Female Only {!user.isPremium && `(${user.filterCredits} credits)`}</option>
            <option value="other">⚧️ Other Only {!user.isPremium && `(${user.filterCredits} credits)`}</option>
          </Select>
        </FormGroup>

        {user.isPremium ? (
          <CreditInfo>
            <span className="icon">✨</span>
            <div className="text">Premium Member</div>
            <div className="subtext">Unlimited filters & priority matching</div>
          </CreditInfo>
        ) : (
          <CreditInfo>
            <span className="icon">🎟️</span>
            <div className="text">Filter Credits: {user.filterCredits || 0}</div>
            <div className="subtext">Use credits to filter by gender preference</div>
          </CreditInfo>
        )}

        {validationError && (
          <ValidationMessage>{validationError}</ValidationMessage>
        )}

        <Button
          className="primary"
          onClick={handleStartChat}
          disabled={loading || !serverOnline}
        >
          {loading && <LoadingSpinner />}
          {loading ? 'Starting Chat...' : '🚀 Start Video Chat'}
        </Button>

        <Button
          className="secondary"
          onClick={handlePremiumClick}
          disabled={loading}
        >
          ⭐ Upgrade to Premium
        </Button>

        <Button
          className="tertiary"
          onClick={handleTestConnection}
          disabled={loading}
        >
          {loading && <LoadingSpinner />}
          🔗 Test Server Connection
        </Button>

        <FeatureList>
          <div className="feature">
            <span className="icon">🔒</span>
            <span className="text">100% Anonymous & Secure</span>
          </div>
          <div className="feature">
            <span className="icon">🌍</span>
            <span className="text">Connect Globally</span>
          </div>
          <div className="feature">
            <span className="icon">📱</span>
            <span className="text">Works on All Devices</span>
          </div>
          <div className="feature">
            <span className="icon">⚡</span>
            <span className="text">Instant Matching</span>
          </div>
          <div className="feature">
            <span className="icon">🎥</span>
            <span className="text">HD Video & Audio</span>
          </div>
          <div className="feature">
            <span className="icon">🚩</span>
            <span className="text">Report & Moderation</span>
          </div>
        </FeatureList>
      </Card>
      
      <ServerStatus online={serverOnline}>
        <span className="status-dot"></span>
        {serverOnline ? `Server Online • ${onlineUsers} users active` : 'Server Offline'}
      </ServerStatus>
    </Container>
  );
};

export default Home;
