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

  // Pause autoplay while hint is visible - keep calling to reset the resume timer
  useEffect(() => {
    if (!visible || !pauseAutoplay) return;
    
    // Initial pause
    pauseAutoplay();
    
    // Keep pausing every second to reset the auto-resume timer
    const pauseInterval = setInterval(() => {
      pauseAutoplay();
    }, 1000);
    
    return () => clearInterval(pauseInterval);
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
          
          // Mark as seen
          try { 
            window.sessionStorage?.setItem('onboarding_hint_seen', 'true'); 
          } catch {}
          
          // Resume autoplay 2s after hide
          if (resumeAutoplay) {
            resumeTimerRef.current = setTimeout(() => {
              resumeAutoplay();
            }, 2000);
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
      
      {/* Full-screen mask overlay */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none"
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
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex flex-col items-center gap-4">
          <img 
            src={tapIcon}
            alt=""
            aria-hidden="true"
            className={`w-20 h-20 ${prefersReducedMotion ? '' : 'animate-nudge-horizontal'}`}
            style={{
              filter: 'brightness(0) saturate(100%) invert(31%) sepia(20%) saturate(1036%) hue-rotate(174deg) brightness(92%) contrast(91%)'
            }}
          />
          <span className="font-sans text-lg text-primary/90">Tap or swipe to continue</span>
        </div>
      </div>
    </>
  );
}
