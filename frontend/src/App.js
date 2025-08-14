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

  useEffect(() => {
    // Generate user ID on app load (no localStorage)
    generateNewUser();
  }, []);

  const generateNewUser = () => {
    const newUser = {
      id: 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now(),
      gender: null,
      preferredGender: null,
      filterCredits: 3,
      isPremium: false
    };
    setUser(newUser);
    console.log('Generated new user:', newUser.id);
  };

  const updateUser = (updatedUser) => {
    console.log('Updating user:', updatedUser);
    setUser(updatedUser);
  };

  // Reset user session (useful for testing)
  const resetUser = () => {
    generateNewUser();
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={
              <Home 
                user={user} 
                updateUser={updateUser} 
                resetUser={resetUser}
              />
            } 
          />
          <Route 
            path="/chat" 
            element={
              <VideoChat 
                user={user} 
                updateUser={updateUser} 
              />
            } 
          />
          <Route 
            path="/premium" 
            element={
              <Premium 
                user={user} 
                updateUser={updateUser} 
              />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
