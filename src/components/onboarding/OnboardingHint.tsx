import React, { useEffect, useState } from 'react';
import { ChevronsRight } from 'lucide-react';

export function OnboardingHint({ currentSlide = 0 }: { currentSlide?: number }) {
  const [visible, setVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

  useEffect(() => {
    // Only show on the first slide and once per session
    if (currentSlide !== 0) {
      setVisible(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const hintSeenSession = typeof window !== 'undefined' && window.sessionStorage?.getItem('onboarding_hint_seen_session');
      if (!hintSeenSession) {
        setVisible(true);
        // Auto-hide after 6 seconds
        timer = setTimeout(() => {
          setVisible(false);
          try { window.sessionStorage?.setItem('onboarding_hint_seen_session', 'true'); } catch {}
        }, 6000);
      }
    } catch {}

    return () => { if (timer) clearTimeout(timer); };
  }, [currentSlide]);

  const handleDismiss = () => {
    setVisible(false);
    try { window.sessionStorage?.setItem('onboarding_hint_seen_session', 'true'); } catch {}
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
        Tap or swipe to continue through the onboarding slides
      </div>
      
      <div 
        className="fixed bottom-0 right-0 flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground cursor-pointer animate-fade-in bg-background/95 backdrop-blur-sm rounded-xl shadow-sm"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 1rem), 1rem)',
          paddingRight: 'max(env(safe-area-inset-right, 1rem), 1rem)',
        }}
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
        <span>Tap or swipe to continue</span>
        <ChevronsRight 
          className={`w-5 h-5 ${prefersReducedMotion ? '' : 'animate-bounce'}`}
          aria-hidden="true"
        />
      </div>
    </>
  );
}
