import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle } from '@/components/ui/bottom-sheet';
import { useAppContext } from '../../context/AppContext';
import { EmbeddedCheckout } from '../EmbeddedCheckout';
import { ArrowLeft, Shield, ChevronDown, ChevronUp, Check, MapPin, IdCard } from 'lucide-react';
import { lookupRepresentativesAndSenators } from '@/services/geocodio';
import { Representative } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { getTotalPriceDollars } from '@/lib/pricing';
type RecipientSelection = 'rep-only' | 'all-three' | 'custom';
export function CheckoutScreen() {
  const {
    state,
    dispatch
  } = useAppContext();
  const isMobile = useIsMobile(); // Fixed mobile hook import
  const [email, setEmail] = useState(state.postcardData.email || '');
  const [emailError, setEmailError] = useState('');
  const [senators, setSenators] = useState<Representative[]>([]);
  const [loadingSenators, setLoadingSenators] = useState(false);
  const [selection, setSelection] = useState<RecipientSelection>('rep-only'); // Default to "Just your Representative"
  const [customSelection, setCustomSelection] = useState({
    representative: true,
    senator1: false,
    senator2: false
  });
  const [showMixMatch, setShowMixMatch] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false); // Closed by default on mobile
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
  const rep = state.postcardData.representative;
  const userInfo = state.postcardData.userInfo;

  // Fetch senators when component mounts
  useEffect(() => {
    const fetchSenatorsFromZip = async () => {
      if (userInfo?.zipCode) {
        setLoadingSenators(true);
        try {
          const {
            senators: stateSenators
          } = await lookupRepresentativesAndSenators(userInfo.zipCode);
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
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError && validateEmail(value)) {
      setEmailError('');
    }
  };
  const getSelectedRecipients = () => {
    if (selection === 'rep-only') {
      return {
        representative: true,
        senator1: false,
        senator2: false
      };
    } else if (selection === 'all-three') {
      return {
        representative: true,
        senator1: true,
        senator2: true
      };
    } else {
      return customSelection;
    }
  };
  const getSelectedCount = () => {
    const selected = getSelectedRecipients();
    return (selected.representative ? 1 : 0) + (selected.senator1 ? 1 : 0) + (selected.senator2 ? 1 : 0);
  };
  const getTotalPrice = () => {
    const sendOption = getSendOption();
    return getTotalPriceDollars(sendOption);
  };
  const getSendOption = (): 'single' | 'double' | 'triple' => {
    const count = getSelectedCount();
    if (count === 1) return 'single';
    if (count === 2) return 'double';
    return 'triple';
  };
  const handleSelectionChange = (newSelection: RecipientSelection) => {
    setSelection(newSelection);
    setValidationError('');
  };
  const handleCustomSelection = (recipient: keyof typeof customSelection, checked: boolean) => {
    setCustomSelection(prev => ({
      ...prev,
      [recipient]: checked
    }));
  };
  const validateSelection = () => {
    const count = getSelectedCount();
    if (count === 0) {
      setValidationError('Pick at least one recipient.');
      return false;
    }
    setValidationError('');
    return true;
  };

  const getCheckoutButtonText = (): string => {
    const count = getSelectedCount();
    const total = getTotalPrice();
    
    if (selection === 'rep-only') {
      return `Send my postcard — $${total}`;
    } else if (selection === 'all-three') {
      return `Send all three — $${total}`;
    } else {
      return `Send to ${count} office${count === 1 ? '' : 's'} — $${total}`;
    }
  };
  const getSelectedSenators = () => {
    const selected = getSelectedRecipients();
    const result: Representative[] = [];
    if (selected.senator1 && senators[0]) result.push(senators[0]);
    if (selected.senator2 && senators[1]) result.push(senators[1]);
    return result;
  };
  const handlePayment = async () => {
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!validateSelection()) {
      return;
    }
    setIsProcessing(true);
    setEmailError('');
    try {
      const sendOption = getSendOption();
      const selectedSenatorsList = getSelectedSenators();

      // Check for simulation flags in URL
      const urlParams = new URLSearchParams(window.location.search);
      const simulateFailure = urlParams.get('simulate_failure');
      const simulatedFailed = urlParams.get('simulate_failed');

      // Call Stripe payment function with complete postcard data
      const {
        data,
        error
      } = await supabase.functions.invoke('create-payment', {
        body: {
          sendOption,
          email,
          fullName: userInfo?.fullName,
          simulateFailure: simulateFailure === '1',
          simulatedFailed: simulatedFailed ? parseInt(simulatedFailed) : undefined,
          postcardData: {
            userInfo,
            representative: rep,
            senators: selectedSenatorsList,
            finalMessage: state.postcardData.finalMessage,
            sendOption,
            email
          }
        }
      });
      if (error) throw error;

      // Update app state 
      dispatch({
        type: 'UPDATE_POSTCARD_DATA',
        payload: {
          sendOption,
          email,
          senators: selectedSenatorsList
        }
      });

      // Store the complete postcard data to localStorage for access after payment
      const completePostcardData = {
        ...state.postcardData,
        sendOption,
        email,
        senators: selectedSenatorsList
      };
      localStorage.setItem('postcardData', JSON.stringify(completePostcardData));

      // Show embedded checkout
      setClientSecret(data.client_secret);
      setShowCheckout(true);
    } catch (error) {
      console.error('Payment error:', error);
      setEmailError('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleBackFromCheckout = () => {
    setShowCheckout(false);
    setClientSecret(null);
  };
  
  const goBack = () => {
    dispatch({
      type: 'SET_STEP',
      payload: 5
    }); // Go back to review card screen
  };

  // Scroll to top when showing checkout
  useEffect(() => {
    if (showCheckout && clientSecret) {
      window.scrollTo(0, 0);
    }
  }, [showCheckout, clientSecret]);

  // Show embedded checkout on separate screen if client secret is available
  if (showCheckout && clientSecret) {
    return <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pb-8 max-w-2xl">
          <EmbeddedCheckout clientSecret={clientSecret} onBack={handleBackFromCheckout} sendOption={getSendOption()} amount={getTotalPrice()} />
        </div>
      </div>;
  }
  
  return <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pb-24 max-w-2xl">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Let's get your masterful postcard out the door</h1>
            <h3 className="subtitle text-base">You have three congresspeople in D.C. Most send to all of them.</h3>
          </div>

          {/* Section 1 - Recipients Panel */}
          <Card className="card-warm mb-6">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Single Voice Card */}
                <div className="space-y-3">
                  <div className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative ${selection === 'rep-only' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`} onClick={() => handleSelectionChange('rep-only')}>
                    {/* Checkbox in top-right corner */}
                    <div className="absolute top-4 right-4">
                      <Checkbox 
                        checked={selection === 'rep-only'} 
                        onCheckedChange={(checked) => checked && handleSelectionChange('rep-only')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="mb-2">
                      <span className="display-title text-lg">Single Voice</span>
                    </div>
                    <div className="flex items-center justify-between mb-3 pr-8">
                      <p className="text-sm text-muted-foreground">
                        Send to Rep. {rep?.name.split(' ').pop() || 'Representative'} only
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {rep?.photo ? (
                          <img 
                            src={rep.photo} 
                            alt={`Photo of Rep. ${rep.name}`} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary text-sm font-medium">
                            {rep?.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <span className="font-bold text-lg text-foreground">Total: $5</span>
                    </div>
                    
                    
                    
                    <p className="text-sm text-muted-foreground">
                      Quieter reach — one office hears you today.
                    </p>
                  </div>
                </div>

                {/* Recommended - Maximum Impact Card */}
                <div className="space-y-3">
                  <div className={`cursor-pointer rounded-lg border-2 p-4 transition-all relative shadow-lg hover:shadow-xl ${selection === 'all-three' ? 'border-primary bg-primary/5 shadow-xl' : 'border-border hover:border-primary/50'}`} onClick={() => handleSelectionChange('all-three')}>
                    {/* Save $3 Badge */}
                    <div className="absolute -top-2 -left-2 z-10">
                      <div className="bg-yellow-400 text-blue-900 px-3 py-1 rounded-full text-xs font-semibold shadow-md">
                        Save $3
                      </div>
                    </div>
                    
                    {/* Checkbox in top-right corner */}
                    <div className="absolute top-4 right-4">
                      <Checkbox 
                        checked={selection === 'all-three'} 
                        onCheckedChange={(checked) => checked && handleSelectionChange('all-three')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    <div className="mb-2">
                      <span className="display-title text-lg">Recommended – Maximum Impact</span>
                    </div>
                    <div className="flex items-center justify-between mb-3 pr-8">
                      <p className="text-sm text-muted-foreground">
                        Send to Rep. {rep?.name.split(' ').pop() || 'Representative'}{senators[0] ? `, Sen. ${senators[0].name.split(' ').pop()}` : ''}{senators[1] ? `, and Sen. ${senators[1].name.split(' ').pop()}` : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {rep?.photo ? (
                          <img 
                            src={rep.photo} 
                            alt={`Photo of Rep. ${rep.name}`} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary text-sm font-medium">
                            {rep?.name.split(' ').map(n => n[0]).join('')}
                          </div>
                        )}
                      </div>
                      {senators[0] && <>
                          <span className="text-muted-foreground">·</span>
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {senators[0].photo ? (
                              <img 
                                src={senators[0].photo} 
                                alt={`Photo of Sen. ${senators[0].name}`} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-primary text-sm font-medium">
                                {senators[0].name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                          </div>
                        </>}
                      {senators[1] && <>
                          <span className="text-muted-foreground">·</span>
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {senators[1].photo ? (
                              <img 
                                src={senators[1].photo} 
                                alt={`Photo of Sen. ${senators[1].name}`} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-primary text-sm font-medium">
                                {senators[1].name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                          </div>
                        </>}
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-foreground">Total:</span>
                        <span className="font-bold text-lg text-muted-foreground line-through">$15</span>
                        <span className="font-bold text-lg text-foreground">$12</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Auto-addressed and correct name</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      Your message lands on every federal office that represents you.
                    </p>
                  </div>
                </div>

                {/* Mix & Match */}
                <div className="space-y-1">
                  <button onClick={() => setShowMixMatch(true)} className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">
                    Mix and Match Recipients
                  </button>
                  <p className="text-sm text-muted-foreground">
                    $5 each. Choose any combination
                  </p>
                </div>

                {/* Validation Error */}
                {validationError && <p className="text-sm text-destructive">{validationError}</p>}

                {/* Panel-level reassurance */}
                <div className="text-center pt-4">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>Auto-addressed</span>
                    <span className="mx-1">•</span>
                    <IdCard className="w-4 h-4 flex-shrink-0" />
                    <span>Name + title</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 - Order Summary */}
          <Collapsible open={isOrderSummaryOpen} onOpenChange={setIsOrderSummaryOpen}>
            <div className={`rounded-lg border-2 p-4 transition-all mb-6 bg-white ${isOrderSummaryOpen ? 'border-primary' : 'border-border'}`}>
              <CollapsibleTrigger className="w-full text-left">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="display-title text-lg">
                      Order summary — {getSelectedCount()} recipient{getSelectedCount() !== 1 ? 's' : ''} · ${getTotalPrice()}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      Price includes high-quality postcards, real ballpoint pen, and First-Class postage & mailing.
                    </p>
                  </div>
                  {isOrderSummaryOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4 space-y-2">
                  {getSelectedRecipients().representative && (
                    <div className="flex justify-between">
                      <span>Rep. {rep?.name.split(' ').pop() || 'Representative'}</span>
                      <span>$5.00</span>
                    </div>
                  )}
                  {getSelectedRecipients().senator1 && senators[0] && (
                    <div className="flex justify-between">
                      <span>Sen. {senators[0].name.split(' ').pop()}</span>
                      <span>$5.00</span>
                    </div>
                  )}
                  {getSelectedRecipients().senator2 && senators[1] && (
                    <div className="flex justify-between">
                      <span>Sen. {senators[1].name.split(' ').pop()}</span>
                      <span>$5.00</span>
                    </div>
                  )}
                  {getSelectedCount() === 3 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Bundle savings</span>
                      <span>−$3.00</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between text-lg font-bold text-foreground">
                      <span>Total</span>
                      <span>${getTotalPrice()}</span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Section 4 - Email & Payments */}
          <Card className="card-warm">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-primary">Your Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => handleEmailChange(e.target.value)} className="bg-white" />
                  <p className="text-sm text-muted-foreground">
                    We'll send you an order confirmation here after checkout and when your card is mailed.
                  </p>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>




                {/* Navigation */}
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

        {/* Sticky CTA for Both Mobile and Desktop */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-40 space-y-2 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto">
            <Button onClick={handlePayment} disabled={!email || !validateEmail(email) || isProcessing} variant="spotlight" className="w-full h-12 text-base font-medium">
              {isProcessing ? <>
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                  <span>Loading...</span>
                </> : <span>{getCheckoutButtonText()}</span>}
            </Button>
            
            {/* Payment Options and Security */}
            <div className="flex justify-center items-center gap-3 text-muted-foreground py-3">
              <img src="/128px-Apple_Pay_logo.svg.png" alt="Apple Pay" className="h-4" />
              <img src="/128px-Google_Pay_Logo.svg.png" alt="Google Pay" className="h-5" />
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span className="text-sm leading-5">Secure checkout with Stripe</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mix & Match Bottom Sheet */}
      <BottomSheet open={showMixMatch} onOpenChange={setShowMixMatch}>
        <BottomSheetContent>
          <BottomSheetHeader className="p-6 pb-4">
            <BottomSheetTitle>Mix & match recipients</BottomSheetTitle>
            <p className="text-sm text-muted-foreground">$5 each. Choose any combination.</p>
          </BottomSheetHeader>
          
          <div className="px-6 pb-6 space-y-4">
            {/* Representative Option */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Checkbox checked={customSelection.representative} onCheckedChange={checked => handleCustomSelection('representative', checked as boolean)} />
                <div>
                  <span className="font-medium">Rep. {rep?.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">— $5</span>
                </div>
              </div>
            </div>

            {/* Senator Options */}
            {senators.slice(0, 2).map((senator, index) => <div key={senator.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Checkbox checked={index === 0 ? customSelection.senator1 : customSelection.senator2} onCheckedChange={checked => handleCustomSelection(index === 0 ? 'senator1' : 'senator2', checked as boolean)} />
                  <div>
                    <span className="font-medium">Sen. {senator.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">— $5</span>
                  </div>
                </div>
              </div>)}

            {/* Guardrail */}
            <p className="text-xs text-muted-foreground">Pick at least one recipient.</p>

            {/* Totals Bar */}
            <div className="sticky bottom-0 bg-background border-t pt-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium">
                  {Object.values(customSelection).filter(Boolean).length} selected
                </span>
                <span className="font-semibold">
                  {Object.values(customSelection).filter(Boolean).length === 3 ? <>$15 <span className="line-through text-muted-foreground">$12</span> total · Save $3</> : `$${Object.values(customSelection).filter(Boolean).length * 5} total`}
                </span>
              </div>
              
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowMixMatch(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => {
                setSelection('custom');
                setShowMixMatch(false);
              }} className="flex-1" disabled={Object.values(customSelection).filter(Boolean).length === 0}>
                  Continue — ${Object.values(customSelection).filter(Boolean).length === 3 ? 12 : Object.values(customSelection).filter(Boolean).length * 5}
                </Button>
              </div>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </>;
}