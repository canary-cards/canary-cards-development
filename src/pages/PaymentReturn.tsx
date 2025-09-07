
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FinalizingOrderScreen } from '@/components/FinalizingOrderScreen';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/AppContext';
import { getUnitPriceCents, getTotalPriceCents } from '@/lib/pricing';

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ordering' | 'error'>('loading');
  const [orderingResults, setOrderingResults] = useState<any>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [startTime] = useState<number>(Date.now()); // Remove setStartTime since we don't update it
  const { toast } = useToast();
  const { state, dispatch } = useAppContext();

  // Enhanced validation for postcard data
  const validatePostcardData = (data: any): boolean => {
    if (!data) {
      return false;
    }
    
    // Check userInfo
    if (!data.userInfo) {
      return false;
    }
    
    if (!data.userInfo.fullName) {
      return false;
    }
    
    if (!data.userInfo.streetAddress) {
      return false;
    }
    
    // Check representative
    if (!data.representative) {
      return false;
    }
    
    if (!data.representative.name) {
      return false;
    }
    
    // Check message
    if (!data.finalMessage) {
      return false;
    }
    
    return true;
  };

  // Get postcard data from AppContext (which now auto-restores from storage)
  const getPostcardData = () => {
    if (validatePostcardData(state.postcardData)) {
      return state.postcardData;
    }
    
    return null;
  };

  const orderPostcardsWithData = async (postcardData: any) => {
    try {
      setStatus('ordering');
      
      // Simulation flags for testing (now works in production too)
      const urlParams = new URLSearchParams(window.location.search);
      const simulateFailure = urlParams.has('simulate_failure');
      const simulatedFailedCount = parseInt(urlParams.get('simulate_failed') || '1');
      
      if (!postcardData || !validatePostcardData(postcardData)) {
        // Clear any corrupted storage data
        sessionStorage.removeItem('appContextBackup');
        localStorage.removeItem('postcardData');
        
        toast({
          title: "Session expired",
          description: "Please start the postcard process again.",
          variant: "destructive",
        });
        
        setTimeout(() => {
          navigate('/onboarding');
        }, 3000);
        return;
      }
      
      let data, error;
      
      // Simulate failure for testing if flag is set
      if (simulateFailure) {
        const totalRecipients = 1 + (postcardData.sendOption === 'double' ? 1 : postcardData.sendOption === 'triple' ? 2 : 0);
        const failedCount = Math.min(simulatedFailedCount, totalRecipients);
        const successCount = totalRecipients - failedCount;
        
        console.log(`Simulating ${failedCount} failures out of ${totalRecipients} total recipients`);
        
        // Create realistic results with type and recipient info
        const allRecipients = [
          { type: 'representative', recipient: postcardData.representative?.name },
          ...(postcardData.sendOption === 'double' || postcardData.sendOption === 'triple' ? 
            (postcardData.senators || []).slice(0, postcardData.sendOption === 'double' ? 1 : 2).map(s => ({ type: 'senator', recipient: s.name })) : [])
        ];
        
        data = {
          success: failedCount === 0,
          results: allRecipients.map((r, i) => ({
            type: r.type,
            recipient: r.recipient,
            status: i < failedCount ? 'error' : 'success',
            error: i < failedCount ? 'Simulated failure for testing' : undefined,
            orderId: i >= failedCount ? `SIM-${Date.now()}-${i}` : undefined
          })),
          summary: {
            totalSent: successCount,
            totalFailed: failedCount,
            total: totalRecipients,
            sendOption: postcardData.sendOption
          }
        };
        error = null;
      } else {
        const result = await supabase.functions.invoke('send-postcard', {
          body: { postcardData }
        });
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        throw error;
      }
      
      setOrderingResults(data);
      
      // Check if any postcards failed
      const totalFailed = data.summary?.totalFailed || 0;
      const totalRecipients = data.summary?.total || data.results?.length || 1;
      
      if (totalFailed === 0) {
        // All postcards succeeded
        const elapsed = Date.now() - startTime;
        const minTime = 4000; // 4 seconds
        const remainingTime = Math.max(0, minTime - elapsed);
        
        setTimeout(() => {
          dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
          navigate('/payment-success', { 
            state: { 
              sessionId: searchParams.get('session_id'),
              orderingResults: data 
            }
          });
        }, remainingTime);
      } else {
        // Some or all postcards failed - issue partial refund
        const sessionId = searchParams.get('session_id');
        const sendOption = postcardData.sendOption;
        
        let refundAmountCents: number;
        if (totalFailed === totalRecipients) {
          // All failed - refund full amount
          refundAmountCents = getTotalPriceCents(sendOption);
        } else {
          // Partial failure - refund per failed postcard
          refundAmountCents = totalFailed * getUnitPriceCents();
        }
        
        console.log(`${totalFailed} of ${totalRecipients} postcards failed. Refunding $${refundAmountCents / 100}`);
        
        if (sessionId) {
          try {
            const { data: refundData, error: refundError } = await supabase.functions.invoke('refund-payment', {
              body: { 
                sessionId,
                amount: refundAmountCents,
                reason: `${totalFailed} postcard${totalFailed > 1 ? 's' : ''} failed to send`
              }
            });
            
            if (refundError) {
              console.error("Refund failed:", refundError);
            } else {
              console.log("Partial refund successful:", refundData);
            }
            
            dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
            navigate('/payment-refunded', {
              state: {
                failedCount: totalFailed,
                totalCount: totalRecipients,
                refundAmountCents,
                refundId: refundData?.refund_id || null,
                results: data.results || []
              }
            });
            return;
          } catch (refundError) {
            console.error("Error during partial refund process:", refundError);
          }
        }
        
        // Fallback if refund fails
        setStatus('error');
        dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
        toast({
          title: "Some postcards failed",
          description: `${totalFailed} of ${totalRecipients} postcards failed. Please contact support.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Postcard ordering failed:", error);
      
      // Full failure - refund entire amount
      const sessionId = searchParams.get('session_id');
      if (sessionId) {
        try {
          const sendOption = postcardData?.sendOption || 'single';
          const refundAmountCents = getTotalPriceCents(sendOption);
          
          console.log("Attempting full refund for total failure...");
          const { data: refundData, error: refundError } = await supabase.functions.invoke('refund-payment', {
            body: { 
              sessionId,
              amount: refundAmountCents,
              reason: "Total postcard creation failure: " + error.message 
            }
          });
          
          if (refundError) {
            console.error("Refund failed:", refundError);
          } else {
            console.log("Full refund successful:", refundData);
          }
          
          dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
          navigate('/payment-refunded', {
            state: {
              failedCount: 1,
              totalCount: 1,
              refundAmountCents,
              refundId: refundData?.refund_id || null,
              results: [{
                type: 'representative',
                recipient: postcardData?.representative?.name || 'Unknown',
                status: 'error',
                error: error.message
              }]
            }
          });
          return;
        } catch (refundError) {
          console.error("Error during refund process:", refundError);
        }
      }
      
      // Fallback if no session ID or refund fails
      setStatus('error');
      setOrderingResults({ error: error.message });
      dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
      toast({
        title: "Failed to order postcards",
        description: "Please contact support. Your payment may need to be refunded manually.",
        variant: "destructive",
      });
    }
  };

  const retryPostcardOrdering = async () => {
    setRetryAttempts(prev => prev + 1);
    const postcardData = getPostcardData();
    if (postcardData) {
      await orderPostcardsWithData(postcardData);
    }
  };

  const verifyPaymentAndOrder = async (sessionId: string) => {
    try {
      // Verify payment with Stripe
      const { data: verificationResult, error: verificationError } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId }
      });
      
      if (verificationError) {
        throw new Error('Failed to verify payment status');
      }
      
      if (!verificationResult) {
        throw new Error('No verification response received');
      }
      
      if (!verificationResult.success) {
        setStatus('error');
        toast({
          title: "Payment verification failed",
          description: "Unable to confirm payment. Please contact support.",
          variant: "destructive",
        });
        dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
        setTimeout(() => {
          navigate('/onboarding');
        }, 3000);
        return;
      }
      
      // Use postcard data from payment session metadata
      if (verificationResult.postcardData) {        
        // Update app state with the postcard data from payment session
        dispatch({ 
          type: 'UPDATE_POSTCARD_DATA', 
          payload: verificationResult.postcardData 
        });
        
        // Start ordering immediately with session data (pass data directly to avoid state timing issues)
        orderPostcardsWithData(verificationResult.postcardData);
      } else {
        setStatus('error');
        // Clear global payment loading on error
        dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
        toast({
          title: "Session data missing",
          description: "Unable to find your postcard data. Please start over.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate('/onboarding');
        }, 3000);
        return;
      }
      
    } catch (error) {
      setStatus('error');
      // Clear global payment loading on error
      dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
      toast({
        title: "Payment verification failed",
        description: "Unable to verify payment. Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      // Immediately start verification without any delay
      verifyPaymentAndOrder(sessionId);
    } else {
      setStatus('error');
      // Clear global payment loading on error
      dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
      toast({
        title: "No session found",
        description: "Please start the postcard process again.",
        variant: "destructive",
      });
      setTimeout(() => {
        navigate('/onboarding');
      }, 3000);
    }
  }, [searchParams, navigate, dispatch]);

  // Always show the FinalizingOrderScreen - no fallback card
  return (
    <FinalizingOrderScreen 
      status={status === 'ordering' ? 'loading' : status}
      onRetry={retryAttempts < 3 ? retryPostcardOrdering : undefined}
    />
  );
}
