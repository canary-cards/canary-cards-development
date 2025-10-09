import React, { useState } from 'react';
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
  PrivacyTermsContent,
  ResearchContent,
} from './NavigationContent';

type NavView = 'about' | 'faq' | 'contact' | 'privacy-terms' | 'research' | null;

export function DesktopNav() {
  const [currentView, setCurrentView] = useState<NavView>(null);

  const handleNavClick = (view: NavView) => {
    setCurrentView(view);
  };

  const handleClose = () => {
    setCurrentView(null);
  };

  const getDialogTitle = () => {
    switch (currentView) {
      case 'about': return 'About Canary';
      case 'faq': return 'FAQ';
      case 'contact': return 'Contact';
      case 'privacy-terms': return 'Privacy & Terms';
      case 'research': return 'The Research';
      default: return '';
    }
  };

  const getDialogContent = () => {
    switch (currentView) {
      case 'about':
        return <AboutContent />;
      case 'faq':
        return (
          <FAQContent
            onSeeResearch={() => setCurrentView('research')}
            onSeePrivacy={() => setCurrentView('privacy-terms')}
          />
        );
      case 'contact':
        return <ContactContent />;
      case 'privacy-terms':
        return <PrivacyTermsContent />;
      case 'research':
        return <ResearchContent />;
      default:
        return null;
    }
  };

  return (
    <>
      <nav className="flex items-center gap-6">
        <button
          onClick={() => handleNavClick('about')}
          className="body-text text-primary hover-safe:bg-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          About
        </button>
        <button
          onClick={() => handleNavClick('faq')}
          className="body-text text-primary hover-safe:bg-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          FAQ
        </button>
        <button
          onClick={() => handleNavClick('research')}
          className="body-text text-primary hover-safe:bg-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          The Research
        </button>
        <button
          onClick={() => handleNavClick('contact')}
          className="body-text text-primary hover-safe:bg-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          Contact
        </button>
        <button
          onClick={() => handleNavClick('privacy-terms')}
          className="body-text text-primary hover-safe:bg-primary/10 px-3 py-2 rounded-md transition-colors"
        >
          Privacy & Terms
        </button>
      </nav>

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
