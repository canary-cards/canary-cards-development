import React, { useEffect, useState, Suspense } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { DynamicSvg } from '../DynamicSvg';
import { DotLottiePlayer } from '@dotlottie/react-player';

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
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1); // Start at -1 to show initial delay
  const [displayedMessageIndex, setDisplayedMessageIndex] = useState(-1); // What message is actually shown
  const [startTime] = useState(Date.now());
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [animationError, setAnimationError] = useState(false);

  useEffect(() => {
    // Initial 300ms delay before showing first message
    const initialDelay = setTimeout(() => {
      setCurrentMessageIndex(0);
      setDisplayedMessageIndex(0);
      setShowTypewriter(true);
    }, 300);

    return () => clearTimeout(initialDelay);
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
    const draftMessage = async () => {
      try {
        const { concerns, personalImpact } = state.postcardData;
        
        if (!concerns && !personalImpact) {
          dispatch({ type: 'SET_ERROR', payload: 'Missing required information' });
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
          dispatch({ type: 'SET_ERROR', payload: `Failed to draft message: ${error.message}` });
          return;
        }

        if (!data) {
          console.error('No data in response');
          dispatch({ type: 'SET_ERROR', payload: 'No response from AI service' });
          return;
        }

        // Note: draftMessage might be empty if AI generation failed, but we still have a draftId
        if (!data.draftMessage && !data.draftId) {
          console.error('No draft message or draft ID in response:', data);
          dispatch({ type: 'SET_ERROR', payload: 'Invalid response from AI service' });
          return;
        }

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
            dispatch({
              type: 'UPDATE_POSTCARD_DATA',
              payload: {
                originalMessage: `${concerns}\n\n${personalImpact}`,
                draftMessage: data.draftMessage || '', // Empty if AI generation failed
                sources: data.sources || [],
                draftId: data.draftId // Store the draft ID for later updates
              }
            });

            console.log('🎯 DraftingScreen: Dispatched postcard data update');

            // Navigate to review screen (step 3)
            dispatch({ type: 'SET_STEP', payload: 3 });
          }, 500);
        }, remainingTime);

      } catch (error) {
        console.error('Error in drafting process:', error);
        dispatch({ type: 'SET_ERROR', payload: 'An error occurred while drafting your message' });
      }
    };

    draftMessage();

    // Set timeout for 45 seconds
    const timeout = setTimeout(() => {
      // Mark as completed and navigate to review
      setIsCompleted(true);
      setTimeout(() => {
        dispatch({ type: 'SET_STEP', payload: 3 });
      }, 500);
    }, 45000);

    return () => clearTimeout(timeout);
  }, [state.postcardData, dispatch, startTime]);

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="w-32 h-32 sm:w-48 sm:h-48 md:w-54 md:h-54 lg:w-60 lg:h-60">
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
            <h1 className="text-2xl display-title">
              Drafting your postcard
            </h1>
            
            {/* Typewriter message with smooth transition */}
            <div className="h-6 flex items-center justify-center">
              {displayedMessageIndex >= 0 && (
                <p className={`subtitle text-base transition-all duration-300 ease-in-out ${
                  showTypewriter ? 'animate-scale-in typewriter-text' : 'opacity-0 scale-95'
                }`}>
                  {draftingMessages[displayedMessageIndex]}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}