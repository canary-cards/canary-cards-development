import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Header } from './Header';
import { ProgressIndicator } from './ProgressIndicator';
import { LandingScreen } from './screens/LandingScreen';
import { ReturnAddressScreen } from './screens/ReturnAddressScreen';
import { CraftMessageScreen } from './screens/CraftMessageScreen';
import { ReviewEditScreen } from './screens/ReviewEditScreen';
import { ReviewCardScreen } from './screens/ReviewCardScreen';
import { CheckoutScreen } from './screens/CheckoutScreen';
import { SuccessScreen } from './screens/SuccessScreen';
import { DraftingScreen } from './screens/DraftingScreen';
import { Logo } from './Logo';
import { EmailTestButton } from './EmailTestButton';

export function CivicPostcardApp() {
  const { state } = useAppContext();
  
  console.log('🎯 CivicPostcardApp rendering - currentStep:', state.currentStep);
  
  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.currentStep]);

  // Handle body background for drafting screen
  useEffect(() => {
    if (state.currentStep === 7) {
      document.body.style.backgroundColor = 'hsl(var(--primary))';
    } else {
      document.body.style.backgroundColor = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [state.currentStep]);

  const renderCurrentScreen = () => {
    switch (state.currentStep) {
      case 1:
        return <LandingScreen />;
      case 2:
        return <CraftMessageScreen />;
      case 3:
        return <ReviewEditScreen />;
      case 4:
        return <ReturnAddressScreen />;
      case 5:
        return <ReviewCardScreen />;
      case 6:
        return <CheckoutScreen />;
      case 7:
        return <DraftingScreen />;
      case 8:
        return <SuccessScreen />;
      default:
        return <LandingScreen />;
    }
  };

  return (
    <div className={`civic-postcard-app ${state.currentStep === 7 ? 'bg-primary' : ''}`}>
      {/* Header - show on all pages */}
      <Header isDark={state.currentStep === 7} />
      
      {/* Standard spacing after header */}
      <div className={`pt-3 ${state.currentStep === 7 ? 'bg-primary' : ''}`}>
        {/* Progress bar - show on all screens after onboarding, except drafting screen */}
        {state.currentStep !== 7 && (
          <div className="px-4 pb-4">
            <ProgressIndicator currentStep={state.currentStep} totalSteps={7} />
          </div>
        )}
        
        {/* Content */}
        <div className={state.currentStep === 7 ? 'bg-primary' : ''}>
          {renderCurrentScreen()}
        </div>
      </div>
    </div>
  );
}