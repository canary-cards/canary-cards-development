import React, { useEffect } from 'react';
import { Heart, X } from 'lucide-react';

interface SharedBannerProps {
  sharedBy: string;
  onDismiss: () => void;
  variant?: 'onboarding' | 'app' | 'default';
}

export function SharedBanner({ sharedBy, onDismiss, variant = 'default' }: SharedBannerProps) {
  console.log('[SharedBanner] Rendering with sharedBy:', sharedBy, 'variant:', variant);
  
  // Auto-dismiss after 8 seconds - only for app variant, not onboarding
  useEffect(() => {
    if (variant !== 'app') return;
    
    const timer = setTimeout(() => {
      console.log('[SharedBanner] Auto-dismissing after 8 seconds');
      onDismiss();
    }, 8000);

    return () => clearTimeout(timer);
  }, [onDismiss, variant]);

  // Different positioning based on variant
  const getPositionClasses = () => {
    switch (variant) {
      case 'onboarding':
        // Relative positioning to stay in flex flow and push content down
        return 'relative w-full z-[100]';
      case 'app':
        // Absolute positioning to cover StepDots but scroll with page
        return 'absolute left-0 right-0 z-[100] top-[3.5rem]';
      default:
        return 'fixed top-0 left-0 right-0 z-[100]';
    }
  };
  
  return (
    <div className={`${getPositionClasses()} bg-primary text-primary-foreground px-4 py-3 shadow-md`}>
      <div className="container mx-auto max-w-2xl relative">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary-foreground/80" />
          <span className="text-sm font-medium">
            Shared with you by <strong>{sharedBy}</strong>
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-foreground/80 hover:text-primary-foreground transition-colors text-lg leading-none"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}