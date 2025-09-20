import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '../../context/AppContext';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CollapsibleSources } from '@/components/CollapsibleSources';

export function ReviewEditScreen() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  
  // Debug logging
  console.log('🎯 ReviewEditScreen: Full state:', state);
  console.log('🎯 ReviewEditScreen: PostcardData:', state.postcardData);
  console.log('🎯 ReviewEditScreen: DraftMessage:', state.postcardData.draftMessage);
  console.log('🎯 ReviewEditScreen: Sources:', state.postcardData.sources);
  
  const [editedMessage, setEditedMessage] = useState(state.postcardData.draftMessage || '');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = editedMessage.length;
  const maxChars = 300;
  const handleRegenerate = async () => {
    setIsRegenerating(true);

    // Mock AI regeneration
    setTimeout(() => {
      const originalMessage = state.postcardData.originalMessage || '';
      const rep = state.postcardData.representative;
      const userInfo = state.postcardData.userInfo;
      const regeneratedMessage = `Dear ${rep?.name || 'Representative'},

As your constituent from ${userInfo?.city}, ${userInfo?.state}, I wanted to share my concerns with you.

${originalMessage}

I believe these issues are important for our community and would appreciate your attention to them. Thank you for your service and for representing our interests.

Sincerely,
${userInfo?.fullName}`;
      setEditedMessage(regeneratedMessage);
      setIsRegenerating(false);
    }, 2000);
  };
  const handleContinue = async () => {
    if (!editedMessage.trim()) {
      return;
    }

    if (editedMessage.length > 300) {
      return;
    }

    setIsUpdating(true);

    try {
      let draftId = state.postcardData.draftId;

      // Create draft if missing (safeguard for manual messages)
      if (!draftId) {
        console.log('No draftId found, creating manual draft on the fly');
        const { data: createData, error: createError } = await supabase.functions.invoke('postcard-draft', {
          body: {
            action: 'create',
            zipCode: state.postcardData.zipCode,
            concerns: state.postcardData.concerns,
            personalImpact: state.postcardData.personalImpact,
          },
        });

        if (createError) {
          console.error('Failed to create missing draft:', createError);
          toast({
            title: "Error creating draft",
            description: "Please try again.",
            variant: "destructive",
          });
          return;
        }

        draftId = createData?.draftId;
        console.log('Created draft with ID:', draftId);
      }

      // Call the postcard-draft edge function to approve the draft
      const { data, error } = await supabase.functions.invoke('postcard-draft', {
        body: {
          action: 'approve',
          draftId: draftId,
          humanApprovedMessage: editedMessage
        }
      });

      if (error) {
        console.error('Error approving postcard draft:', error);
        toast({
          title: 'Error',
          description: 'Failed to save your changes. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      if (!data?.success) {
        console.error('Failed to approve postcard draft:', data?.error);
        toast({
          title: 'Error',
          description: 'Failed to save your changes. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      console.log('Draft approved successfully, human_approved_message:', data?.humanApprovedMessage ? 'saved' : 'missing');

      // Update local state and continue
      dispatch({
        type: 'UPDATE_POSTCARD_DATA',
        payload: {
          finalMessage: editedMessage,
          draftId: data.draftId || draftId
        }
      });
      dispatch({
        type: 'SET_STEP',
        payload: 4
      });
    } catch (error) {
      console.error('Error calling postcard-draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your changes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };
  const goBack = () => {
    dispatch({
      type: 'SET_STEP',
      payload: 2
    });
  };

  const handleEditClick = () => {
    textareaRef.current?.focus();
  };

  const getDomainLabel = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      // Convert common domains to readable names
      if (domain.includes('congress.gov')) return 'Congress.gov';
      if (domain.includes('house.gov')) return 'House.gov';
      if (domain.includes('senate.gov')) return 'Senate.gov';
      if (domain.includes('wikipedia.org')) return 'Wikipedia';
      if (domain.includes('immigrationforum.org')) return 'Immigration Forum';
      // Default to domain without www
      return domain.replace('www.', '');
    } catch {
      return 'Source';
    }
  };
  return <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-8 max-w-2xl">
        <Card className="card-warm">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="display-title mb-2">
                Review Your Postcard
              </h1>
              <h3 className="subtitle text-base">Finalize the message you want to send to your locally elected official</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Your Message</label>
                  <span className={`text-xs ${charCount > maxChars ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {charCount}/{maxChars}
                  </span>
                </div>
                <div className="relative">
                  <Textarea 
                    ref={textareaRef}
                    value={editedMessage} 
                    onChange={e => setEditedMessage(e.target.value)} 
                    className="input-warm min-h-[300px] resize-none pr-12" 
                    maxLength={maxChars} 
                  />
                  <button 
                    onClick={handleEditClick}
                    className="absolute bottom-3 right-3 bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer touch-manipulation"
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%',
                      minWidth: '40px',
                      minHeight: '40px'
                    }}
                    aria-label="Edit message"
                  >
                    <Edit3 className="w-6 h-6 text-accent" />
                  </button>
                </div>
              </div>

              {/* Sources Section */}
              {state.postcardData.sources && state.postcardData.sources.length > 0 && (
                <CollapsibleSources sources={state.postcardData.sources} />
              )}

              <div className="space-y-3 pt-4">
                <Button 
                  onClick={handleContinue} 
                  disabled={!editedMessage.trim() || charCount > maxChars}
                  className={`w-full h-12 text-base ${isUpdating ? 'bg-primary-pressed hover-safe:bg-primary-pressed active:bg-primary-pressed' : ''}`}
                  style={isUpdating ? { pointerEvents: 'none' } : undefined}
                >
                  <span>{isUpdating ? 'Saving...' : 'Looks Good, Continue'}</span>
                </Button>
                
                <Button type="button" variant="secondary" onClick={goBack} className="w-full h-12 text-base">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span>Back</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
}