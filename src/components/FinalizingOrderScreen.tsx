import { DynamicSvg } from './DynamicSvg';

interface FinalizingOrderScreenProps {
  status: 'loading' | 'error';
  onRetry?: () => void;
}

export const FinalizingOrderScreen = ({ status, onRetry }: FinalizingOrderScreenProps) => {
  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-2xl">
          {status === 'loading' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center space-y-6">
                <DynamicSvg 
                  assetName="onboarding_icon_4.svg"
                  className="w-32 h-32 sm:w-48 sm:h-48 md:w-54 md:h-54 lg:w-60 lg:h-60"
                  alt="Finalizing order"
                />
                <div className="text-center space-y-2">
                  <h1 className="display-title">
                    Finalizing your order…
                  </h1>
                  <p className="text-primary font-semibold">
                    Your postcard details are on their way to be written and mailed.
                  </p>
                </div>
              </div>
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
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                  aria-label="Retry postcard order"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
    </div>
  );
};