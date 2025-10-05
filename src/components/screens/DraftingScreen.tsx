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
  "https://cdn.lottielab.com/l/2hxdso7kaDCFVy.json", // Transition 1
  "https://cdn.lottielab.com/l/2FdfJEUKxUWhCF.json",
  "https://cdn.lottielab.com/l/5F5FU8Pgc7urZh.json", // Transition 2
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
  const activeLayerRef = useRef<'A' | 'B'>('A');
  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
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
  const layerARef = useRef<HTMLElement | null>(null);
  const layerBRef = useRef<HTMLElement | null>(null);
  const preloadedReadyRef = useRef(false);
  
  // Playback/crossfade helpers to prevent ghosting
  const CROSSFADE_MS = 600; // must match CSS duration-600
  const stopAndHideLayer = (layer: 'A' | 'B') => {
    const el = layer === 'A' ? layerARef.current : layerBRef.current;
    try {
      // Disable looping first to prevent transition animations from restarting
      if (el && 'loop' in el) {
        (el as any).loop = false;
      }
      // Stop playback and completely remove from render tree to avoid GPU cached frames
      (el as any)?.stop?.();
      if (el) {
        (el as HTMLElement).style.visibility = 'hidden';
        (el as HTMLElement).style.display = 'none';
      }
    } catch {}
  };
  const showAndPlayLayer = (layer: 'A' | 'B') => {
    const el = layer === 'A' ? layerARef.current : layerBRef.current;
    try {
      if (el) {
        (el as HTMLElement).style.display = 'flex'; // restore layout
        (el as HTMLElement).style.visibility = 'visible';
      }
      (el as any)?.play?.();
    } catch {}
  };
  
  // Update message based on current animation
  useEffect(() => {
    // Map animation indices to message indices (skip messages for transition animations at index 1 and 3)
    const messageIndex = currentAnimationIndex === 0 ? 0 
                       : currentAnimationIndex === 1 ? 0 // Keep first message during transition 1
                       : currentAnimationIndex === 2 ? 1 
                       : currentAnimationIndex === 3 ? 2 // Keep third message during transition 2
                       : currentAnimationIndex === 4 && animation3LoopCount >= 3 ? 3 
                       : 2;
    
    const newMessage = draftingMessages[messageIndex];
    
    // Only animate transition if message actually changed
    if (newMessage !== currentMessage) {
      setShowTypewriter(false);
      setTimeout(() => {
        setCurrentMessage(newMessage);
        // Ensure the now-active layer is visible in case visibility was hidden
        showAndPlayLayer(activeLayerRef.current);
        setShowTypewriter(true);
      }, 200);
    }
  }, [currentAnimationIndex, animation3LoopCount, currentMessage]);

  // For animation 5 (final), count loops (but don't trigger animation on every loop)
  useEffect(() => {
    if (currentAnimationIndex === 4) {
      const interval = setInterval(() => {
        setAnimation3LoopCount(prev => prev + 1);
      }, 3000); // Animation duration

      return () => clearInterval(interval);
    }
  }, [currentAnimationIndex]);

  // Preload the next animation into the hidden layer without crossfading
  const preloadHiddenLayer = (targetIndex: number) => {
    preloadedReadyRef.current = false;
    if (activeLayerRef.current === 'A') {
      setLayerBAnimationIndex(targetIndex);
    } else {
      setLayerAAnimationIndex(targetIndex);
    }
    // Attach one-time 'ready'/'load' listeners to detect when hidden layer is ready
    setTimeout(() => {
      const hiddenEl = activeLayerRef.current === 'A' ? layerBRef.current : layerARef.current;
      if (!hiddenEl) return;
      // Ensure hidden layer is visible (but opacity 0) before upcoming crossfade
      (hiddenEl as HTMLElement).style.visibility = 'visible';
      const onReady = () => {
        preloadedReadyRef.current = true;
        hiddenEl.removeEventListener('ready', onReady as any);
        hiddenEl.removeEventListener('load', onReady as any);
      };
      hiddenEl.addEventListener('ready', onReady as any, { once: true } as any);
      hiddenEl.addEventListener('load', onReady as any, { once: true } as any);
    }, 0);
  };

  // Instantly start crossfading to whatever is already preloaded on the hidden layer
  const crossfadeToPreloaded = (targetIndex: number) => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;

    const prev = activeLayerRef.current;
    const next: 'A' | 'B' = prev === 'A' ? 'B' : 'A';
    // Make sure the incoming layer is visible and playing before fade-in
    showAndPlayLayer(next);

    if (prev === 'A') {
      setLayerAVisible(false); // Crossfade to Layer B
      setActiveLayer('B');
    } else {
      setLayerAVisible(true); // Crossfade to Layer A
      setActiveLayer('A');
    }
    setCurrentAnimationIndex(targetIndex);

    // Halfway through the crossfade, hide the outgoing layer to prevent ghosting
    setTimeout(() => stopAndHideLayer(prev), Math.floor(CROSSFADE_MS / 2));

    // After fade completes, fully stop and hide the previous layer to avoid ghosting
    setTimeout(() => stopAndHideLayer(prev), CROSSFADE_MS + 50);

    // Release the lock shortly after state updates
    setTimeout(() => {
      transitionInProgress.current = false;
    }, 10);
  };

  // Smooth crossfade transition between animations (with small preload delay)
  const transitionToAnimation = (targetIndex: number) => {
    if (transitionInProgress.current) return;
    transitionInProgress.current = true;

    console.log(`🎬 Transitioning from animation ${currentAnimationIndex} to ${targetIndex}, active layer: ${activeLayerRef.current}`);

    const prev = activeLayerRef.current;

    if (prev === 'A') {
      setLayerBAnimationIndex(targetIndex);
      setTimeout(() => {
        // Prepare incoming layer before crossfade
        showAndPlayLayer('B');
        setLayerAVisible(false);
        setActiveLayer('B');
        setCurrentAnimationIndex(targetIndex);
        // Midway through crossfade: hide outgoing layer A to prevent ghosting
        setTimeout(() => stopAndHideLayer('A'), Math.floor(CROSSFADE_MS / 2));
        // Cleanup previous after fade
        setTimeout(() => stopAndHideLayer('A'), CROSSFADE_MS + 50);
        transitionInProgress.current = false;
      }, 300);
    } else {
      setLayerAAnimationIndex(targetIndex);
      setTimeout(() => {
        // Prepare incoming layer before crossfade
        showAndPlayLayer('A');
        setLayerAVisible(true);
        setActiveLayer('A');
        setCurrentAnimationIndex(targetIndex);
        // Midway through crossfade: hide outgoing layer B to prevent ghosting
        setTimeout(() => stopAndHideLayer('B'), Math.floor(CROSSFADE_MS / 2));
        // Cleanup previous after fade
        setTimeout(() => stopAndHideLayer('B'), CROSSFADE_MS + 50);
        transitionInProgress.current = false;
      }, 300);
    }
  };

  // Sequential animation timing: first (6s) -> transition 1 (2s) -> second (8s) -> transition 2 (2s) -> third (stays until complete)
  useEffect(() => {
    const timers: number[] = [];

    // After 6s: go to Transition 1 (index 1)
    timers.push(window.setTimeout(() => {
      const prevLayer = activeLayerRef.current;
      transitionToAnimation(1);

      // Halfway through transition 1 (1s): hide animation 0 to prevent ghosting
      timers.push(window.setTimeout(() => {
        stopAndHideLayer(prevLayer);
      }, 1000));

      // 1.5s into transition 1: preload Animation 2 on the hidden layer
      timers.push(window.setTimeout(() => {
        preloadHiddenLayer(2);
      }, 1500));

      // At 2s into transition 1 (8s total): crossfade to the preloaded Animation 2
      timers.push(window.setTimeout(() => {
        const doCrossfade = () => {
          crossfadeToPreloaded(2);
          // After 8s on Animation 2: go to Transition 2 (index 3)
          timers.push(window.setTimeout(() => {
            transitionToAnimation(3);

            // 1.5s into transition 2: preload Animation 3 on the hidden layer
            timers.push(window.setTimeout(() => {
              preloadHiddenLayer(4);
            }, 1500));

            // At 2s into transition 2: crossfade to the preloaded Animation 3
            timers.push(window.setTimeout(() => {
              const doCrossfade2 = () => {
                crossfadeToPreloaded(4);
              };

              if (preloadedReadyRef.current) {
                doCrossfade2();
              } else {
                const hiddenEl = activeLayerRef.current === 'A' ? layerBRef.current : layerARef.current;
                let done = false;
                const onReady = () => {
                  if (done) return;
                  done = true;
                  hiddenEl?.removeEventListener('ready', onReady as any);
                  hiddenEl?.removeEventListener('load', onReady as any);
                  doCrossfade2();
                };
                hiddenEl?.addEventListener('ready', onReady as any, { once: true } as any);
                hiddenEl?.addEventListener('load', onReady as any, { once: true } as any);
                // Fallback timeout to avoid waiting forever
                timers.push(window.setTimeout(() => {
                  if (done) return;
                  done = true;
                  doCrossfade2();
                }, 1200));
              }
            }, 2000));
          }, 8000));
        };

        if (preloadedReadyRef.current) {
          doCrossfade();
        } else {
          const hiddenEl = activeLayerRef.current === 'A' ? layerBRef.current : layerARef.current;
          let done = false;
          const onReady = () => {
            if (done) return;
            done = true;
            hiddenEl?.removeEventListener('ready', onReady as any);
            hiddenEl?.removeEventListener('load', onReady as any);
            doCrossfade();
          };
          hiddenEl?.addEventListener('ready', onReady as any, { once: true } as any);
          hiddenEl?.addEventListener('load', onReady as any, { once: true } as any);
          // Fallback timeout to avoid waiting forever
          timers.push(window.setTimeout(() => {
            if (done) return;
            done = true;
            doCrossfade();
          }, 1200));
        }
      }, 2000));
    }, 6000));

    return () => {
      timers.forEach(clearTimeout);
    };
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

        // Ensure minimum 24 second display time for better UX
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 24000 - elapsedTime);

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
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-600 ease-in-out"
                      style={{ 
                        opacity: layerAVisible ? 1 : 0,
                        willChange: 'opacity',
                        zIndex: layerAVisible ? 2 : 1,
                        contain: 'paint'
                      }}
                    >
                      <lottie-player
                        key={`layerA-${layerAAnimationIndex}`}
                        ref={(el) => { layerARef.current = el as unknown as HTMLElement; }}
                        src={animationUrls[layerAAnimationIndex]}
                        autoplay
                        loop
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
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-600 ease-in-out"
                      style={{ 
                        opacity: layerAVisible ? 0 : 1,
                        willChange: 'opacity',
                        zIndex: layerAVisible ? 1 : 2,
                        contain: 'paint'
                      }}
                    >
                      <lottie-player
                        key={`layerB-${layerBAnimationIndex}`}
                        ref={(el) => { layerBRef.current = el as unknown as HTMLElement; }}
                        src={animationUrls[layerBAnimationIndex]}
                        autoplay
                        loop
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
                          style={{ visibility: 'hidden' }}
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