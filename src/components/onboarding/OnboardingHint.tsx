import React, { useEffect, useState, useRef } from 'react';
import tapIcon from '@/assets/tap-icon.png';

interface OnboardingHintProps {
  currentSlide?: number;
  pauseAutoplay?: () => void;
  resumeAutoplay?: () => void;
}

export function OnboardingHint({ 
  currentSlide = 0, 
  pauseAutoplay,
  resumeAutoplay 
}: OnboardingHintProps) {
  const [visible, setVisible] = useState(false);
  const [dismissedManually, setDismissedManually] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Check for reduced motion preference
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      
      const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Pause autoplay while hint is visible
  useEffect(() => {
    if (visible && pauseAutoplay) {
      pauseAutoplay();
    }
  }, [visible, pauseAutoplay]);

  useEffect(() => {
    // Only show on the first slide
    if (currentSlide !== 0) {
      setVisible(false);
      // Clear all timers
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      return;
    }

    try {
      const hintSeen = typeof window !== 'undefined' && window.sessionStorage?.getItem('onboarding_hint_seen');
      if (hintSeen === 'true') {
        return;
      }

      // Show hint after 700ms delay
      initialTimerRef.current = setTimeout(() => {
        setVisible(true);
        
        // Auto-hide after 6 seconds
        autoHideTimerRef.current = setTimeout(() => {
          setVisible(false);
          
          // If not manually dismissed and user still idle, re-show briefly at 8s
          if (!dismissedManually) {
            reShowTimerRef.current = setTimeout(() => {
              setVisible(true);
              
              // Hide again after 2s
              setTimeout(() => {
                setVisible(false);
                try { 
                  window.sessionStorage?.setItem('onboarding_hint_seen', 'true'); 
                } catch {}
                
                // Resume autoplay 2s after final hide
                if (resumeAutoplay) {
                  resumeTimerRef.current = setTimeout(() => {
                    resumeAutoplay();
                  }, 2000);
                }
              }, 2000);
            }, 2000); // 8s total from initial show (700ms + 6s + 2s delay)
          } else {
            // If manually dismissed, mark as seen and resume autoplay
            try { 
              window.sessionStorage?.setItem('onboarding_hint_seen', 'true'); 
            } catch {}
            
            if (resumeAutoplay) {
              resumeTimerRef.current = setTimeout(() => {
                resumeAutoplay();
              }, 2000);
            }
          }
        }, 6000);
      }, 700);
    } catch {}

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      if (reShowTimerRef.current) clearTimeout(reShowTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [currentSlide, dismissedManually, resumeAutoplay]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissedManually(true);
    try { 
      window.sessionStorage?.setItem('onboarding_hint_seen', 'true'); 
    } catch {}
    
    // Resume autoplay 2s after manual dismiss
    if (resumeAutoplay) {
      resumeTimerRef.current = setTimeout(() => {
        resumeAutoplay();
      }, 2000);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Visually hidden aria-live announcement for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        Tap or swipe to continue
      </div>
      
      {/* Non-blocking overlay container */}
      <div 
        className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
        style={{
          top: '55%',
          transform: 'translateY(-50%)'
        }}
      >
        <div 
          className="pointer-events-auto max-w-fit mx-auto flex items-center gap-3 px-4 py-3 text-base text-primary/90 cursor-pointer bg-[hsl(35,85%,96%)]/80 backdrop-blur-sm rounded-lg shadow-md transition-opacity"
          onClick={handleDismiss}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDismiss();
            }
          }}
          aria-label="Dismiss navigation hint"
        >
          <span className="font-sans">Tap or swipe to continue</span>
          <img 
            src={tapIcon}
            alt=""
            aria-hidden="true"
            className={`w-12 h-12 ${prefersReducedMotion ? '' : 'animate-nudge-horizontal'}`}
            style={{
              filter: 'brightness(0) saturate(100%) invert(31%) sepia(20%) saturate(1036%) hue-rotate(174deg) brightness(92%) contrast(91%)'
            }}
          />
        </div>
      </div>
    </>
  );
}
