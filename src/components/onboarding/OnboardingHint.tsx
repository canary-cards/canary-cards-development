import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { safeStorage } from '@/lib/safeStorage';

export function OnboardingHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if hint has been seen before
    const hintSeen = safeStorage.getItem('onboarding_hint_seen');
    
    if (!hintSeen) {
      setVisible(true);
      
      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        safeStorage.setItem('onboarding_hint_seen', 'true');
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    safeStorage.setItem('onboarding_hint_seen', 'true');
  };

  if (!visible) return null;

  return (
    <div 
      className="fixed bottom-0 right-0 flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground pointer-events-none animate-fade-in"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 1rem), 1rem)',
        paddingRight: 'max(env(safe-area-inset-right, 1rem), 1rem)',
      }}
      onClick={handleDismiss}
    >
      <span>Tap or swipe to continue</span>
      <ChevronRight className="w-4 h-4 pulse-subtle" />
    </div>
  );
}
