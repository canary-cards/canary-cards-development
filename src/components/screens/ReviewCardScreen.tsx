import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '../../context/AppContext';
import { PostcardHero } from '../PostcardHero';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

export function ReviewCardScreen() {
  const { state, dispatch } = useAppContext();
  const [isMessageExpanded, setIsMessageExpanded] = useState(false);
  
  const rep = state.postcardData.representative;
  const userInfo = state.postcardData.userInfo;
  const finalMessage = state.postcardData.finalMessage;

  // Replace placeholders in the message with actual user data
  const replacePlaceholders = (message: string) => {
    if (!message || !userInfo) return message;
    
    return message
      .replace(/\[Your Name\]/g, userInfo.fullName || '')
      .replace(/\[Your City\]/g, userInfo.city || '')
      .replace(/\[Your State\]/g, userInfo.state || '')
      .replace(/\[Your Full Name\]/g, userInfo.fullName || '');
  };

  const displayMessage = replacePlaceholders(finalMessage);

  const handleContinue = () => {
    dispatch({ type: 'SET_STEP', payload: 6 }); // Go to checkout screen
  };

  const goBack = () => {
    dispatch({ type: 'SET_STEP', payload: 4 }); // Go back to return address screen
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-32 max-w-2xl">
        
        {/* Hero Visual Carousel */}
        <PostcardHero className="mb-8" />

        {/* Representative & Return Address Block */}
        <Card className="bg-white shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* TO Address */}
              <div>
                <div className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">
                  TO:
                </div>
                <div className="text-primary font-inter">
                  <p className="font-medium">{rep?.name}</p>
                  <p className="text-sm">{rep?.address || '2206 Rayburn House Office Building'}</p>
                  <p className="text-sm">{rep?.address ? '' : 'Washington, DC 20515-0507'}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border"></div>

              {/* FROM Address */}
              <div>
                <div className="text-xs font-semibold text-secondary uppercase tracking-wide mb-1">
                  FROM:
                </div>
                <div className="text-primary font-inter">
                  <p className="font-medium">{userInfo?.fullName}</p>
                  <p className="text-sm">{userInfo?.streetAddress}</p>
                  <p className="text-sm">{userInfo?.city}, {userInfo?.state} {userInfo?.zipCode}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User's Message (Progressive Disclosure) */}
        <Card className="bg-white shadow-sm mb-8">
          <CardContent className="p-0">
            <Collapsible open={isMessageExpanded} onOpenChange={setIsMessageExpanded}>
              <CollapsibleTrigger asChild>
                <button className="w-full p-6 text-left hover:bg-muted/50 transition-colors flex items-center justify-between">
                  <span className="text-primary font-medium">See your message (optional)</span>
                  {isMessageExpanded ? 
                    <ChevronUp className="w-4 h-4 text-muted-foreground" /> : 
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <div className="bg-cream rounded-lg p-4 border border-border">
                  <div className="text-primary font-caveat text-lg leading-relaxed mb-3">
                    {displayMessage}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is a digital preview — your card will be handwritten with a real pen and mailed for you.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

      </div>

      {/* Navigation Buttons - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="container mx-auto max-w-2xl">
          <div className="flex gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={goBack} 
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <Button 
              onClick={handleContinue}
              className="flex-1 bg-primary text-white hover:bg-primary/90"
            >
              Continue →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}