import React, { useEffect, useState } from 'react';

interface CoachmarkProps {
  onDismiss: () => void;
}

export function Coachmark({ onDismiss }: CoachmarkProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 6000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed bottom-8 right-8 z-50 pointer-events-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <div className="eyebrow-lowercase text-xs text-muted-foreground pulse-subtle">
        Tap or swipe to continue
      </div>
    </div>
  );
}
