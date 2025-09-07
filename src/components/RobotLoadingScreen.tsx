import { AlertCircle } from 'lucide-react';

interface RobotLoadingScreenProps {
  status: 'loading' | 'error';
  message?: string;
  onRetry?: () => void;
}

export const RobotLoadingScreen = ({ status, message, onRetry }: RobotLoadingScreenProps) => {
  const staticMessage = "Your payment went through. Our robots are picking up their pens. This only takes a few seconds.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10 flex items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-md">
        {/* Static Icon */}
        <div className="flex justify-center">
          {status === 'loading' && (
            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center border-4 border-primary/20">
              <img 
                src="/smallonboarding2.svg" 
                alt="Processing" 
                className="w-20 h-20" 
              />
            </div>
          )}
          
          
          {status === 'error' && (
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center border-4 border-red-200 shake">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          )}
        </div>

        {/* Status Messages */}
        <div className="space-y-4">
          <h1 className="display-title text-primary">
            {status === 'loading' && "We're writing your postcard..."}
            {status === 'error' && "Oops! Something Went Wrong"}
          </h1>
          
          <div className="space-y-2">
            {status === 'loading' && (
              <p className="body-text text-muted-foreground">
                {staticMessage}
              </p>
            )}
            
            
            {status === 'error' && (
              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">
                  {message || "There was an issue processing your postcard order. Don't worry - your payment was successful."}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors button-warm"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fun Fact Card */}
        {status === 'loading' && (
          <div className="bg-card/80 backdrop-blur-sm rounded-xl p-4 card-warm">
            <div className="space-y-2">
              <p className="eyebrow text-accent-foreground">Did you know?</p>
              <p className="text-sm text-muted-foreground">
                Our robots use real pens so your card looks just like one you'd write yourself.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};