import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from '../context/AppContext';
import { LandingPage } from '../components/LandingPage';
import { CivicPostcardApp } from '../components/CivicPostcardApp';

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppContext();
  const [isRedirecting, setIsRedirecting] = React.useState(true);

  // Handle return to home and onboarding redirect
  useEffect(() => {
    const shouldSkip = location.state?.skipOnboarding;
    console.log('🔍 Index useEffect triggered:', { shouldSkip, pathname: location.pathname, search: location.search });
    
    if (shouldSkip) {
      // User returned home from onboarding - clear all data and start fresh
      console.log('🏠 User returned home from onboarding - resetting state');
      dispatch({ type: 'RESET_TO_HOME' });
      setIsRedirecting(false);
    } else {
      // First visit - redirect to onboarding immediately
      console.log('🔄 First visit - redirecting to onboarding');
      navigate('/onboarding' + location.search, { replace: true });
    }
  }, [navigate, location.search, location.state?.skipOnboarding, dispatch]);

  // Don't render content while redirecting to prevent flash
  if (isRedirecting && !location.state?.skipOnboarding) {
    return <div className="min-h-screen bg-background" />;
  }

  return <CivicPostcardApp />;
};

const Index = () => {
  return <AppContent />;
};

export default Index;
