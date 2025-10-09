import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AboutContent,
  FAQContent,
  ContactContent,
  ResearchContent,
} from './NavigationContent';

type NavView = 'how-it-works' | 'faq' | 'contact' | 'research' | null;

export function DesktopNav() {
  const [currentView, setCurrentView] = useState<NavView>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppContext();

  const handleNavClick = (view: NavView) => {
    setCurrentView(view);
  };

  const handleClose = () => {
    setCurrentView(null);
  };

  const handleSendCardClick = () => {
    if (location.pathname === '/') {
      dispatch({ type: 'RESET_TO_HOME' });
    } else {
      navigate('/', { state: { skipOnboarding: true } });
    }
  };

  const getDialogTitle = () => {
    switch (currentView) {
      case 'how-it-works': return 'How It Works';
      case 'faq': return 'FAQ';
      case 'contact': return 'Contact';
      case 'research': return 'The Research';
      default: return '';
    }
  };

  const getDialogContent = () => {
    switch (currentView) {
      case 'how-it-works':
        return <AboutContent />;
      case 'faq':
        return (
          <FAQContent
            onSeeResearch={() => setCurrentView('research')}
          />
        );
      case 'contact':
        return <ContactContent />;
      case 'research':
        return <ResearchContent />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between flex-1 ml-8">
        {/* Center: Main Navigation */}
        <nav className="flex items-center gap-6 mx-auto" aria-label="Main navigation">
          <button
            onClick={() => handleNavClick('how-it-works')}
            className={`
              body-text text-primary px-3 py-2 rounded-md
              transition-all duration-[120ms] ease-out
              border-b-2
              ${currentView === 'how-it-works' 
                ? 'border-accent' 
                : 'border-transparent hover:border-accent'
              }
            `}
          >
            How It Works
          </button>
          <button
            onClick={() => handleNavClick('faq')}
            className={`
              body-text text-primary px-3 py-2 rounded-md
              transition-all duration-[120ms] ease-out
              border-b-2
              ${currentView === 'faq' 
                ? 'border-accent' 
                : 'border-transparent hover:border-accent'
              }
            `}
          >
            FAQ
          </button>
          <button
            onClick={() => handleNavClick('research')}
            className={`
              body-text text-primary px-3 py-2 rounded-md
              transition-all duration-[120ms] ease-out
              border-b-2
              ${currentView === 'research' 
                ? 'border-accent' 
                : 'border-transparent hover:border-accent'
              }
            `}
          >
            The Research
          </button>
          <button
            onClick={() => handleNavClick('contact')}
            className={`
              body-text text-primary px-3 py-2 rounded-md
              transition-all duration-[120ms] ease-out
              border-b-2
              ${currentView === 'contact' 
                ? 'border-accent' 
                : 'border-transparent hover:border-accent'
              }
            `}
          >
            Contact
          </button>
        </nav>

        {/* Right: CTA Button */}
        <Button
          onClick={handleSendCardClick}
          className="bg-accent text-primary border-2 border-primary hover:bg-accent/90 font-medium transition-all duration-[120ms]"
          data-attr="click-nav-send-card"
        >
          Send a Card
        </Button>
      </div>

      <Dialog open={currentView !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="display-title text-2xl">{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {getDialogContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
