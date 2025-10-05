import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Share as ShareIcon } from 'lucide-react';
import { Header } from '@/components/Header';
import { MetaTags } from '@/components/MetaTags';
import { SharedBanner } from '@/components/SharedBanner';
import { generateReferralUrl, SHARE_TITLE, SHARE_DESCRIPTION, formatSharingLinkForDisplay } from '@/lib/shareUtils';

export default function Share() {
  const [searchParams] = useSearchParams();
  const [isNativeShareAvailable, setIsNativeShareAvailable] = useState(false);
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [sharedBy, setSharedBy] = useState('');
  const { toast } = useToast();

  const ref = searchParams.get('ref') || 'direct';
  const orderNumber = searchParams.get('order') || '';

  // Build referral URL using centralized utilities
  const referralUrl = generateReferralUrl(ref);

  // Check for shared link
  useEffect(() => {
    if (ref && ref !== 'direct') {
      setSharedBy(formatSharingLinkForDisplay(ref));
      setShowSharedBanner(true);
    }
  }, [ref]);

  const handleShare = async () => {
    const { shareContent: shareUtils } = await import('@/lib/shareUtils');
    await shareUtils(referralUrl);
  };

  useEffect(() => {
    // Check if native sharing is available
    const checkAvailability = async () => {
      const { isNativeShareAvailable: checkNativeShare } = await import('@/lib/shareUtils');
      setIsNativeShareAvailable(checkNativeShare());
    };
    checkAvailability();
  }, []);

  console.log('Share page rendering with:', { ref, orderNumber, isNativeShareAvailable });

  return (
    <div className="min-h-screen bg-background">
      <MetaTags 
        title={SHARE_TITLE}
        description={SHARE_DESCRIPTION}
        image="https://canary.cards/lovable-uploads/new_icon_for_preview.png"
        url={referralUrl}
      />
      {showSharedBanner && (
        <SharedBanner 
          sharedBy={sharedBy} 
          onDismiss={() => setShowSharedBanner(false)}
          variant="app"
        />
      )}
      <Header />
      
      {/* Content Container */}
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
        <Card className="p-8 md:p-12">
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
                data-attr="click-share-invite-action"
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
        </Card>
      </div>
    </div>
  );
}