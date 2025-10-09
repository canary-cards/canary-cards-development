import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  AboutContent,
  FAQContent,
  ContactContent,
  PrivacyTermsContent,
  ResearchContent,
} from './navigation/NavigationContent';

type DrawerView = 'main' | 'about' | 'faq' | 'contact' | 'privacy-terms' | 'research';

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
                     data-attr="click-menu-about"
                   >
                    <div className="text-primary">About Canary</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                   <button
                     onClick={() => handleNavigation('faq')}
                     className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                     data-attr="click-menu-faq"
                   >
                    <div className="text-primary">FAQ</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                  <button
                    onClick={() => handleNavigation('research')}
                    className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                    data-attr="click-menu-research"
                  >
                    <div className="text-primary">The Research</div>
                  </button>
                  
                  <div className="border-b border-[#E8DECF] my-2"></div>
                  
                   <button
                     onClick={() => handleNavigation('contact')}
                     className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                     data-attr="click-menu-contact"
                   >
                    <div className="text-primary">Contact Us</div>
                  </button>
                  
                   <div className="border-b border-[#E8DECF] my-2"></div>
                   
                    <button
                      onClick={() => handleNavigation('privacy-terms')}
                      className="w-full text-left py-3 body-text hover-safe:bg-primary/10 active:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] motion-safe:transition-colors motion-safe:duration-200 min-h-[44px] flex items-center px-2 touch-manipulation hover-primary-tint"
                      data-attr="click-menu-privacy-terms"
                    >
                     <div className="text-primary">Privacy & Terms</div>
                   </button>
                </div>
              </nav>
            ) : (
              /* Content Views */
              <div className="px-4 md:px-5 lg:px-6 py-4 animate-fade-in">
          {currentView === 'about' && <AboutContent />}
          {currentView === 'faq' && <FAQContent onSeeResearch={() => setCurrentView('research')} onSeePrivacy={() => setCurrentView('privacy-terms')} />}
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