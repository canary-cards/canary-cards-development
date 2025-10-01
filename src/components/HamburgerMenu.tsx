import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DynamicSvg } from '@/components/DynamicSvg';

type DrawerView = 'main' | 'about' | 'faq' | 'contact' | 'privacy-terms' | 'research';

// Content components for each section
function AboutContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why We Built Canary</h3>
        <p className="body-text">
          When the early drafts of the One Big Beautiful Bill Act included sweeping public land sell‑offs, Americans from all sides flooded Congress with letters, postcards, and phone calls demanding: <strong>public land is not for sale</strong>. The public backlash was so intense that lawmakers across the political spectrum quietly stripped out the land‑sale provisions from the final legislation.
        </p>
        <p className="body-text">
          That moment made something very clear to us: <strong>when people speak, decision‑makers listen</strong>. The problem is, most citizens lack the time, the confidence, or the know‑how to turn their concern into real influence.
        </p>
        <p className="body-text">
          So we built <strong>Canary</strong>, to lower the barrier so that every constituent can be heard. In just a couple of taps, your voice adds to a movement that can't be ignored. Real change can start with one clear message—your message—landing where it matters.
        </p>
      </div>
    </div>
  );
}

function FAQContent() {
  return (
    <div className="space-y-8">
      {/* About the postcard */}
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">About the postcard</h3>
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">
              What does my postcard look like?
            </h4>
                    <p className="body-text">
                      A sturdy 5×7 postcard on glossy stock featuring beautiful imagery of great American national parks. Real words, real ink, mailed to your representative.
                    </p>
          </div>
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">
              Is it really handwritten?
            </h4>
            <p className="body-text">
              Yes. Robots use real pens with natural variations in pressure, spacing, and letter forms — indistinguishable from human handwriting.
            </p>
          </div>
        </div>
      </div>

      {/* Why it works */}
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why it works</h3>
        <div className="space-y-3">
          <h4 className="eyebrow normal-case text-primary">
            Do postcards really make a difference?
          </h4>
          <p className="body-text">
            Yes. Research shows that personalized correspondence is the best way to make your voice heard, and physical mail cannot be ignored.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">How it works</h3>
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">
              How do the robots work?
            </h4>
            <p className="body-text">
              We send your message to robots that hold real pens and write each card uniquely. Then we drop it in the mail.
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">
              Will I know when my card is sent?
            </h4>
            <p className="body-text">
              Yes. You'll get a confirmation email once your card has been mailed.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy & Data */}
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Privacy & Data</h3>
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">
              Do you sell my personal information?
            </h4>
            <p className="body-text">
              No. We don't sell your personal data (names, addresses, emails, or individual postcard content). We may sell aggregated, anonymized data at the house district level to help organizations understand community engagement trends.
            </p>
          </div>
        </div>
      </div>

      {/* Non-partisan promise */}
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Non-partisan promise</h3>
        <div className="space-y-3">
          <h4 className="eyebrow normal-case text-primary">
            Is Canary partisan?
          </h4>
          <p className="body-text">
            No. Canary is proudly non-partisan. It works for anyone who wants their voice heard.
          </p>
        </div>
      </div>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Get in touch</h3>
        <p className="body-text">
          We'd love to hear from you.
        </p>
        <div className="space-y-6">
          <div className="space-y-3 pt-2">
            <h4 className="eyebrow normal-case text-primary">
              Questions, ideas, or feedback?
            </h4>
            <p className="body-text">
              Reach out anytime — we read every message, even if it takes a couple of days to reply.
            </p>
          </div>
          <div className="pt-4">
             <p className="body-text">
               <strong>📧 <a href="mailto:hello@canary.cards" className="text-primary underline decoration-primary hover-safe:no-underline">hello@canary.cards</a></strong>
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyTermsContent() {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Privacy & Terms</h3>
        <p className="body-text text-sm text-secondary">Last updated: September 25, 2025</p>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Who Can Use Canary Cards</h4>
            <p className="body-text text-sm">
              You must be 18 or older. Use our service only for lawful purposes — don't use it to harass, spam, or break election laws.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">What We Collect</h4>
            <p className="body-text text-sm">
              We collect your email, mailing address, postcard content, payment info (securely processed), and basic usage data to send your postcards and improve our service.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">How We Use Your Data</h4>
            <p className="body-text text-sm">
              We use your information to send and deliver postcards, provide order confirmations and delivery updates, improve Canary Cards, understand what issues matter to communities, and send occasional marketing emails (you can opt out at any time).
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">What We Don't Do</h4>
            <p className="body-text text-sm">
              We do not sell or share your personal data (name, address, email). We do not share your individual postcard text beyond what's required to fulfill and deliver it.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Sharing With Trusted Partners</h4>
            <p className="body-text text-sm">
              We share only what's necessary with vendors who help us operate: IgnitePost to write and mail postcards, Supabase to securely store postcard text, Geocodio/Google Places to look up representatives and validate addresses, and Stripe/Resend for payments and transactional emails.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Your Choices & Rights</h4>
            <p className="body-text text-sm">
              You can opt out of marketing emails anytime by clicking "unsubscribe" in the email or contacting us. You can request a copy of the data we hold about you.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Your Privacy</h4>
            <p className="body-text text-sm">
              We don't sell your personal data (names, addresses, emails, or individual postcard content). We share only what's necessary with trusted partners like IgnitePost, Supabase, and Stripe to deliver your postcards. We may sell aggregated, anonymized data at the house district level to help organizations understand community engagement trends.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Security</h4>
            <p className="body-text text-sm">
              We use industry-standard security measures to protect your data. By using Canary Cards, you agree to these basic terms for sending postcards to elected officials.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Contact</h4>
            <p className="body-text text-sm">
              Questions? Reach us at <strong>hello@canary.cards</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">The science behind why handwritten postcards cut through</h3>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">1. Personalized correspondence is the key to influence.</h4>
            <p className="body-text text-sm">
              Congressional offices consistently state that nothing has more sway on undecided votes than personalized communication from real constituents—not mass petitions, not form letters, not even most calls. In fact, 96% of Capitol Hill staff say that personalized letters specifically influence how their bosses vote, especially when the issue is undecided. The Congressional Management Foundation's research has found that messages which include personal stories, details about how an issue affects the sender, and some sign of genuine effort—like writing by hand—get more attention and are far more likely to be passed directly to the Member.
            </p>
            
            {/* Responsive Chart */}
            <div className="w-full mt-4 mb-2">
              <DynamicSvg
                assetName="constituent-importance-mobile.svg"
                alt="Chart showing constituent importance rankings - mobile view"
                className="w-full h-auto md:hidden"
              />
              <DynamicSvg
                assetName="constituent-importance-desktop.svg"
                alt="Chart showing constituent importance rankings - desktop view"
                className="hidden md:block w-full h-auto"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              Data source: CMF 2011 Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">2. Generative AI has changed the email game.</h4>
            <p className="body-text text-sm">
              Mass AI-generated emails can now mimic personalization. According to CMF, many congressional offices are increasingly aware of this and are treating many digital messages—no matter how "personal"—like form emails, discounting their impact.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">3. Physical mail cuts through.</h4>
            <p className="body-text text-sm">
              We use AI to help write your message, but our postcards are AI-proof. Congressional offices use digital tools and AI to scan, categorize, and filter emails before any human reads them. Physical postcards must be handled, sorted, and read by a real person, guaranteeing your message breaks through the digital wall.
            </p>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-[#E8DECF]">
            <p className="body-text text-sm font-semibold text-primary text-center">
              Send a postcard. Be heard.
            </p>
          </div>
          
          <div className="pt-4 border-t border-[#E8DECF]/50">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Sources:</p>
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Abernathy, C.E. (2015). Legislative Correspondence Management Practices: Congressional Offices and the Treatment of Constituent Opinion. Vanderbilt University Ph.D. Dissertation.
              </p>
              <p>Congressional Management Foundation. Building Trust by Modernizing Constituent Engagement (2022).</p>
              <p>
                Congressional Management Foundation. Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill (2011).
              </p>
              <p>
                Congressional Management Foundation. Communicating with Congress: How Citizen Advocacy Is Changing Mail Operations on Capitol Hill (2011).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HamburgerMenu({ 
  isDark = false, 
  initialView = 'main',
  onOpenChange,
  externalOpen,
  externalSetOpen,
  hideTrigger = false
}: { 
  isDark?: boolean;
  initialView?: DrawerView;
  onOpenChange?: (open: boolean) => void;
  externalOpen?: boolean;
  externalSetOpen?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<DrawerView>(initialView);

  // Use external control if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalSetOpen || setInternalOpen;

  // Update view when initialView changes
  React.useEffect(() => {
    if (initialView !== 'main') {
      setCurrentView(initialView);
      setOpen(true);
    }
  }, [initialView, setOpen]);

  // Reset to main view when drawer closes
  useEffect(() => {
    if (!open) {
      setCurrentView('main');
    }
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Prevent auto-focus on first button when drawer opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure drawer is rendered
      setTimeout(() => {
        // Remove focus from any focused element in the drawer
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
      }, 100);
    }
  }, [open]);

  // Darken browser UI (iOS Safari) while menu is open
  const themeMetaRef = useRef<HTMLMetaElement | null>(null)
  const prevThemeColorRef = useRef<string | null>(null)
  const createdRef = useRef<boolean>(false)

  useEffect(() => {
    let meta = themeMetaRef.current || (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null)
    if (!themeMetaRef.current && meta) {
      themeMetaRef.current = meta
      prevThemeColorRef.current = meta.getAttribute('content')
    }

    if (open) {
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'theme-color')
        document.head.appendChild(meta)
        themeMetaRef.current = meta
        createdRef.current = true
      }
      themeMetaRef.current!.setAttribute('content', '#333333')
    } else {
      if (themeMetaRef.current) {
        if (createdRef.current && !prevThemeColorRef.current) {
          themeMetaRef.current.remove()
          themeMetaRef.current = null
          createdRef.current = false
        } else if (prevThemeColorRef.current) {
          themeMetaRef.current.setAttribute('content', prevThemeColorRef.current)
        } else {
          themeMetaRef.current.removeAttribute('content')
        }
      }
    }
  }, [open]);

  // Handle ESC key to close menu or go back
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        if (currentView === 'main') {
          setOpen(false);
        } else {
          setCurrentView('main');
        }
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, currentView]);

  const handleNavigation = (view: DrawerView) => {
    setCurrentView(view);
  };

  const handleBack = () => {
    setCurrentView('main');
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'about': return 'About Canary';
      case 'faq': return 'FAQ';
      case 'contact': return 'Contact Us';
      case 'privacy-terms': return 'Privacy & Terms';
      case 'research': return 'The Research';
      default: return 'Canary Cards';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
           <Button
             variant="ghost"
             size="icon"
             className="relative z-50 h-10 w-10 [&_svg]:!size-6 focus:outline-none focus:ring-2 focus:ring-[--ring] focus:ring-offset-2 hover-safe:bg-primary/10 hover-safe:text-primary hover-primary-tint hover-primary-text"
             aria-controls="site-menu"
             aria-expanded={open}
             aria-label="Open menu"
           >
            <Menu className={`h-7 w-7 ${isDark ? 'text-background' : 'text-primary'}`} />
          </Button>
        </SheetTrigger>
      )}
      <SheetContent 
        side="right" 
        className="bg-white text-primary border-l-0 max-h-screen shadow-xl shadow-primary/10 p-0"
        data-hamburger-menu="true"
      >
        <div 
          className="flex flex-col h-full"
          role="dialog"
          id="site-menu"
          aria-labelledby="menu-title"
        >
          {/* Header with back navigation */}
          <div className="px-4 md:px-5 lg:px-6 pt-4 pb-2 border-b border-[#E8DECF] flex items-center gap-2">
            {currentView !== 'main' && (
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={handleBack}
                 className="hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary h-8 w-8 -ml-2 touch-manipulation hover-primary-tint"
                 aria-label="Go back to main menu"
               >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
             {currentView === 'main' ? (
                <button
                  onClick={() => setOpen(false)}
                  className="block hover-safe:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)]"
                >
                 <h2 id="menu-title" className="display-title">
                   {getViewTitle()}
                 </h2>
               </button>
             ) : (
               <h2 id="menu-title" className="display-title">
                 {getViewTitle()}
               </h2>
             )}
          </div>
          
          {/* Content area with smooth transitions */}
          <div className="flex-1 overflow-y-auto">
            {currentView === 'main' ? (
              /* Main Menu */
              <nav className="px-4 md:px-5 lg:px-6 py-2 animate-fade-in">
                <div className="space-y-2">
                   <button
                     onClick={() => handleNavigation('about')}
                     className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                   >
                    <div className="text-primary">About Canary</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                   <button
                     onClick={() => handleNavigation('faq')}
                     className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                   >
                    <div className="text-primary">FAQ</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                  <button
                    onClick={() => handleNavigation('research')}
                    className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                  >
                    <div className="text-primary">The Research</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                   <button
                     onClick={() => handleNavigation('contact')}
                     className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                   >
                    <div className="text-primary">Contact Us</div>
                  </button>
                  
                   <div className="border-b border-[#E8DECF] my-2"></div>
                   
                    <button
                      onClick={() => handleNavigation('privacy-terms')}
                      className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                    >
                     <div className="text-primary">Privacy & Terms</div>
                   </button>
                </div>
              </nav>
            ) : (
              /* Content Views */
              <div className="px-4 md:px-5 lg:px-6 py-4 animate-fade-in">
                 {currentView === 'about' && <AboutContent />}
                 {currentView === 'faq' && <FAQContent />}
                 {currentView === 'contact' && <ContactContent />}
                 {currentView === 'privacy-terms' && <PrivacyTermsContent />}
                 {currentView === 'research' && <ResearchContent />}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}