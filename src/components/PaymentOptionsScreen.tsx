import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Smartphone, CreditCard } from 'lucide-react';
import { getStripePublishableKey } from '@/lib/environment';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import { useIsMobile } from '@/hooks/use-mobile';

const stripePromise = loadStripe(getStripePublishableKey());

interface PaymentOptionsScreenProps {
  clientSecret: string;
  onBack: () => void;
  sendOption: 'single' | 'double' | 'triple';
  amount: number;
}

export function PaymentOptionsScreen({ clientSecret, onBack, sendOption, amount }: PaymentOptionsScreenProps) {
  const isMobile = useIsMobile();
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [showRegularCheckout, setShowRegularCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initializePaymentRequest = async () => {
      try {
        const stripe = await stripePromise;
        if (!stripe) return;

        const pr = stripe.paymentRequest({
          country: 'US',
          currency: 'usd',
          total: {
            label: `Postcard${sendOption === 'single' ? '' : 's'}`,
            amount: amount * 100, // Stripe uses cents
          },
          requestPayerName: true,
          requestPayerEmail: true,
        });

        // Check if Apple Pay/Google Pay is available
        const canMake = await pr.canMakePayment();
        if (canMake) {
          setPaymentRequest(pr);
          setCanMakePayment(true);

          // Handle payment method
          pr.on('paymentmethod', async (event) => {
            setIsProcessing(true);
            
            try {
              const stripe = await stripePromise;
              if (!stripe) throw new Error('Stripe not loaded');

              // Confirm payment with the payment method from Apple Pay/Google Pay
              const { error } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: event.paymentMethod.id,
              });

              if (error) {
                event.complete('fail');
                console.error('Payment failed:', error);
              } else {
                event.complete('success');
                // Payment successful - Stripe will handle the redirect via return_url
              }
            } catch (error) {
              event.complete('fail');
              console.error('Payment processing error:', error);
            } finally {
              setIsProcessing(false);
            }
          });
        }
      } catch (error) {
        console.error('Failed to initialize payment request:', error);
      }
    };

    if (clientSecret && isMobile) {
      initializePaymentRequest();
    }
  }, [clientSecret, amount, sendOption, isMobile]);

  const handleAppleGooglePay = () => {
    if (paymentRequest) {
      paymentRequest.show();
    }
  };

  const handleRegularCheckout = () => {
    setShowRegularCheckout(true);
  };

  // If showing regular checkout, render the embedded checkout
  if (showRegularCheckout) {
    return (
      <EmbeddedCheckout 
        clientSecret={clientSecret} 
        onBack={() => setShowRegularCheckout(false)} 
        sendOption={sendOption} 
        amount={amount} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-8 max-w-2xl">
        <Card className="card-warm">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Choose Payment Method</h2>
              <p className="text-muted-foreground mb-4">
                {sendOption === 'single' ? 'Single postcard package' : 
                 sendOption === 'double' ? 'Double postcard package' : 
                 'Triple postcard package'} - ${amount}
              </p>
            </div>

            <div className="space-y-4">
              {/* Apple Pay/Google Pay options for mobile */}
              {isMobile && canMakePayment && (
                <Button
                  onClick={handleAppleGooglePay}
                  disabled={isProcessing}
                  className="w-full h-14 text-lg bg-black hover:bg-gray-800 text-white"
                >
                  <Smartphone className="w-5 h-5 mr-3" />
                  {isProcessing ? 'Processing...' : 'Pay with Apple Pay / Google Pay'}
                </Button>
              )}

              {/* Regular checkout option */}
              <Button
                onClick={handleRegularCheckout}
                variant="outline"
                className="w-full h-14 text-lg"
              >
                <CreditCard className="w-5 h-5 mr-3" />
                Pay with Card
              </Button>
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}