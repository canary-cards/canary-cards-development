import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type DrawerView = 'main' | 'about' | 'faq' | 'contact';

// Content components for each section
function AboutContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why we built this</h3>
        <p className="body-text">
          We built Canary Cards because we were frustrated, too.
        </p>
        <p className="body-text">
          Buying postcards, finding stamps, handwriting a message, and hauling it to the post office — all that effort makes it easy to give up.
        </p>
      </div>
      
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why this works</h3>
        <p className="body-text">
          Postcards cut through. A real card lands on your representative's desk, where emails and petitions usually don't.
        </p>
        <p className="body-text">
          In under two minutes, you write. We handle the rest — non-partisan, no extra steps, just your voice delivered.
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
              A sturdy 5×7 postcard on glossy stock. Real words, real ink, mailed to your representative.
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
            Yes. Research shows postcards bypass long mail screening, arrive faster than letters, and get prioritized over mass emails. Congressional staff pay closer attention to constituent mail.
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
              <strong>📧 <a href="mailto:hello@canary.cards" className="text-primary underline decoration-primary hover:no-underline">hello@canary.cards</a></strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HamburgerMenu({ isDark = false }: { isDark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [currentView, setCurrentView] = useState<DrawerView>('main');
  const location = useLocation();

  // Reset to main view when drawer closes
  useEffect(() => {
    if (!open) {
      setCurrentView('main');
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
      default: return 'Canary Cards';
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative z-50 focus:outline-none focus:ring-2 focus:ring-[--ring] focus:ring-offset-2 hover:bg-white hover:text-primary"
          aria-controls="site-menu"
          aria-expanded={open}
          aria-label="Open menu"
        >
          <Menu className={`h-5 w-5 ${isDark ? 'text-background' : 'text-primary'}`} />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="bg-white text-primary border-l-0 max-h-screen overflow-y-auto"
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
                className="hover:bg-[#FEF4E9] focus:outline-none focus:ring-2 focus:ring-primary h-8 w-8 -ml-2"
                aria-label="Go back to main menu"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            
            {currentView === 'main' ? (
              <Link 
                to="/" 
                onClick={() => setOpen(false)}
                className="block hover:opacity-80 transition-opacity"
              >
                <h2 id="menu-title" className="subtitle text-secondary">
                  {getViewTitle()}
                </h2>
              </Link>
            ) : (
              <h2 id="menu-title" className="subtitle text-secondary">
                {getViewTitle()}
              </h2>
            )}
          </div>
          
          {/* Content area with slide transitions */}
          <div className="flex-1 overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-out h-full"
              style={{ 
                transform: `translateX(${currentView === 'main' ? '0%' : '-100%'})`,
                width: '200%'
              }}
            >
              {/* Main Menu */}
              <nav className="w-1/2 px-4 md:px-5 lg:px-6 py-2 overflow-y-auto">
                <div className="space-y-2">
                  <button
                    onClick={() => handleNavigation('about')}
                    className="w-full text-left py-3 body-text hover:bg-[#FEF4E9] focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2"
                  >
                    <div className="text-primary">About Canary</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                  <button
                    onClick={() => handleNavigation('faq')}
                    className="w-full text-left py-3 body-text hover:bg-[#FEF4E9] focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2"
                  >
                    <div className="text-primary">FAQ</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                  <button
                    onClick={() => handleNavigation('contact')}
                    className="w-full text-left py-3 body-text hover:bg-[#FEF4E9] focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2"
                  >
                    <div className="text-primary">Contact Us</div>
                  </button>
                </div>
              </nav>

              {/* Content Views */}
              <div className="w-1/2 px-4 md:px-5 lg:px-6 py-4 overflow-y-auto">
                {currentView === 'about' && <AboutContent />}
                {currentView === 'faq' && <FAQContent />}
                {currentView === 'contact' && <ContactContent />}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}