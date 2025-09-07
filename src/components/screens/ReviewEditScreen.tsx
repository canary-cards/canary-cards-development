import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '../../context/AppContext';
import { ArrowLeft, Edit3 } from 'lucide-react';
export function ReviewEditScreen() {
  const {
    state,
    dispatch
  } = useAppContext();
  
  // Debug logging
  console.log('🎯 ReviewEditScreen: Full state:', state);
  console.log('🎯 ReviewEditScreen: PostcardData:', state.postcardData);
  console.log('🎯 ReviewEditScreen: DraftMessage:', state.postcardData.draftMessage);
  console.log('🎯 ReviewEditScreen: Sources:', state.postcardData.sources);
  
  const [editedMessage, setEditedMessage] = useState(state.postcardData.draftMessage || '');
  const [isRegenerating, setIsRegenerating] = useState(false);
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
  const handleContinue = () => {
    dispatch({
      type: 'UPDATE_POSTCARD_DATA',
      payload: {
        finalMessage: editedMessage
      }
    });
    dispatch({
      type: 'SET_STEP',
      payload: 4
    });
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
              <h3 className="subtitle">Finalize the message you want to send to your locally elected official</h3>
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
                    className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer touch-manipulation"
                    aria-label="Edit message"
                  >
                    <Edit3 className="w-6 h-6 text-accent" />
                  </button>
                </div>
              </div>

              {/* Sources Section */}
              {state.postcardData.sources && state.postcardData.sources.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground">Sources</h4>
                  <ul className="space-y-2">
                    {state.postcardData.sources.map((source, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                           <span className="text-sm text-muted-foreground leading-relaxed">
                             {source.description.replace(/<[^>]*>/g, '')}
                           </span>
                          {source.url && (
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 ml-1 px-3 py-1 text-xs bg-primary/20 text-primary rounded-full transition-colors hover:bg-primary/30 cursor-pointer no-underline"
                            >
                              {getDomainLabel(source.url)}
                              {source.dataPointCount > 0 && (
                                <span>+{source.dataPointCount}</span>
                              )}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3 pt-4">
                <Button onClick={handleContinue} disabled={!editedMessage.trim() || charCount > maxChars} className="w-full button-warm h-12 text-base">
                  <span>Looks Good, Continue</span>
                </Button>
                
                <Button type="button" variant="secondary" onClick={goBack} className="w-full button-warm h-12 text-base">
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