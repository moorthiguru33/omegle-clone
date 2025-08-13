import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import VideoChat from './components/VideoChat';
import Premium from './components/Premium';
import './App.css';

function App() {
  const [user, setUser] = useState({
    id: null,
    gender: null,
    preferredGender: null,
    filterCredits: 3,
    isPremium: false
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Try to get user data from sessionStorage first
        const sessionUser = sessionStorage.getItem('omegleUser');
        
        if (sessionUser) {
          const parsed = JSON.parse(sessionUser);
          if (parsed && typeof parsed === 'object' && parsed.id) {
            setUser(parsed);
          } else {
            generateNewUser();
          }
        } else {
          generateNewUser();
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        generateNewUser();
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const generateNewUser = () => {
    const newUser = {
      id: 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now(),
      gender: null,
      preferredGender: null,
      filterCredits: 3,
      isPremium: false,
      createdAt: Date.now()
    };
    
    setUser(newUser);
    
    try {
      sessionStorage.setItem('omegleUser', JSON.stringify(newUser));
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  };

  const updateUser = (updatedUser) => {
    if (!updatedUser || typeof updatedUser !== 'object') {
      console.error('Invalid user data provided');
      return;
    }

    const validatedUser = {
      ...user,
      ...updatedUser,
      id: user.id, // Ensure ID doesn't change
      updatedAt: Date.now()
    };

    setUser(validatedUser);
    
    try {
      sessionStorage.setItem('omegleUser', JSON.stringify(validatedUser));
    } catch (error) {
      console.error('Failed to save updated user data:', error);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '18px'
      }}>
        <div>
          <div className="loading-spinner" />
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={<Home user={user} updateUser={updateUser} />} 
          />
          <Route 
            path="/chat" 
            element={<VideoChat user={user} updateUser={updateUser} />} 
          />
          <Route 
            path="/premium" 
            element={<Premium user={user} updateUser={updateUser} />} 
          />
          <Route 
            path="*" 
            element={<Home user={user} updateUser={updateUser} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
