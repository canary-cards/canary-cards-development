import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function OnboardingHint({ currentSlide = 0 }: { currentSlide?: number }) {
  const [visible, setVisible] = useState(false);

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
    <div 
      className="fixed bottom-0 right-0 flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground cursor-pointer animate-fade-in"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 1rem), 1rem)',
        paddingRight: 'max(env(safe-area-inset-right, 1rem), 1rem)',
      }}
      onClick={handleDismiss}
    >
      <span>Tap or swipe to continue</span>
      <ChevronRight className="w-4 h-4 animate-pulse" />
    </div>
  );
}
