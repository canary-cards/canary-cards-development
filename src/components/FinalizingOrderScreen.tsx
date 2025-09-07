import { Loader2, Lock, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Header } from './Header';

interface FinalizingOrderScreenProps {
  status: 'loading' | 'error';
  onRetry?: () => void;
}

export const FinalizingOrderScreen = ({ status, onRetry }: FinalizingOrderScreenProps) => {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (status === 'loading' && !showCheck) {
      // Show checkmark after 2 seconds, but only if we haven't shown it yet
      const timer = setTimeout(() => {
        setShowCheck(true);
      }, 2750);
      
      return () => clearTimeout(timer);
    }
  }, [status, showCheck]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <div className="text-center space-y-6 max-w-md">
        {status === 'loading' && (
          <div className="space-y-4">
            <h1 className="display-title text-primary flex items-center justify-center gap-2">
              {!showCheck ? (
                <Lock className="h-6 w-6 text-primary transition-all duration-300" />
              ) : (
                <Check className="h-6 w-6 text-primary animate-scale-in" />
              )}
              Finalizing your order…
              {!showCheck && <Loader2 className="h-5 w-5 animate-spin text-primary ml-1" />}
            </h1>
            <p className="subtitle text-muted-foreground">
              Your postcard details are on their way to be written and mailed.
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <h1 className="display-title">
              Oops! Something Went Wrong
            </h1>
            <p className="text-lg text-muted-foreground">
              There was an issue processing your postcard order. Don't worry - your payment was successful.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors button-warm"
                aria-label="Retry postcard order"
              >
                Try Again
              </button>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};