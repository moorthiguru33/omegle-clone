import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import VideoChat from './components/VideoChat';
import Premium from './components/Premium';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize user data without localStorage to prevent issues
    const initializeUser = () => {
      try {
        // Try to get from sessionStorage (session-based)
        const sessionUser = sessionStorage.getItem('omegleUser');
        
        if (sessionUser) {
          const parsed = JSON.parse(sessionUser);
          if (parsed && parsed.id) {
            setUser(parsed);
            setIsLoading(false);
            return;
          }
        }
        
        // Generate new user
        const newUser = {
          id: 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now(),
          gender: null,
          preferredGender: 'any',
          filterCredits: 3,
          isPremium: false,
          createdAt: Date.now()
        };
        
        setUser(newUser);
        
        // Save to sessionStorage (not localStorage)
        try {
          sessionStorage.setItem('omegleUser', JSON.stringify(newUser));
        } catch (error) {
          console.warn('Failed to save user data:', error);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing user:', error);
        // Fallback user
        setUser({
          id: 'user_' + Date.now(),
          gender: null,
          preferredGender: 'any',
          filterCredits: 3,
          isPremium: false,
          createdAt: Date.now()
        });
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const updateUser = (updatedUser) => {
    if (!updatedUser) return;
    
    setUser(updatedUser);
    
    try {
      sessionStorage.setItem('omegleUser', JSON.stringify(updatedUser));
    } catch (error) {
      console.warn('Failed to update user data:', error);
    }
  };

  // Show loading only briefly
  if (isLoading || !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Starting OmegleClone...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home user={user} updateUser={updateUser} />} />
          <Route path="/chat" element={<VideoChat user={user} updateUser={updateUser} />} />
          <Route path="/premium" element={<Premium user={user} updateUser={updateUser} />} />
          <Route path="*" element={<Home user={user} updateUser={updateUser} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
