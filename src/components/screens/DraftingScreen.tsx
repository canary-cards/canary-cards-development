import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { DynamicSvg } from '../DynamicSvg';

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

  // Initial delay then start rotating messages
  useEffect(() => {
    // Initial 1.5s delay before showing first message
    const initialDelay = setTimeout(() => {
      setCurrentMessageIndex(0);
      setDisplayedMessageIndex(0);
      setShowTypewriter(true);
    }, 1500);

    return () => clearTimeout(initialDelay);
  }, []);

  // Rotate messages every 2 seconds after the initial delay
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
            }, 300); // Half the transition duration for smooth crossfade
            return prev + 1;
          }
          return prev; // Stay on last message
        });
      }, 2000);

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

        // Call the edge function to draft the message
        const { data, error } = await supabase.functions.invoke('draft-postcard-message', {
          body: {
            concerns,
            personalImpact,
            representative: state.postcardData.representative,
            zipCode: state.postcardData.zipCode
          }
        });

        if (error) {
          console.error('Error drafting message:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to draft message' });
          return;
        }

        if (!data?.draftMessage) {
          console.error('No draft message in response:', data);
          dispatch({ type: 'SET_ERROR', payload: 'No draft message received from AI' });
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
          
          // Update the postcard data with the drafted message
          dispatch({
            type: 'UPDATE_POSTCARD_DATA',
            payload: {
              originalMessage: `${concerns}\n\n${personalImpact}`,
              draftMessage: data.draftMessage,
              sources: data.sources || []
            }
          });

          console.log('🎯 DraftingScreen: Dispatched postcard data update');

          // Navigate to review screen (step 3)
          dispatch({ type: 'SET_STEP', payload: 3 });
        }, remainingTime);

      } catch (error) {
        console.error('Error in drafting process:', error);
        dispatch({ type: 'SET_ERROR', payload: 'An error occurred while drafting your message' });
      }
    };

    draftMessage();

    // Set timeout for 45 seconds
    const timeout = setTimeout(() => {
      // If still on this screen after 45 seconds, navigate to review
      dispatch({ type: 'SET_STEP', payload: 3 });
    }, 45000);

    return () => clearTimeout(timeout);
  }, [state.postcardData, dispatch, startTime]);

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] flex items-center justify-center bg-primary px-4">
      <div className="text-center space-y-8 max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center space-y-6">
          <DynamicSvg 
            assetName="onboarding-icon-2-v4"
            alt="Canary research process"
            className="w-32 h-32 sm:w-48 sm:h-48 md:w-54 md:h-54 lg:w-60 lg:h-60 pen-nib-glow"
          />
          <div className="flex items-center justify-center space-x-3">
            {/* Progress writing bar synced with message timing */}
            <div className="w-8 h-1 bg-background/20 rounded-full overflow-hidden">
              <div 
                key={currentMessageIndex} 
                className="h-full bg-accent rounded-full writing-progress"
              ></div>
            </div>
            <h1 className="text-2xl font-semibold text-background">
              Drafting your postcard
            </h1>
          </div>
        </div>
        
        {/* Typewriter message with smooth transition */}
        <div className="h-8 flex items-center justify-center">
          {displayedMessageIndex >= 0 && (
            <p className={`text-lg text-background/80 transition-all duration-300 ease-in-out ${
              showTypewriter ? 'animate-scale-in typewriter-text' : 'opacity-0 scale-95'
            }`}>
              {draftingMessages[displayedMessageIndex]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}