import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Share as ShareIcon } from 'lucide-react';
import { Header } from '@/components/Header';

export default function Share() {
  const [searchParams] = useSearchParams();
  const [isNativeShareAvailable, setIsNativeShareAvailable] = useState(false);
  const { toast } = useToast();

  const ref = searchParams.get('ref') || 'direct';
  const orderNumber = searchParams.get('order') || '';

  // Build referral URL
  const baseUrl = window.location.origin;
  const referralUrl = `${baseUrl}${ref ? `?ref=${ref}` : ''}`;

  const shareContent = {
    title: 'Canary Cards',
    text: 'Friends listen to friends. Show them how easy it is to send a real postcard.',
    url: referralUrl
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share && isNativeShareAvailable) {
      try {
        await navigator.share(shareContent);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          // Fallback to clipboard if share fails (but not if user cancelled)
          await copyToClipboard(referralUrl);
        }
      }
    } else {
      // Fallback to clipboard
      await copyToClipboard(referralUrl);
    }
  };

  useEffect(() => {
    // Check if native sharing is available
    const isNativeAvailable = 'share' in navigator && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsNativeShareAvailable(isNativeAvailable);
  }, []);

  console.log('Share page rendering with:', { ref, orderNumber, isNativeShareAvailable });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Content Container */}
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
        <div className="text-center">
          {/* Postcard Icon */}
          <div className="mb-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <ShareIcon className="h-10 w-10 text-primary" />
            </div>
          </div>

          {/* Header */}
          <h1 className="display-title mb-6 text-primary">
            Share the Impact
          </h1>
          
          {/* Subtitle */}
          <p className="body-text mb-12 text-foreground/80">
            Your voice mattered today. Now help others discover how easy it is to be heard by their representatives.
          </p>

          {/* Share Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleShare}
              variant="spotlight"
              size="lg"
              className="w-full max-w-80"
              aria-label="Share Canary Cards with friends"
            >
              <ShareIcon className="w-4 h-4 mr-2" />
              {isNativeShareAvailable ? "Invite Others to Take Action" : "Copy Link"}
            </Button>
          </div>

          {/* Helper Text */}
          <p className="mt-6 text-sm text-foreground/60">
            {isNativeShareAvailable 
              ? "This will open your device's share menu" 
              : "Then share with friends and family"}
          </p>

          {/* Debug Info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 rounded-lg bg-muted/50 p-4 text-xs text-foreground/60">
              <p>Ref: {ref} | Order: {orderNumber}</p>
              <p>Share URL: {referralUrl}</p>
              <p>Native Share: {isNativeShareAvailable ? 'Available' : 'Not Available'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}