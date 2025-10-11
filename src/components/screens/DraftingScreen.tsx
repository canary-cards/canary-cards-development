import React, { useEffect, useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { captureEdgeFunctionError } from '@/lib/errorTracking';
import { CrossfadeLottie } from '../lottie/CrossfadeLottie';
import posthog from 'posthog-js';

const draftingMessages = [
  "Synthesizing your concerns",
  "Researching trusted local sources",
  "Polishing your message",
  "Completing draft — amplifying your voice"
];

export function DraftingScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [startTime] = useState(Date.now());
  const [showTypewriter, setShowTypewriter] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [apiCompleted, setApiCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(draftingMessages[0]);
  const hasDraftedRef = useRef(false);
  
  // Track page view when component mounts
  useEffect(() => {
    if (posthog.__loaded) {
      posthog.capture('view_drafting_screen', {
        has_concerns: !!state.postcardData.concerns,
        has_personal_impact: !!state.postcardData.personalImpact,
        representative: state.postcardData.representative?.name,
        zip_code: state.postcardData.zipCode,
        step: 'drafting'
      });
    }
  }, []);

  // Update message based on current animation
  useEffect(() => {
    const messageIndex = currentAnimationIndex;
    const newMessage = draftingMessages[messageIndex] || draftingMessages[draftingMessages.length - 1];
    
    if (newMessage !== currentMessage) {
      // Start fade out
      setShowTypewriter(false);
      
      // Change text at midpoint of fade (400ms into 800ms transition)
      setTimeout(() => {
        setCurrentMessage(newMessage);
        // Start fade in
        setShowTypewriter(true);
      }, 400);
    }
  }, [currentAnimationIndex, currentMessage]);

  // Handle the actual drafting process
  useEffect(() => {
    // Guard: prevent duplicate calls
    if (hasDraftedRef.current) {
      console.log('⚠️ Draft already initiated, skipping duplicate call');
      return;
    }
    
    hasDraftedRef.current = true;
    console.log('✅ Initiating draft process (first and only call)');
    
    const draftMessage = async () => {
      try {
        const { concerns, personalImpact } = state.postcardData;
        
        if (!concerns && !personalImpact) {
          setHasError(true);
          toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please provide your concerns or personal impact.",
          });
          return;
        }

        console.log('🎯 DraftingScreen: Calling draft-postcard-message with:', {
          concerns,
          personalImpact,
          representative: state.postcardData.representative,
          zipCode: state.postcardData.zipCode
        });

        // Capture ref parameter from URL for tracking
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref') || undefined;

        // Call the edge function to draft the message
        const { data, error } = await supabase.functions.invoke('draft-postcard-message', {
          body: {
            concerns,
            personalImpact,
            representative: state.postcardData.representative,
            zipCode: state.postcardData.zipCode,
            inviteCode: refCode
          }
        });

        console.log('🎯 DraftingScreen: Edge function response:', { data, error });

        if (error) {
          console.error('Error drafting message:', error);
          captureEdgeFunctionError(error, 'draft-postcard-message', {
            email: state.postcardData?.email,
            zipCode: state.postcardData.zipCode,
            representative: state.postcardData.representative?.name,
            step: 'drafting',
            hasConcerns: !!concerns,
            hasPersonalImpact: !!personalImpact
          });
          setApiCompleted(true);
          setHasError(true);
          return;
        }

        if (!data) {
          console.error('No data in response');
          setApiCompleted(true);
          setHasError(true);
          return;
        }

        // Note: draftMessage might be empty if AI generation failed, but we still have a draftId
        if (!data.draftMessage && !data.draftId) {
          console.error('No draft message or draft ID in response:', data);
          setApiCompleted(true);
          setHasError(true);
          return;
        }

        // Mark API as completed successfully
        setApiCompleted(true);

        // Check if timeout already occurred - ignore late responses
        if (hasError) {
          console.log('⏱️ Ignoring late response - timeout already occurred');
          return;
        }

        // Ensure minimum 15.5 second display time for better UX
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 15500 - elapsedTime);

        setTimeout(() => {
          // Log the data for debugging
          console.log('🎯 DraftingScreen: Received data from edge function:', data);
          console.log('🎯 DraftingScreen: Draft message:', data.draftMessage);
          console.log('🎯 DraftingScreen: Sources:', data.sources);
          
          // Mark as completed to finish the progress animation
          setIsCompleted(true);
          
          // Wait a brief moment for the animation to complete
          setTimeout(() => {
            // Update the postcard data with the drafted message and draft ID
            console.log('🎯 DraftingScreen: isFallbackPlaceholder flag:', data.isFallbackPlaceholder);
            dispatch({
              type: 'UPDATE_POSTCARD_DATA',
              payload: {
                originalMessage: `${concerns}\n\n${personalImpact}`,
                draftMessage: data.draftMessage || '', // Empty if AI generation failed
                sources: data.sources || [],
                draftId: data.draftId, // Store the draft ID for later updates
                isFallbackPlaceholder: data.isFallbackPlaceholder || false // Flag for fallback messages
              }
            });

            console.log('🎯 DraftingScreen: Dispatched postcard data update');

            // Navigate to review screen (step 3)
            dispatch({ type: 'SET_STEP', payload: 3 });
          }, 500);
        }, remainingTime);

      } catch (error) {
        console.error('Error in drafting process:', error);
        captureEdgeFunctionError(error, 'draft-postcard-message', {
          email: state.postcardData?.email,
          zipCode: state.postcardData.zipCode,
          representative: state.postcardData.representative?.name,
          step: 'drafting',
          hasConcerns: !!state.postcardData.concerns,
          hasPersonalImpact: !!state.postcardData.personalImpact,
          errorContext: 'catch_block'
        });
        setApiCompleted(true);
        setHasError(true);
      }
    };

    draftMessage();

    // Set timeout for 60 seconds (1 minute)
    const timeout = setTimeout(() => {
      if (!apiCompleted) {
        console.error('⏱️ Timeout: Request took too long, showing fallback placeholder');
        setApiCompleted(true);
        setHasError(true);
        
        // Set the fallback placeholder message and navigate to review (no toast error)
        setTimeout(() => {
          dispatch({
            type: 'UPDATE_POSTCARD_DATA',
            payload: {
              originalMessage: `${state.postcardData.concerns}\n\n${state.postcardData.personalImpact}`,
              draftMessage: "Canary just returned from a long flight and needs a moment to catch its breath Please write your message below, and we'll make sure it reaches your representative",
              sources: [],
              draftId: undefined, // No draft ID since we timed out
              isFallbackPlaceholder: true // This flag makes it show as placeholder
            }
          });
          
          // Navigate to review screen
          dispatch({ type: 'SET_STEP', payload: 3 });
        }, 500);
      }
    }, 60000);

    return () => clearTimeout(timeout);
  }, []); // Empty array: run once on mount only

  const handleRetry = () => {
    // Navigate back to the craft message screen
    dispatch({ type: 'SET_STEP', payload: 2 });
  };

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        {hasError ? (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <div className="text-center space-y-3">
              <h1 className="display-title">
                Something went wrong
              </h1>
              <p className="text-base text-muted-foreground">
                We couldn't draft your postcard Please try again
              </p>
            </div>
            <Button onClick={handleRetry} size="lg">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <CrossfadeLottie onAnimationChange={(index) => setCurrentAnimationIndex(index)} />
            <div className="text-center space-y-3">
              <h1 className="display-title">
                Drafting your postcard
              </h1>
              
              {/* Typewriter message with smooth transition */}
              <div className="h-6 flex items-center justify-center">
                <p className={`text-base font-semibold text-primary transition-opacity duration-[800ms] ${
                  showTypewriter ? 'opacity-100' : 'opacity-0'
                }`}>
                  {currentMessage}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}