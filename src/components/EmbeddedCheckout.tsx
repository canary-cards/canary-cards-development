import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';

const stripePromise = loadStripe('pk_test_51Rm04GLqBC9dKThjLjUe7M1Cd8oIgW3IAFBwI1QYk3GsoBLUCu9SfW79On3wjkvst8OJtKpyLPhwjtyqBtonVg5O00BztMUEXj');

// Global instance tracker to prevent multiple embedded checkouts
let globalCheckoutInstance: any = null;
let isInitializing = false;

interface EmbeddedCheckoutProps {
  clientSecret: string;
  onBack: () => void;
  sendOption: 'single' | 'double' | 'triple';
  amount: number;
}

export function EmbeddedCheckout({ clientSecret, onBack, sendOption, amount }: EmbeddedCheckoutProps) {
  const [checkout, setCheckout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let checkoutInstance: any = null;

    // Force scroll to top when component mounts
    window.scrollTo(0, 0);

    // Prevent auto-scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const initializeCheckout = async () => {
      try {
        console.log('EmbeddedCheckout: Starting initialization with clientSecret:', clientSecret ? 'present' : 'missing');
        
        // Prevent multiple simultaneous initializations
        if (isInitializing) {
          console.log('EmbeddedCheckout: Already initializing, aborting');
          return;
        }
        isInitializing = true;
        
        // Clean up any existing global instance first
        if (globalCheckoutInstance) {
          console.log('EmbeddedCheckout: Cleaning up existing global instance');
          try {
            await globalCheckoutInstance.unmount();
            globalCheckoutInstance.destroy?.();
          } catch (error) {
            console.log('EmbeddedCheckout: Error cleaning up global instance:', error);
          }
          globalCheckoutInstance = null;
          
          // Wait for cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Also clear any existing Stripe elements from DOM
        const existingElements = document.querySelectorAll('[data-testid="embedded-checkout"]');
        existingElements.forEach(el => el.remove());
        
        if (!clientSecret) {
          throw new Error('Client secret is missing');
        }

        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }
        console.log('EmbeddedCheckout: Stripe loaded successfully');

        // Only proceed if component is still mounted
        if (!isMounted) {
          console.log('EmbeddedCheckout: Component unmounted, aborting initialization');
          return;
        }

        console.log('EmbeddedCheckout: Initializing embedded checkout...');
        checkoutInstance = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            console.log('EmbeddedCheckout: Payment completed successfully!');
            // The return_url in the session will handle the redirect
            // No need to manually redirect here as Stripe handles it
          }
        });
        console.log('EmbeddedCheckout: Checkout instance created successfully');

        // Only proceed if component is still mounted
        if (!isMounted) {
          console.log('EmbeddedCheckout: Component unmounted after creation, cleaning up');
          if (checkoutInstance) {
            checkoutInstance.unmount();
          }
          return;
        }

        // Store in both local and global references
        setCheckout(checkoutInstance);
        globalCheckoutInstance = checkoutInstance;
        isInitializing = false;
        setLoading(false);
        
        // Mount after state is updated and component re-renders
        setTimeout(() => {
          if (!isMounted || !checkoutInstance) {
            console.log('EmbeddedCheckout: Component unmounted or no instance, skipping mount');
            return;
          }
          
          const checkoutElement = document.getElementById('embedded-checkout');
          if (checkoutElement) {
            checkoutInstance.mount('#embedded-checkout');
            console.log('EmbeddedCheckout: Checkout mounted to DOM');
          } else {
            console.error('EmbeddedCheckout: Mount element not found after render');
            setError('Failed to mount payment form');
          }
        }, 50);
        
      } catch (err: any) {
        console.error('EmbeddedCheckout: Failed to initialize Stripe checkout:', err);
        isInitializing = false;
        if (isMounted) {
          setError(`Failed to load payment form: ${err.message}`);
          setLoading(false);
        }
      }
    };

    console.log('EmbeddedCheckout: useEffect triggered, clientSecret:', clientSecret ? 'present' : 'missing');
    if (clientSecret) {
      initializeCheckout();
      
      // Set up a fallback timeout in case embedded checkout fails silently
      const fallbackTimeout = setTimeout(() => {
        if (isMounted && loading) {
          console.log('EmbeddedCheckout: Timeout reached, showing fallback option');
          setShowFallback(true);
        }
      }, 15000); // 15 seconds
      
      return () => {
        clearTimeout(fallbackTimeout);
        isMounted = false;
        isInitializing = false;
        
        // Clean up local instance
        if (checkoutInstance) {
          console.log('EmbeddedCheckout: Unmounting checkout instance');
          try {
            checkoutInstance.unmount();
            checkoutInstance.destroy?.(); // Call destroy if available
          } catch (error) {
            console.log('EmbeddedCheckout: Error unmounting checkout:', error);
          }
          checkoutInstance = null;
        }
        
        // Clean up state instance if different
        if (checkout && checkout !== checkoutInstance) {
          console.log('EmbeddedCheckout: Unmounting stored checkout instance');
          try {
            checkout.unmount();
            checkout.destroy?.(); // Call destroy if available
          } catch (error) {
            console.log('EmbeddedCheckout: Error unmounting stored checkout:', error);
          }
        }
        
        // Clear global instance if it matches this component's instance
        if (globalCheckoutInstance === checkoutInstance || globalCheckoutInstance === checkout) {
          console.log('EmbeddedCheckout: Clearing global checkout instance');
          globalCheckoutInstance = null;
        }
      };
    } else {
      console.log('EmbeddedCheckout: No clientSecret provided, skipping initialization');
      setError('No payment session provided');
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }
  }, [clientSecret]); // Removed 'loading' dependency to prevent loops

  if (loading) {
    return (
      <Card className="card-warm">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">Loading Payment Form...</h2>
            <h3 className="subtitle text-base">Setting up secure payment for your postcards</h3>
            {showFallback && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Payment form is taking longer than expected.
                </p>
                <Button onClick={onBack} variant="outline" size="sm">
                  Go Back and Try Again
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="card-warm">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <div className="text-destructive text-2xl">⚠️</div>
            <h2 className="text-xl font-semibold">Payment Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={onBack} variant="secondary" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" style={{ scrollBehavior: 'auto' }}>
      <Card className="card-warm">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Complete Your Payment</h2>
            <p className="text-muted-foreground mb-4">
              {sendOption === 'single' ? 'Single postcard package' : 
               sendOption === 'double' ? 'Double postcard package' : 
               'Triple postcard package'} - ${amount}
            </p>
          </div>
          
          {/* Stripe Embedded Checkout will mount here */}
          <div 
            id="embedded-checkout" 
            className="min-h-[500px] w-full"
          />
          
          <div className="mt-6 pt-4 border-t">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onBack}
              className="button-warm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Review
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}