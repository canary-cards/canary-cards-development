import React from 'react';
import { Heart, X } from 'lucide-react';

interface SharedBannerProps {
  sharedBy: string;
  onDismiss: () => void;
}

export function SharedBanner({ sharedBy, onDismiss }: SharedBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-md">
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