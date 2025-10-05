import { toast } from '@/hooks/use-toast';
import { getFrontendUrl } from '@/lib/environment';

/**
 * Centralized sharing functionality for consistent behavior across the app
 */

// Standard share content
export const SHARE_TEXT = 'Did something small but powerful today: sent a real postcard to Congress with Canary Cards. Took 3 minutes and actually works.';
export const SHARE_TITLE = 'Send a handwritten postcard to Congress.';
export const SHARE_DESCRIPTION = 'Just a few handwritten postcards can swing a congressional vote';

/**
 * Strip trailing numbers from a sharing link for display purposes
 * Example: "Ben-W-2" -> "Ben W."
 */
export const formatSharingLinkForDisplay = (link: string): string => {
  if (!link) return '';
  
  // Remove trailing -N pattern (e.g., "-2", "-3")
  const baseLink = link.replace(/-\d+$/, '');
  
  // Convert "Ben-W" to "Ben W."
  const parts = baseLink.split('-');
  if (parts.length === 2) {
    return `${parts[0]} ${parts[1]}.`;
  }
  
  return link;
};

/**
 * Get the app URL for sharing - use current environment or production
 */
export const getAppUrl = (): string => {
  // In development/staging, use current domain for testing
  // In production, use production domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    const isDev = hostname.includes('lovable.app') || hostname === 'localhost';
    const result = isDev ? origin : 'https://canary.cards';
    console.log('[shareUtils] getAppUrl()', { hostname, origin, isDev, result });
    return result;
  }
  // SSR/build fallback
  return 'https://canary.cards';
};

/**
 * Generate a referral URL with sharing link
 */
export const generateReferralUrl = (sharingLink?: string): string => {
  const baseUrl = getAppUrl();
  const finalUrl = sharingLink ? `${baseUrl}?ref=${encodeURIComponent(sharingLink)}` : baseUrl;
  console.log('[shareUtils] generateReferralUrl()', { sharingLink, baseUrl, finalUrl });
  return finalUrl;
};

/**
 * Copy full share content (text + URL) to clipboard
 */
export const copyShareContent = async (url: string, customText?: string): Promise<void> => {
  const text = customText || SHARE_TEXT;
  const fullContent = `${text} ${url}`;
  
  try {
    await navigator.clipboard.writeText(fullContent);
    toast({
      title: "Link copied!",
      description: "Share link copied to clipboard",
    });
  } catch (error) {
    console.error('Failed to copy:', error);
    toast({
      title: "Failed to copy",
      description: "Please copy the link manually.",
      variant: "destructive"
    });
  }
};

/**
 * Share content using native Web Share API with fallback to clipboard
 * For mobile shares, includes URL in text to prevent duplication in apps like WhatsApp
 */
export const shareContent = async (url: string, customText?: string): Promise<void> => {
  const text = customText || SHARE_TEXT;
  
  // For mobile sharing (WhatsApp, iMessage, etc.), include the URL in the text
  // This prevents WhatsApp from showing the URL twice and ensures consistent behavior
  const shareData = {
    title: SHARE_TITLE,
    text: `${text} ${url}`
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        // Fallback to clipboard if share fails (but not if user cancelled)
        // On desktop fallback, only copy the URL without the message text
        try {
          await navigator.clipboard.writeText(url);
          toast({
            title: "Link copied!",
            description: "Share link copied to clipboard",
          });
        } catch (clipboardError) {
          console.error('Failed to copy:', clipboardError);
          toast({
            title: "Failed to copy",
            description: "Please copy the link manually.",
            variant: "destructive"
          });
        }
      }
    }
  } else {
    // Desktop fallback - only copy the URL, not the message text
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Share link copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  }
};

/**
 * Check if native sharing is available (typically mobile devices)
 */
export const isNativeShareAvailable = (): boolean => {
  return 'share' in navigator && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Share via SMS with pre-filled message
 */
export const shareViaSMS = (url: string, customText?: string): void => {
  const text = customText || SHARE_TEXT;
  const message = `${text} ${url}`;
  window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
};

/**
 * Share via email with pre-filled content
 */
export const shareViaEmail = (url: string, customText?: string): void => {
  const text = customText || SHARE_TEXT;
  const subject = 'Join me in civic engagement!';
  const message = `${text}\n\nJoin me: ${url}\n\nTogether we can make a difference!`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, '_blank');
};