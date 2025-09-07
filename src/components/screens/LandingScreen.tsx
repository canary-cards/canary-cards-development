import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RepresentativeCard } from '@/components/rep/RepresentativeCard';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAppContext } from '../../context/AppContext';
import { ProgressIndicator } from '../ProgressIndicator';
import { SharedBanner } from '../SharedBanner';
import { Representative } from '../../types';
import { lookupRepresentatives } from '../../services/geocodio';
import { MapPin, Users, Bot, PenTool, ArrowRight, Heart, Target } from 'lucide-react';
import { Logo } from '../Logo';
import heroImage from '@/assets/civic-hero-mobile.jpg';
import { useSvgAssets } from '@/hooks/useSvgAssets';
export function LandingScreen() {
  const {
    state,
    dispatch
  } = useAppContext();
  const { getSvgUrl } = useSvgAssets();
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

  // Check for shared link on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedBy = urlParams.get('shared_by');
    if (sharedBy) {
      setSharedByName(decodeURIComponent(sharedBy));
      setShowSharedDialog(true);
      // Don't remove the query param - keep it for persistence
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
      {/* Shared Link Banner */}
      {showSharedDialog && <SharedBanner sharedBy={sharedByName} onDismiss={() => setShowSharedDialog(false)} />}

      <div className={`min-h-screen bg-background ${showSharedDialog ? 'pt-16' : ''}`}>
      <div className="container mx-auto px-4 max-w-2xl">        
        {/* Mobile-First Hero Section */}
        <div className="text-center">
          {/* Hero Text */}
          <div className="w-full p-6 pb-0">
            <h1 className="text-2xl md:text-3xl display-title leading-tight mb-4">
              Send a Real Postcard to Your Representative
            </h1>
            <h2 className="subtitle text-base mb-0 leading-relaxed">
              Handwritten postcards get noticed. Emails don't.
            </h2>
          </div>
        </div>

        {/* Icon between title and form */}
        <div className="flex justify-center mb-2">
          <img
            src={getSvgUrl('zip code page icon 2.svg')}
            alt="Zip code page icon"
            className="w-full max-w-56 h-48 sm:h-56 md:h-64 object-contain pointer-events-none select-none"
          />
        </div>

        {/* Primary CTA - Zip Code Form (Above the fold) */}
        <Card className="mb-4 border-primary/20 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleZipSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="zipCode" className="text-sm md:text-base font-medium text-center block">
                  Enter your zip code to get started
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input id="zipCode" type="text" inputMode="numeric" pattern="[0-9]{5}" placeholder="12345" value={zipCode} onChange={e => {
                     const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                     setZipCode(value);
                     setSearchError('');
                   }} className="pl-10 pr-10 h-12 text-center text-lg md:text-base focus:ring-accent focus:border-accent border-2" style={{
                     textAlign: 'center',
                     paddingLeft: '2.5rem',
                     paddingRight: '2.5rem'
                   }} maxLength={5} />
                </div>
                {searchError && <p className="text-sm text-destructive">
                    {searchError}
                    {searchError.includes('valid')}
                  </p>}
              </div>
              
              <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isSearching || !zipCode}>
                {isSearching ? <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Finding Your Rep...
                  </> : <>
                    Find My Representative
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center mt-3">
                We only use your zip to find your rep.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Proof Card */}
        <Card className="mb-6 bg-card border-2 border-border/60">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-semibold text-secondary mb-3 tracking-wide uppercase">
              The Research
            </p>
            <p className="text-base font-normal text-foreground leading-relaxed">
              Just 50 personalized postcards can influence a congresspersons vote.
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              — 2019 Congressional Management Foundation Study
            </p>
          </CardContent>
        </Card>

        {/* Representatives Results */}
        {isSearching && <div className="mb-6">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>}

        {representatives.length > 0 && !isSearching && <div ref={resultsRef} className="mb-6 space-y-4">
            {representatives.length > 1 && <p className="text-center text-sm text-muted-foreground px-4">
                Multiple representatives found. Select yours:
              </p>}
            
            {representatives.map(rep => <RepresentativeCard key={rep.id} representative={rep} isSelected={selectedRep?.id === rep.id} showBadge={true} onClick={() => handleRepSelect(rep)} />)}
            
            {selectedRep && <Button ref={continueButtonRef} onClick={handleContinue} className="w-full h-12 text-base font-medium">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>}
          </div>}
      </div>
    </div>
    </>;
}