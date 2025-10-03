import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from '../context/AppContext';
import { LandingPage } from '../components/LandingPage';
import { CivicPostcardApp } from '../components/CivicPostcardApp';

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppContext();

  // Handle return to home and onboarding redirect - run ONCE on mount only
  useEffect(() => {
    const shouldSkip = location.state?.skipOnboarding;
    console.log('🔍 Index useEffect triggered:', { shouldSkip, pathname: location.pathname, search: location.search });
    
    if (shouldSkip) {
      // User returned home from onboarding - clear all data and start fresh
      console.log('🏠 User returned home from onboarding - resetting state');
      dispatch({ type: 'RESET_TO_HOME' });
    } else {
      // First visit - redirect to onboarding
      console.log('🔄 First visit - redirecting to onboarding');
      navigate('/onboarding' + location.search, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount - intentionally empty deps to prevent redirect loops

  return <CivicPostcardApp />;
};

const Index = () => {
  return <AppContent />;
};

export default Index;
