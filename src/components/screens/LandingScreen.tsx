import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { RepresentativeCard } from '@/components/rep/RepresentativeCard';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '../../context/AppContext';
import { ProgressIndicator } from '../ProgressIndicator';
import { SharedBanner } from '../SharedBanner';
import { Representative } from '../../types';
import { lookupRepresentatives } from '../../services/geocodio';
import { MapPin, Users, Bot, PenTool, ArrowRight, Heart, Target, ChevronDown, Mail, CheckCircle2 } from 'lucide-react';
import { Logo } from '../Logo';
import { DynamicSvg } from '../DynamicSvg';
import heroImage from '@/assets/civic-hero-mobile.jpg';
export function LandingScreen() {
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
  const [isContextOpen, setIsContextOpen] = useState(false);

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
      <div className="mx-auto px-4 max-w-2xl pb-1">
        {/* Mobile-First Hero Section */}
        <div className="text-center">
          {/* Hero Text */}
          <div className="w-full p-6 pb-0">
            <h1 className="display-title leading-tight mb-4">Send a real postcard to your representative</h1>
            <h2 className="subtitle text-base mb-0 leading-relaxed">Handwritten postcards get noticed, emails don't</h2>
          </div>
        </div>

        {/* Icon between title and form */}
        <div className="flex justify-center mb-2">
          <div className="w-full max-w-56 h-48 sm:h-56 md:h-64 flex items-center justify-center">
            <DynamicSvg assetName="zip_code_page_icon.svg" alt="Enter your zip code" className="w-full h-full object-contain" />
          </div>
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
              
              <Button type="submit" className={`w-full h-12 text-base font-medium ${isSearching ? '!bg-[hsl(var(--primary-pressed))] !text-primary-foreground hover:!bg-[hsl(var(--primary-pressed))]' : ''}`} disabled={isSearching || !zipCode}>
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

        {/* Representatives Results - Action First */}
        {isSearching && <div className="mb-6">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>}

        {representatives.length > 0 && !isSearching && <div ref={resultsRef} className="mb-3 space-y-4">
            {/* Proof Strip */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-foreground">
                  <div className="flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-primary" />
                    <span>Handwritten on real cardstock</span>
                  </div>
                  <div className="hidden sm:block text-muted-foreground">•</div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-primary" />
                    <span>Arrives in 2-3 days</span>
                  </div>
                  <div className="hidden sm:block text-muted-foreground">•</div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="font-medium">96% of staff say these influence votes</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {representatives.length > 1 && <p className="text-center text-sm text-muted-foreground px-4">
                Multiple representatives found. Select yours:
              </p>}
            
            {representatives.map(rep => <RepresentativeCard key={rep.id} representative={rep} isSelected={selectedRep?.id === rep.id} showBadge={true} onClick={() => handleRepSelect(rep)} />)}
          </div>}

        {/* Collapsible Context Layer - Why Postcards Work */}
        {representatives.length > 0 && !isSearching && (
          <Collapsible open={isContextOpen} onOpenChange={setIsContextOpen} className="mb-6">
            <Card className="bg-card border-border">
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 hover:bg-accent/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Why does this work? (See the research)
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isContextOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="px-6 pb-6 pt-2 space-y-6">
                  <div className="text-center mb-4">
                    <p className="text-sm font-semibold text-secondary tracking-wide uppercase">
                      The Research Behind Our Method
                    </p>
                  </div>

                  {/* Section 1: Personalized correspondence */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground">
                      1. Personalized correspondence is the key to influence.
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed">
                      Congressional offices consistently state that nothing has more sway on undecided votes than personalized communication from real constituents—not mass petitions, not form letters, not even most calls. In fact, 96% of Capitol Hill staff say that personalized letters specifically influence how their bosses vote, especially when the issue is undecided. The Congressional Management Foundation's research has found that messages which include personal stories, details about how an issue affects the sender, and some sign of genuine effort—like writing by hand—get more attention and are far more likely to be passed directly to the Member.
                    </p>
                    
                    {/* Responsive Chart */}
                    <div className="w-full mt-4">
                      <DynamicSvg assetName="constituent-importance-mobile.svg" alt="Chart showing constituent importance rankings - mobile view" className="w-full h-auto md:hidden" />
                      <DynamicSvg assetName="constituent-importance-desktop.svg" alt="Chart showing constituent importance rankings - desktop view" className="hidden md:block w-full h-auto" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Data source: CMF 2011 Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill
                    </p>
                  </div>

                  {/* Section 2: AI impact */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground">
                      2. Generative AI has changed the email game.
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed">
                      Mass AI-generated emails can now mimic personalization. According to CMF, many congressional offices are increasingly aware of this and are treating many digital messages—no matter how "personal"—like form emails, discounting their impact.
                    </p>
                  </div>

                  {/* Section 3: Physical mail advantages */}
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-foreground">
                      3. Physical mail cuts through.
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed">
                      We use AI to help write the postcards, but our postcards are AI proof. Congressional offices use digital tools and AI to scan, categorize, and filter emails before any human reads them. Physical postcards must be handled, sorted, and read by a real person, guaranteeing your message breaks through the digital wall.
                    </p>
                  </div>

                  {/* Call to action */}
                  <div className="text-center pt-4 border-t border-muted">
                    <p className="text-base font-semibold text-primary">
                      Send a postcard. Be heard.
                    </p>
                  </div>

                  {/* Sources */}
                  <div className="pt-4 border-t border-muted/50">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Sources:</p>
                    <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                      <p>Abernathy, C.E. (2015). Legislative Correspondence Management Practices: Congressional Offices and the Treatment of Constituent Opinion. Vanderbilt University Ph.D. Dissertation.</p>
                      <p>Congressional Management Foundation. Building Trust by Modernizing Constituent Engagement (2022).</p>
                      <p>Congressional Management Foundation. Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill (2011).</p>
                      <p>Congressional Management Foundation. Communicating with Congress: How Citizen Advocacy Is Changing Mail Operations on Capitol Hill (2011).</p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Spacer for sticky button */}
        {selectedRep && <div className="h-20" />}
      </div>

      {/* Sticky CTA */}
      {selectedRep && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg animate-slide-in-right">
          <div className="max-w-2xl mx-auto">
            <Button 
              ref={continueButtonRef}
              onClick={handleContinue} 
              className="w-full h-12 text-base font-medium"
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