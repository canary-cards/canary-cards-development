import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppContext } from '../../context/AppContext';
import { ArrowLeft, ArrowRight, Mail, Clock, Heart, Users, Zap, Check } from 'lucide-react';
import { lookupRepresentativesAndSenators } from '@/services/geocodio';
import { Representative } from '@/types';
import { getTotalPriceDollars } from '@/lib/pricing';

export function PreviewSendScreen() {
  const { state, dispatch } = useAppContext();
  const [sendOption, setSendOption] = useState<'single' | 'triple'>('single');
  const [senators, setSenators] = useState<Representative[]>([]);
  const [loadingSenators, setLoadingSenators] = useState(false);
  
  const singlePrice = getTotalPriceDollars('single');
  const triplePrice = getTotalPriceDollars('triple');
  const rep = state.postcardData.representative;
  const userInfo = state.postcardData.userInfo;
  const finalMessage = state.postcardData.finalMessage;

  // Fetch senators when component mounts
  useEffect(() => {
    const fetchSenatorsFromZip = async () => {
      if (userInfo?.zipCode) {
        setLoadingSenators(true);
        try {
          const { senators: stateSenators } = await lookupRepresentativesAndSenators(userInfo.zipCode);
          setSenators(stateSenators);
        } catch (error) {
          console.error('Failed to fetch senators:', error);
        } finally {
          setLoadingSenators(false);
        }
      }
    };
    fetchSenatorsFromZip();
  }, [userInfo?.zipCode]);

  const goToCheckout = () => {
    // Update state with selected send option and senators before going to checkout
    dispatch({
      type: 'UPDATE_POSTCARD_DATA',
      payload: {
        sendOption,
        senators: sendOption === 'triple' ? senators : []
      }
    });
    dispatch({ type: 'SET_STEP', payload: 6 }); // Go to checkout screen
  };

  const goBack = () => {
    dispatch({ type: 'SET_STEP', payload: 4 });
  };

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-8 max-w-2xl">
        <Card className="card-warm">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Review Your Card
              </h1>
              <h3 className="subtitle text-base">
                We'll send this card to a robot that will use real pen and paper to write it
              </h3>
            </div>

            {/* Postcard Preview */}
            <div className="mb-8">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-2">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left side - Return address */}
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">{userInfo?.fullName}</p>
                      <p>{userInfo?.streetAddress}</p>
                      <p>{userInfo?.city}, {userInfo?.state} {userInfo?.zipCode}</p>
                    </div>
                    
                    {/* Right side - Representative address */}
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">{rep?.name}</p>
                      <p>{rep?.address || 'U.S. House of Representatives'}</p>
                      {!rep?.address && <p>Washington, DC 20515</p>}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-background/80 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Message (handwritten style):</p>
                    <div className="text-sm leading-relaxed font-caveat">
                      {displayMessage}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Send Options */}
            <div className="space-y-6">
              {/* Representatives Mini-Cards - Above send options */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Amplify your impact</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Send your message to all your representatives to maximize your voice in government
                </p>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* House Representative */}
                  {rep && (
                    <Card className="bg-card border-secondary">
                      <CardContent className="p-2 text-center">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-lg overflow-hidden bg-muted">
                          {rep.photo ? (
                            <img src={rep.photo} alt={rep.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary text-xs font-medium">
                              {rep.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium text-xs text-primary leading-tight mb-1">{rep.name}</h4>
                        <p className="text-xs text-muted-foreground">House</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Senators */}
                  {loadingSenators ? (
                    <>
                      <Card className="bg-gradient-to-br from-muted/20 to-muted/40">
                        <CardContent className="p-2 text-center">
                          <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 animate-pulse" />
                          <div className="h-3 bg-muted rounded mx-auto mb-1 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-12 mx-auto animate-pulse" />
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-muted/20 to-muted/40">
                        <CardContent className="p-2 text-center">
                          <div className="w-12 h-12 bg-muted rounded-lg mx-auto mb-2 animate-pulse" />
                          <div className="h-3 bg-muted rounded mx-auto mb-1 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-12 mx-auto animate-pulse" />
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    senators.slice(0, 2).map(senator => (
                      <Card key={senator.id} className="bg-card border-secondary">
                        <CardContent className="p-2 text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-lg overflow-hidden bg-muted">
                            {senator.photo ? (
                              <img src={senator.photo} alt={senator.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-primary text-xs font-medium">
                                {senator.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                          </div>
                          <h4 className="font-medium text-xs text-primary leading-tight mb-1">{senator.name}</h4>
                          <p className="text-xs text-muted-foreground">Senate</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Choose your send option:</h3>
                <RadioGroup value={sendOption} onValueChange={(value: 'single' | 'triple') => setSendOption(value)}>
                  <div className="space-y-3">
                    <Card className={`cursor-pointer transition-all ${sendOption === 'single' ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="single" id="single" />
                          <div className="flex-1">
                            <Label htmlFor="single" className="cursor-pointer">
                              <div className="mb-2">
                                <span className="display-title text-lg">Single Voice</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                  Send to Rep. {rep?.name.split(' ').slice(-1)[0]} only
                                </p>
                                <span className="font-bold text-lg">${singlePrice}</span>
                              </div>
                            </Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={`cursor-pointer transition-all relative ${sendOption === 'triple' ? 'ring-2 ring-primary' : ''}`}>
                      {/* Save $3 Badge */}
                      <div className="absolute -top-2 -left-2 z-10">
                        <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                          Save $3
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="triple" id="triple" />
                          <div className="flex-1">
                            <Label htmlFor="triple" className="cursor-pointer">
                              <div className="mb-2">
                                <span className="display-title text-lg">Recommended – Maximum Impact</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                  Send to Rep. {rep ? rep.name.split(' ').slice(-1)[0] : 'Representative'}{senators.length > 0 ? `, ${senators.map(s => s.name.split(' ').slice(-1)[0]).join(', and ')}` : ''}
                                </p>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground line-through">$15</span>
                                    <span className="font-bold text-lg">${triplePrice} total</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                                <Check className="w-4 h-4 flex-shrink-0" />
                                <span>Correct office address</span>
                                <span className="mx-1">•</span>
                                <Check className="w-4 h-4 flex-shrink-0" />
                                <span>Member name + title formatted</span>
                              </div>
                            </Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </RadioGroup>
              </div>

              {/* Panel-level reassurance */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>We add the correct addresses and names automatically for you</span>
                </div>
              </div>

              {/* Continue Button */}
              <div className="space-y-4">
                <Button onClick={goToCheckout} variant="spotlight" className="w-full h-12 sm:h-14 button-warm text-sm sm:text-base md:text-lg">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" />
                  <span className="truncate">Continue to Checkout - ${sendOption === 'single' ? singlePrice : triplePrice}</span>
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    <Heart className="w-4 h-4 inline mr-1" />
                    Who knew saving democracy could be so easy?
                  </p>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-4 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={goBack} className="button-warm flex-shrink-0 px-3 sm:px-4">
                  <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-base">Back</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}