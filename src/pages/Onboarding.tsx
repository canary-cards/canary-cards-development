import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SharedBanner } from '../components/SharedBanner';
import { ProgressStrips } from '../components/onboarding/ProgressStrips';
import { formatSharingLinkForDisplay } from '../lib/shareUtils';
import { Slide } from '../components/onboarding/Slide';
import { usePostHog } from 'posthog-js/react';

const SLIDE_DURATION = 6500;
const TOTAL_SLIDES = 4;

const slides = [
  {
    title: "Handwritten postcards are the gold standard in Washington D.C.",
    subtitle: "96% of Capitol Hill staff say personalized letters influence undecided congressional votes",
    finePrint: "— Abernathy, C.E. (2015). Legislative Correspondence Management Practices: Congressional Offices and the Treatment of Constituent Opinion. Vanderbilt University Ph.D. Dissertation",
    iconPlaceholder: "ICON / WHY POSTCARDS",
    assetName: "onboarding_icon_1.svg",
    imageAlt: "Why postcards are effective in D.C."
  },
  {
    title: "Canary does the hard work for you",
    subtitle: "It researches the issues you care about — then writes a clear, persuasive postcard in seconds",
    iconPlaceholder: "ICON / CANARY RESEARCH",
    assetName: "onboarding_icon_2.svg",
    imageAlt: "Canary research process"
  },
  {
    title: "Your words, written in real ink with a real pen",
    subtitle: "Written by a robot holding a blue ballpoint, indistinguishable from human handwriting",
    iconPlaceholder: "ICON / REAL INK HANDWRITING",
    assetName: "onboarding_icon_3.svg",
    imageAlt: "Real handwriting with ink and pen"
  },
  {
    title: "No stamps, no hassle",
    subtitle: "Your postcard is mailed straight to your representative's desk",
    iconPlaceholder: "ICON / MAILED FOR YOU",
    assetName: "onboarding_icon_4.svg",
    imageAlt: "Postcard delivery service"
  }
];

export default function Onboarding() {
  const posthog = usePostHog();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplayStopped, setAutoplayStopped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [sharedBy, setSharedBy] = useState('');
  


  // Track first onboarding screen view
  useEffect(() => {
    posthog.capture('onboarding_first_screen_viewed');
  }, []);

  // Check for shared link
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const ref = urlParams.get('ref');
    
    console.log('[Onboarding] Checking for ref parameter:', { 
      ref, 
      locationSearch: location.search,
      shouldShowBanner: !!(ref && ref !== 'direct')
    });
    
    if (ref && ref !== 'direct') {
      const formattedName = formatSharingLinkForDisplay(ref);
      console.log('[Onboarding] Showing shared banner for:', formattedName);
      setSharedBy(formattedName);
      setShowSharedBanner(true);
    }
  }, [location.search]);

  // Exit to home with preserved query params
  const exitToHome = useCallback(() => {
    navigate('/' + location.search, { 
      state: { skipOnboarding: true },
      replace: true 
    });
  }, [navigate, location.search]);

  // Autoplay logic
  useEffect(() => {
    if (autoplayStopped) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (SLIDE_DURATION / 100));
        
        if (newProgress >= 100) {
          if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide(prev => prev + 1);
            return 0;
          } else {
            // Completed all slides
            exitToHome();
            return 100;
          }
        }
        
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentSlide, autoplayStopped, exitToHome]);

  // Pause autoplay when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setAutoplayStopped(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Navigation functions
  const goToSlide = useCallback((slideIndex: number) => {
    if (slideIndex >= 0 && slideIndex < TOTAL_SLIDES) {
      setCurrentSlide(slideIndex);
      setProgress(100);
      setAutoplayStopped(true);
    } else if (slideIndex >= TOTAL_SLIDES) {
      exitToHome();
    }
  }, [exitToHome]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  // Touch and click handlers - Instagram Stories pattern
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Direct navigation like Instagram Stories
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // Stop autoplay on any interaction
    setAutoplayStopped(true);
    setProgress(100);
    
    if (clickX < width / 2) {
      prevSlide();
    } else {
      nextSlide();
    }
  }, [prevSlide, nextSlide]);

  // Swipe handling
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      // Only trigger if horizontal swipe is more significant than vertical
      // Increased threshold to 75px for better scroll vs swipe distinction
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 75) {
        if (deltaX > 0) {
          prevSlide();
        } else {
          nextSlide();
        }
      }
    };

    const container = document.getElementById('onboarding-container');
    if (container) {
      container.addEventListener('touchstart', handleTouchStart);
      container.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [prevSlide, nextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide]);

  // Lock vertical scrolling while onboarding is mounted
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background h-[100dvh] overflow-hidden flex flex-col">
      {/* Shared Banner - Above everything */}
      {showSharedBanner && (
        <div className="flex-shrink-0">
          <SharedBanner 
            sharedBy={sharedBy} 
            onDismiss={() => setShowSharedBanner(false)}
            variant="onboarding"
          />
        </div>
      )}

      {/* Header with X Button and Progress Strips */}
      <div 
        className="flex-shrink-0 flex items-center justify-between px-4 py-4 z-40"
        style={{ 
          paddingTop: 'env(safe-area-inset-top, 1rem)'
        }}
      >
        {/* Progress Strips - taking most of the width with left spacing to match X visual position */}
        <div className="flex-1 ml-2 mr-3">
          <ProgressStrips
            currentSlide={currentSlide}
            totalSlides={TOTAL_SLIDES}
            autoplayActive={!autoplayStopped}
            progress={progress}
          />
        </div>

        {/* X Button - aligned to the right */}
        <button
          onClick={exitToHome}
          className="w-10 h-10 flex items-center justify-center text-foreground hover:text-foreground/80 transition-colors flex-shrink-0"
          aria-label="Skip onboarding"
          data-attr="click-onboarding-skip"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content - Full height container */}
      <div 
        id="onboarding-container"
        className="relative flex-1 w-full touch-pan-x select-none overflow-hidden"
        onClick={handleClick}
      >

        <div className="h-full max-w-lg mx-auto w-full">
          <Slide 
            {...slides[currentSlide]} 
            currentSlide={currentSlide}
            allAssets={slides.map(slide => ({ 
              assetName: slide.assetName || '', 
              alt: slide.imageAlt || slide.iconPlaceholder 
            }))}
          />
        </div>
      </div>
    </div>
  );
}