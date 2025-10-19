import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RepresentativeCard } from '@/components/rep/RepresentativeCard';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '../../context/AppContext';
import { ProgressIndicator } from '../ProgressIndicator';
import { SharedBanner } from '../SharedBanner';
import { Representative } from '../../types';
import { lookupRepresentatives } from '../../services/geocodio';
import { MapPin, Users, Bot, PenTool, ArrowRight, Heart, CheckCircle2, Mail, ChevronRight } from 'lucide-react';
import { Logo } from '../Logo';
import { DynamicSvg } from '../DynamicSvg';
import { HamburgerMenu } from '../HamburgerMenu';
import heroImage from '@/assets/civic-hero-mobile.jpg';
import { usePostHog } from 'posthog-js/react';
export function LandingScreen() {
  const posthog = usePostHog();
  const [openResearchMenu, setOpenResearchMenu] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'about' | 'faq' | 'contact' | 'privacy-terms' | 'research'>('main');
  const {
    state,
    dispatch
  } = useAppContext();
  const [zipCode, setZipCode] = useState('');
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);
  const [showSharedDialog, setShowSharedDialog] = useState(false);
  const [sharedByName, setSharedByName] = useState('');

  // Refs for auto-scrolling
  const resultsRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  // Track landing page view
  useEffect(() => {
    posthog.capture('landing_page_viewed');
  }, []);

  // Auto-focus ZIP input with mobile-friendly delay
  useEffect(() => {
    const timer = setTimeout(() => {
      const zipInput = document.getElementById('zipCode');
      if (zipInput) {
        zipInput.focus();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Check for shared link and menu view parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for ref parameter (sharing link)
    const ref = urlParams.get('ref');
    if (ref) {
      // Import formatSharingLinkForDisplay dynamically
      import('@/lib/shareUtils').then(({ formatSharingLinkForDisplay }) => {
        const formattedName = formatSharingLinkForDisplay(decodeURIComponent(ref));
        setSharedByName(formattedName);
        setShowSharedDialog(true);
      });
      // Don't remove the query param - keep it for persistence
    }
    
    // Check for view parameter to open menu to specific view
    const view = urlParams.get('view');
    if (view && ['research', 'faq', 'about', 'contact', 'privacy-terms'].includes(view)) {
      setMenuView(view as any);
      setOpenResearchMenu(true);
    }
  }, []);
  const validateZipCode = (zip: string) => {
    return /^\d{5}$/.test(zip);
  };
  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateZipCode(zipCode)) {
      setSearchError('Please enter a valid 5-digit zip code');
      return;
    }
    setIsSearching(true);
    setSearchError('');
    setShowSharedDialog(false); // Hide the shared banner when user starts searching

    try {
      const reps = await lookupRepresentatives(zipCode);
      setRepresentatives(reps);
      if (reps.length === 1) {
        setSelectedRep(reps[0]);
      }
    } catch (error) {
      setSearchError('Hmm. That doesn\'t look like a valid zip code. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-scroll when representatives are loaded
  useEffect(() => {
    if (representatives.length > 0 && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 300);
    }
  }, [representatives]);

  // Auto-scroll when representative is selected
  useEffect(() => {
    if (selectedRep && continueButtonRef.current) {
      setTimeout(() => {
        continueButtonRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 300);
    }
  }, [selectedRep]);
  const handleRepSelect = (rep: Representative) => {
    setSelectedRep(rep);
  };
  const handleContinue = () => {
    if (selectedRep) {
      setShowSharedDialog(false); // Dismiss share banner before moving to next step
      dispatch({
        type: 'UPDATE_POSTCARD_DATA',
        payload: {
          zipCode,
          representative: selectedRep
        }
      });
      dispatch({
        type: 'SET_STEP',
        payload: 2
      });
    }
  };
  return <>
      <div className="min-h-screen bg-background relative">
      {/* Shared Link Banner */}
      {showSharedDialog && <SharedBanner sharedBy={sharedByName} onDismiss={() => setShowSharedDialog(false)} variant="app" />}
      <div className="mx-auto px-4 max-w-2xl py-4 pb-1">
        {/* Supporting illustration */}
        <div className="flex justify-center mb-4">
          <div className="w-full max-w-40 h-32 sm:h-36 md:h-40 flex items-center justify-center">
            <DynamicSvg assetName="zip_code_page_icon.svg" alt="Enter your zip code" className="w-full h-full object-contain opacity-90" />
          </div>
        </div>

        {/* Primary CTA Card - Title, Subtitle, and Zip Code Form */}
        <Card className="mb-4 border-primary/20 shadow-sm">
          <CardContent className="p-6 md:p-8">
            {/* Hero Text */}
            <div className="text-center mb-6">
              <h1 className="display-title leading-tight mb-4">Send a real postcard to congress</h1>
              <h2 className="subtitle text-base mb-0 leading-relaxed">Handwritten postcards are the gold standard in the age of AI</h2>
            </div>

            <form onSubmit={handleZipSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                   <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input id="zipCode" type="text" inputMode="numeric" pattern="[0-9]{5}" placeholder="Enter ZIP code (e.g., 97403)" value={zipCode} onChange={e => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setZipCode(value);
                    setSearchError('');
                  }} className="pl-10 pr-10 h-14 text-center text-lg focus:ring-accent focus:border-accent border-2" style={{
                    textAlign: 'center',
                    paddingLeft: '2.5rem',
                    paddingRight: '2.5rem'
                  }} maxLength={5} data-attr="input-zip-code" />
                </div>
                {searchError && <p className="text-sm text-destructive">
                    {searchError}
                    {searchError.includes('valid')}
                  </p>}
                {!searchError && (
                  <p className="text-xs text-muted-foreground text-center">
                    ZIP only—no account required
                  </p>
                )}
              </div>
              
              <Button type="submit" className={`w-full h-14 text-base font-semibold ${isSearching ? '!bg-[hsl(var(--primary-pressed))] !text-primary-foreground hover:!bg-[hsl(var(--primary-pressed))]' : zipCode.length === 5 && validateZipCode(zipCode) ? 'animate-pulse-subtle' : ''}`} disabled={isSearching || !zipCode} data-attr="submit-zip-code">
                {isSearching ? <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Finding Your Rep...
                  </> : <>
                    Find My Representative
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Research Card */}
        <Card className="mb-4 border-primary/20 shadow-sm">
          <CardContent className="pt-4 px-4 !pb-1">
            <div className="text-center mb-4">
              <h3 className="subtitle text-sm">THE RESEARCH</h3>
            </div>
            <div className="text-center text-primary text-sm mb-3">
              <p className="body-text font-medium">96% of staffers say personalized constituent messages influence undecided votes</p>
            </div>
            
            <Separator className="my-0.5" />
            
            {/* Learn Why This Works Link */}
            <div className="text-center py-1">
              <button
                onClick={() => {
                  setMenuView('research');
                  setOpenResearchMenu(true);
                }}
                className="text-xs leading-none text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
                data-attr="click-landing-research"
              >
                Learn More
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardContent>
        </Card>


        {/* Representatives Results - Action First */}
        {isSearching && <div className="mb-6">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>}

        {representatives.length > 0 && !isSearching && (
          <>
            <div ref={resultsRef} className="mb-3 space-y-4">
              {representatives.length > 1 && (
                <p className="text-center text-sm text-muted-foreground px-4">
                  Multiple representatives found. Select yours:
                </p>
              )}

              {representatives.map((rep) => (
                <RepresentativeCard
                  key={rep.id}
                  representative={rep}
                  isSelected={selectedRep?.id === rep.id}
                  showBadge={true}
                  onClick={() => handleRepSelect(rep)}
                />
              ))}
            </div>
          </>
        )}

        {/* Spacer for sticky button */}
        {selectedRep && <div className="h-20" />}
      </div>

      {/* Programmatically controlled HamburgerMenu for Research - Always available */}
      <HamburgerMenu 
        initialView={openResearchMenu ? menuView : "main"}
        externalOpen={openResearchMenu}
        externalSetOpen={setOpenResearchMenu}
        hideTrigger={true}
        onOpenChange={(open) => {
          if (!open) {
            setOpenResearchMenu(false);
            setMenuView('main');
          }
        }}
      />

      {/* Sticky CTA */}
      {selectedRep && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg animate-slide-in-right">
          <div className="max-w-2xl mx-auto">
            <Button 
              ref={continueButtonRef}
              onClick={handleContinue} 
              className="w-full h-12 text-base font-medium"
              data-attr="submit-landing-continue"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>;
}