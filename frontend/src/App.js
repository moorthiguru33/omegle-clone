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
    filterCredits: 1,
    isPremium: false
  });

  useEffect(() => {
    // Load user data from localStorage
    const savedUser = localStorage.getItem('omegleUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Generate new user ID
      const newUser = {
        id: Math.random().toString(36).substring(7),
        gender: null,
        preferredGender: null,
        filterCredits: 1,
        isPremium: false
      };
      setUser(newUser);
      localStorage.setItem('omegleUser', JSON.stringify(newUser));
    }
  }, []); // Fixed: Empty dependency array is correct here

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('omegleUser', JSON.stringify(updatedUser));
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home user={user} updateUser={updateUser} />} />
          <Route path="/chat" element={<VideoChat user={user} updateUser={updateUser} />} />
          <Route path="/premium" element={<Premium user={user} updateUser={updateUser} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
