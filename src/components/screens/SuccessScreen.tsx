import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '../../context/AppContext';
import { CheckCircle, Share2, Copy, MessageSquare, Mail, Sparkles, Share as ShareIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function SuccessScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [inviteLink, setInviteLink] = useState('');
  const [showAccountCreation, setShowAccountCreation] = useState(true);

  // Get the deployed app URL, not the Lovable editor URL
  const getAppUrl = () => {
    // If we're in the Lovable editor, user needs to publish first
    if (window.location.origin.includes('lovable.app') && window.location.pathname.includes('/edit/')) {
      return null; // Will show a publish message instead
    }
    // For deployed app or custom domain, use current origin
    return window.location.origin;
  };

  useEffect(() => {
    // Generate unique invite link
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const appUrl = getAppUrl();
    if (appUrl) {
      setInviteLink(`${appUrl}?invite=${uniqueId}`);
    }
    
    // Confetti effect
    showConfetti();
  }, []);

  const showConfetti = () => {
    // Simple confetti effect - in real app would use a library like canvas-confetti
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    for (let i = 0; i < 50; i++) {
      createConfettiPiece(colors[Math.floor(Math.random() * colors.length)]);
    }
  };

  const createConfettiPiece = (color: string) => {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${color};
      left: ${Math.random() * 100}vw;
      top: -10px;
      z-index: 1000;
      border-radius: 50%;
      animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
    `;
    
    document.body.appendChild(confetti);
    
    // Add CSS animation
    if (!document.querySelector('#confetti-style')) {
      const style = document.createElement('style');
      style.id = 'confetti-style';
      style.textContent = `
        @keyframes confetti-fall {
          to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    setTimeout(() => {
      confetti.remove();
    }, 5000);
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link copied!",
        description: "Share this link with friends and family",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const shareViaText = () => {
    const message = `I just sent a handwritten postcard to my representative! Join me in making our voices heard: ${inviteLink}`;
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSharePageNavigation = () => {
    const uniqueId = Math.random().toString(36).substring(2, 15);
    navigate(`/share?ref=${uniqueId}&order=${uniqueId.slice(-8).toUpperCase()}`);
  };

  const shareViaEmail = () => {
    const subject = 'Join me in civic engagement!';
    const message = `I just sent a handwritten postcard to my representative through this amazing platform. It only took 5 minutes and really helps our voices be heard in Washington.\n\nJoin me: ${inviteLink}\n\nTogether we can make a difference!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`, '_blank');
  };

  const handleGoogleAuth = () => {
    // Mock Google Auth - in real app would integrate with Google OAuth
    toast({
      title: "Account created!",
      description: "Welcome to Civic Postcards",
    });
    setShowAccountCreation(false);
  };

  const startNew = () => {
    dispatch({ type: 'RESET_STATE' });
  };

  const postcardData = state.postcardData;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-12 h-12 text-secondary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            🎉 Congratulations!
          </h1>
          <p className="text-lg text-muted-foreground">
            You've taken meaningful action for your country!
          </p>
        </div>

        {/* Order Summary */}
        <Card className="card-warm mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Your Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Representative:</span>
                <span className="font-medium">{postcardData.representative?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Send Option:</span>
                <span className="font-medium">
                  {postcardData.sendOption === 'single' ? 'Single Postcard' : '3 Postcards (All Representatives)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-medium">
                  ${postcardData.sendOption === 'single' ? '4.99' : '11.99'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span className="font-medium">Within 3 business days</span>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-secondary/20 rounded-lg">
              <p className="text-sm text-center">
                <Sparkles className="w-4 h-4 inline mr-1" />
                Your handwritten postcard will be created by robots and mailed with real stamps!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Creation */}
        {showAccountCreation && (
          <Card className="card-warm mb-8">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4">Create Your Account</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Come back later and create another postcard even more easily
              </p>
              
              <Button
                onClick={handleGoogleAuth}
                className="w-full button-warm h-12"
                variant="outline"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Create Account with Google
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Share Section */}
        <Card className="card-warm mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Share with Friends & Family</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Share this exclusive link with friends and family to help them get involved too!
            </p>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="input-warm flex-1"
                />
                <Button
                  onClick={copyInviteLink}
                  variant="outline"
                  className="button-warm"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                onClick={handleSharePageNavigation}
                variant="spotlight"
                size="lg"
                className="w-full max-w-80 mx-auto mb-4"
                aria-label="Share Canary Cards with friends"
              >
                <ShareIcon className="w-4 h-4 mr-2" />
                Invite Others to Take Action
              </Button>
              
              <p className="text-sm text-foreground/60 text-center mb-4">
                Share with friends and family
              </p>
              
              <div className="flex gap-2">
                <Button
                  onClick={shareViaText}
                  variant="outline"
                  className="flex-1 button-warm"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Text Message
                </Button>
                <Button
                  onClick={shareViaEmail}
                  variant="outline"
                  className="flex-1 button-warm"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start New Postcard */}
        <Card className="card-warm">
          <CardContent className="p-6 text-center">
            <h2 className="font-semibold mb-2">Want to Send Another?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Keep the momentum going and send postcards about other issues you care about
            </p>
            <Button
              onClick={startNew}
              className="button-warm"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Create New Postcard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}