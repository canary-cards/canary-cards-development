import React, { useEffect, useState, Suspense } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { DynamicSvg } from '../DynamicSvg';
import { DotLottiePlayer } from '@dotlottie/react-player';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const draftingMessages = [
  "Polishing your message…",
  "Fitting onto a postcard…",
  "Matching with bills in Congress…",
  "Highlighting local impact…",
  "Optimizing for influence…",
  "Completing draft — amplifying your voice..."
];

export function DraftingScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  const [displayedMessageIndex, setDisplayedMessageIndex] = useState(-1);
  const [startTime] = useState(Date.now());
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [animationError, setAnimationError] = useState(false);
  const [apiCompleted, setApiCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Start immediately with no delay
    setCurrentMessageIndex(0);
    setDisplayedMessageIndex(0);
    setShowTypewriter(true);
  }, []);

  // Rotate messages every 1.5 seconds after the initial delay
  useEffect(() => {
    if (currentMessageIndex >= 0) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => {
          if (prev < draftingMessages.length - 1) {
            // First fade out current message
            setShowTypewriter(false);
            // Then update the displayed message and fade in
            setTimeout(() => {
              setDisplayedMessageIndex(prev + 1);
              setShowTypewriter(true);
            }, 200); // Faster crossfade for smoother transitions
            return prev + 1;
          }
          return prev; // Stay on last message
        });
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [currentMessageIndex]);

  // Handle the actual drafting process
  useEffect(() => {
    // Prevent multiple API calls
    if (apiCompleted) return;

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

        // Call the edge function to draft the message
        const { data, error } = await supabase.functions.invoke('draft-postcard-message', {
          body: {
            concerns,
            personalImpact,
            representative: state.postcardData.representative,
            zipCode: state.postcardData.zipCode
          }
        });

        console.log('🎯 DraftingScreen: Edge function response:', { data, error });

        if (error) {
          console.error('Error drafting message:', error);
          setApiCompleted(true);
          setHasError(true);
          toast({
            variant: "destructive",
            title: "Failed to Draft Message",
            description: error.message || "An error occurred while drafting your message.",
          });
          return;
        }

        if (!data) {
          console.error('No data in response');
          setApiCompleted(true);
          setHasError(true);
          toast({
            variant: "destructive",
            title: "No Response",
            description: "No response from AI service. Please try again.",
          });
          return;
        }

        // Note: draftMessage might be empty if AI generation failed, but we still have a draftId
        if (!data.draftMessage && !data.draftId) {
          console.error('No draft message or draft ID in response:', data);
          setApiCompleted(true);
          setHasError(true);
          toast({
            variant: "destructive",
            title: "Invalid Response",
            description: "Invalid response from AI service. Please try again.",
          });
          return;
        }

        // Mark API as completed successfully
        setApiCompleted(true);

        // Ensure minimum 1 second dwell time
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1000 - elapsedTime);

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
        setApiCompleted(true);
        setHasError(true);
        toast({
          variant: "destructive",
          title: "Error Occurred",
          description: "An unexpected error occurred while drafting your message.",
        });
      }
    };

    draftMessage();

    // Set timeout for 60 seconds (1 minute)
    const timeout = setTimeout(() => {
      if (!apiCompleted) {
        console.error('Timeout: API call did not complete within 60 seconds');
        setHasError(true);
        toast({
          variant: "destructive",
          title: "Request Timeout",
          description: "The request took too long. Please try again.",
        });
      }
    }, 60000);

    return () => clearTimeout(timeout);
  }, [dispatch, startTime, apiCompleted, toast]);

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
                We couldn't draft your postcard. Please try again.
              </p>
            </div>
            <Button onClick={handleRetry} size="lg">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72">
              {!animationError ? (
                <Suspense fallback={
                  <div className="w-full h-full bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
                    <div className="w-3/4 h-3/4 bg-primary/20 rounded-full" />
                  </div>
                }>
                  <DotLottiePlayer
                    src="/assets/writing-animation.json"
                    autoplay
                    loop
                    className="w-full h-full"
                    onError={() => setAnimationError(true)}
                  />
                </Suspense>
              ) : (
                <DynamicSvg 
                  assetName="onboarding_icon_2.svg"
                  alt="Canary research process"
                  className="w-full h-full"
                />
              )}
            </div>
            <div className="text-center space-y-3">
              <h1 className="display-title">
                Drafting your postcard
              </h1>
              
              {/* Typewriter message with smooth transition */}
              <div className="h-6 flex items-center justify-center">
                {displayedMessageIndex >= 0 && (
                  <p className={`text-base font-semibold text-primary transition-all duration-300 ease-in-out ${
                    showTypewriter ? 'animate-scale-in typewriter-text' : 'opacity-0 scale-95'
                  }`}>
                    {draftingMessages[displayedMessageIndex]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}