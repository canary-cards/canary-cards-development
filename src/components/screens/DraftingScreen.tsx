import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../integrations/supabase/client';
import { DynamicSvg } from '../DynamicSvg';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { captureEdgeFunctionError } from '@/lib/errorTracking';

// Type declaration for lottie-player custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        autoplay?: boolean;
        loop?: boolean;
        speed?: string;
        background?: string;
      };
    }
  }
}

// Load lottie-player web component
if (typeof window !== 'undefined' && !customElements.get('lottie-player')) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
  script.async = true;
  document.head.appendChild(script);
}

// CDN-hosted animations for better load times
const animationUrls = [
  "https://cdn.lottielab.com/l/DpA7DrGV7NdExu.json",
  "https://cdn.lottielab.com/l/2hxdso7kaDCFVy.json", // Transition animation
  "https://cdn.lottielab.com/l/2FdfJEUKxUWhCF.json",
  "https://cdn.lottielab.com/l/3Q5fRmtNUXVCDz.json"
];

const draftingMessages = [
  "Synthesizing your concerns.",
  "Researching trusted local sources.",
  "Polishing your message.",
  "Completing draft — amplifying your voice."
];

export function DraftingScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const [layerAAnimationIndex, setLayerAAnimationIndex] = useState(0);
  const [layerBAnimationIndex, setLayerBAnimationIndex] = useState(0); // Start same as A, will change on first transition
  const [layerAVisible, setLayerAVisible] = useState(true);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [startTime] = useState(Date.now());
  const [showTypewriter, setShowTypewriter] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [animationError, setAnimationError] = useState(false);
  const [apiCompleted, setApiCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [animation3LoopCount, setAnimation3LoopCount] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(draftingMessages[0]);
  const hasDraftedRef = useRef(false);
  const transitionInProgress = useRef(false);

  // Update message based on current animation
  useEffect(() => {
    // Map animation indices to message indices (skip message for transition animation at index 1)
    const messageIndex = currentAnimationIndex === 0 ? 0 
                       : currentAnimationIndex === 1 ? 0 // Keep first message during transition
                       : currentAnimationIndex === 2 ? 1 
                       : currentAnimationIndex === 3 && animation3LoopCount >= 3 ? 3 
                       : 2;
    
    const newMessage = draftingMessages[messageIndex];
    
    // Only animate transition if message actually changed
    if (newMessage !== currentMessage) {
      setShowTypewriter(false);
      setTimeout(() => {
        setCurrentMessage(newMessage);
        setShowTypewriter(true);
      }, 200);
    }
  }, [currentAnimationIndex, animation3LoopCount, currentMessage]);

  // For animation 4 (final), count loops (but don't trigger animation on every loop)
  useEffect(() => {
    if (currentAnimationIndex === 3) {
      const interval = setInterval(() => {
        setAnimation3LoopCount(prev => prev + 1);
      }, 3000); // Animation duration

      return () => clearInterval(interval);
    }
  }, [currentAnimationIndex]);

  // Smooth crossfade transition between animations
  const transitionToAnimation = (targetIndex: number) => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;

    console.log(`🎬 Transitioning from animation ${currentAnimationIndex} to ${targetIndex}, active layer: ${activeLayer}`);

    if (activeLayer === 'A') {
      // Layer A is currently visible
      // Load next animation into Layer B (hidden), then crossfade to it
      setLayerBAnimationIndex(targetIndex);
      
      // Delay to ensure Layer B fully loads the new animation before crossfading
      setTimeout(() => {
        setLayerAVisible(false); // Crossfade to Layer B
        setActiveLayer('B');
        setCurrentAnimationIndex(targetIndex);
        transitionInProgress.current = false;
      }, 150);
    } else {
      // Layer B is currently visible
      // Load next animation into Layer A (hidden), then crossfade to it
      setLayerAAnimationIndex(targetIndex);
      
      // Delay to ensure Layer A fully loads the new animation before crossfading
      setTimeout(() => {
        setLayerAVisible(true); // Crossfade to Layer A
        setActiveLayer('A');
        setCurrentAnimationIndex(targetIndex);
        transitionInProgress.current = false;
      }, 150);
    }
  };

  // Sequential animation timing: first (6s) -> transition (2s) -> second (8s) -> third (stays until complete)
  useEffect(() => {
    // Show first animation for 6 seconds
    const firstTimeout = setTimeout(() => {
      transitionToAnimation(1); // Transition animation
      
      // Show transition for 2 seconds
      const transitionTimeout = setTimeout(() => {
        transitionToAnimation(2); // Second animation
        
        // Show second animation for 8 seconds, then switch to third
        const secondTimeout = setTimeout(() => {
          transitionToAnimation(3); // Final animation
        }, 8000);
        
        return () => clearTimeout(secondTimeout);
      }, 2000);
      
      return () => clearTimeout(transitionTimeout);
    }, 6000);

    return () => clearTimeout(firstTimeout);
  }, []);

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

        // Check if timeout already occurred - ignore late responses
        if (hasError) {
          console.log('⏱️ Ignoring late response - timeout already occurred');
          return;
        }

        // Ensure minimum 20 second display time for better UX
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 20000 - elapsedTime);

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
        console.error('⏱️ Timeout: Request took too long, showing fallback placeholder');
        setApiCompleted(true);
        setHasError(true);
        
        // Set the fallback placeholder message and navigate to review (no toast error)
        setTimeout(() => {
          dispatch({
            type: 'UPDATE_POSTCARD_DATA',
            payload: {
              originalMessage: `${state.postcardData.concerns}\n\n${state.postcardData.personalImpact}`,
              draftMessage: "Canary just returned from a long flight and needs a moment to catch its breath. Please write your message below, and we'll make sure it reaches your representative.",
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
                We couldn't draft your postcard. Please try again.
              </p>
            </div>
            <Button onClick={handleRetry} size="lg">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-[66vw] h-[66vw] max-w-sm sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] flex items-center justify-center ml-[13px]">
              {!animationError ? (
                <Suspense fallback={
                  <div className="w-full h-full bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
                    <div className="w-3/4 h-3/4 bg-primary/20 rounded-full" />
                  </div>
                }>
                  <div className="w-[95%] h-[95%] relative flex items-center justify-center">
                    {/* Layer A */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-400 ease-in-out"
                      style={{ 
                        opacity: layerAVisible ? 1 : 0,
                        willChange: 'opacity'
                      }}
                    >
                      <lottie-player
                        key={`layerA-${layerAAnimationIndex}`}
                        src={animationUrls[layerAAnimationIndex]}
                        autoplay
                        loop={layerAAnimationIndex !== 1}
                        speed="1"
                        background="transparent"
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      />
                    </div>
                    
                    {/* Layer B */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-400 ease-in-out"
                      style={{ 
                        opacity: layerAVisible ? 0 : 1,
                        willChange: 'opacity'
                      }}
                    >
                      <lottie-player
                        key={`layerB-${layerBAnimationIndex}`}
                        src={animationUrls[layerBAnimationIndex]}
                        autoplay
                        loop={layerBAnimationIndex !== 1}
                        speed="1"
                        background="transparent"
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      />
                    </div>
                    
                    {/* Preload all animations (hidden) */}
                    <div className="absolute opacity-0 pointer-events-none" style={{ width: 0, height: 0 }}>
                      {animationUrls.map((url, i) => (
                        <lottie-player
                          key={`preload-${i}`}
                          src={url}
                          autoplay={false}
                          loop={false}
                          background="transparent"
                        />
                      ))}
                    </div>
                  </div>
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
                <p className={`text-base font-semibold text-primary transition-opacity duration-200 ${
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