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
    // Generate user ID on app load
    initializeUser();
  }, []);

  const initializeUser = () => {
    try {
      console.log('[APP] Initializing new user...');
      
      const newUser = {
        id: generateUserId(),
        gender: null,
        preferredGender: null,
        filterCredits: 3, // Free users get 3 filter credits
        isPremium: false,
        sessionStarted: Date.now(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };
      
      setUser(newUser);
      setIsLoading(false);
      
      console.log('[SUCCESS] User initialized:', newUser.id);
    } catch (error) {
      console.error('[ERROR] Failed to initialize user:', error);
      setIsLoading(false);
    }
  };

  const generateUserId = () => {
    // Generate a more robust user ID
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const sessionPart = Math.random().toString(36).substring(2, 8);
    return `user_${timestamp}_${randomPart}_${sessionPart}`;
  };

  const updateUser = (updatedUser) => {
    try {
      console.log('[APP] Updating user data:', updatedUser);
      
      // Validate user data before updating
      if (!updatedUser.id) {
        console.error('[ERROR] Invalid user data: missing ID');
        return;
      }

      // Ensure user always has required fields
      const validatedUser = {
        ...user,
        ...updatedUser,
        id: updatedUser.id || user.id,
        filterCredits: Math.max(0, updatedUser.filterCredits || 0),
        isPremium: Boolean(updatedUser.isPremium),
        lastUpdated: Date.now()
      };

      setUser(validatedUser);
      console.log('[SUCCESS] User data updated successfully');
    } catch (error) {
      console.error('[ERROR] Failed to update user:', error);
    }
  };

  // Reset user session (useful for testing or logout)
  const resetUser = () => {
    console.log('[APP] Resetting user session...');
    setIsLoading(true);
    
    // Small delay to show loading state
    setTimeout(() => {
      initializeUser();
    }, 500);
  };

  // Add credits to user (for testing or admin purposes)
  const addCredits = (amount = 5) => {
    if (user) {
      const updatedUser = {
        ...user,
        filterCredits: user.filterCredits + amount
      };
      updateUser(updatedUser);
      console.log(`[CREDITS] Added ${amount} credits to user`);
    }
  };

  // Premium upgrade function
  const upgradeToPremium = (subscriptionData = {}) => {
    if (user) {
      const updatedUser = {
        ...user,
        isPremium: true,
        filterCredits: 999, // Unlimited credits for premium
        subscriptionId: subscriptionData.subscriptionId || `premium_${Date.now()}`,
        subscriptionStarted: Date.now(),
        ...subscriptionData
      };
      updateUser(updatedUser);
      console.log('[PREMIUM] User upgraded to premium');
    }
  };

  // Error boundary for the app
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Global error handler
    const handleError = (event) => {
      console.error('[GLOBAL ERROR]', event.error);
      setError(event.error);
      setHasError(true);
    };

    const handleUnhandledRejection = (event) => {
      console.error('[UNHANDLED REJECTION]', event.reason);
      setError(event.reason);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading OmegleClone...</div>
      </div>
    );
  }

  // Error screen
  if (hasError) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h1>⚠️ Something went wrong</h1>
          <p>We encountered an unexpected error. Please refresh the page to try again.</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            🔄 Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details className="error-details">
              <summary>Error Details (Development)</summary>
              <pre>{error?.toString() || 'Unknown error'}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {/* Debug panel for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-panel">
            <button onClick={() => console.log('Current user:', user)}>Log User</button>
            <button onClick={() => addCredits(5)}>Add 5 Credits</button>
            <button onClick={() => upgradeToPremium()}>Test Premium</button>
            <button onClick={resetUser}>Reset User</button>
          </div>
        )}

        <Routes>
          <Route 
            path="/" 
            element={
              <Home 
                user={user} 
                updateUser={updateUser} 
                resetUser={resetUser}
                addCredits={addCredits}
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
                upgradeToPremium={upgradeToPremium}
              />
            } 
          />
          {/* 404 page */}
          <Route 
            path="*" 
            element={
              <div className="not-found">
                <h1>404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <button onClick={() => window.location.href = '/'}>
                  🏠 Go Home
                </button>
              </div>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
