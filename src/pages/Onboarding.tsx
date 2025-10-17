import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { SharedBanner } from '../components/SharedBanner';
import { ProgressStrips } from '../components/onboarding/ProgressStrips';
import { formatSharingLinkForDisplay } from '../lib/shareUtils';
import { Slide } from '../components/onboarding/Slide';
import { Coachmark } from '../components/onboarding/Coachmark';
import { usePostHog } from 'posthog-js/react';
import { Button } from '../components/ui/button';

const SLIDE_DURATION = 10000; // 10 seconds
const TOTAL_SLIDES = 4;
const RESUME_DELAY = 2000; // 2 seconds after interaction

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
  const [autoplayDisabledForSession, setAutoplayDisabledForSession] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [sharedBy, setSharedBy] = useState('');
  const [showCoachmark, setShowCoachmark] = useState(false);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(0);

  // Check if coachmark has been shown before
  useEffect(() => {
    const coachmarkSeen = localStorage.getItem('onboarding_coachmark_seen');
    if (!coachmarkSeen && currentSlide === 0) {
      setShowCoachmark(true);
    }
  }, [currentSlide]);

  const handleCoachmarkDismiss = useCallback(() => {
    setShowCoachmark(false);
    localStorage.setItem('onboarding_coachmark_seen', 'true');
  }, []);

  // Track slide views
  useEffect(() => {
    posthog.capture('onboarding_carousel_slide_viewed', { index: currentSlide });
    
    // Announce to screen readers
    const announcement = `Step ${currentSlide + 1} of ${TOTAL_SLIDES} — ${slides[currentSlide].title}`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.className = 'sr-only';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    
    return () => {
      document.body.removeChild(ariaLive);
    };
  }, [currentSlide, posthog]);

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
    localStorage.setItem('onboarding_dismissed', 'true');
    navigate('/' + location.search, { 
      state: { skipOnboarding: true },
      replace: true 
    });
  }, [navigate, location.search]);

  const handleSkip = useCallback(() => {
    posthog.capture('onboarding_carousel_skip');
    exitToHome();
  }, [posthog, exitToHome]);

  const handleComplete = useCallback(() => {
    posthog.capture('onboarding_carousel_completed');
    exitToHome();
  }, [posthog, exitToHome]);

  // Autoplay logic - don't auto-advance on final slide
  useEffect(() => {
    if (autoplayStopped || autoplayDisabledForSession || currentSlide === TOTAL_SLIDES - 1) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (SLIDE_DURATION / 100));
        
        if (newProgress >= 100) {
          if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide(prev => prev + 1);
            posthog.capture('onboarding_carousel_advance', { method: 'auto' });
            return 0;
          }
        }
        
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentSlide, autoplayStopped, autoplayDisabledForSession, posthog]);

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

  // Handle any user interaction - pauses autoplay temporarily or disables for session
  const handleUserInteraction = useCallback(() => {
    const now = Date.now();
    lastInteractionRef.current = now;
    
    // If this is the first interaction, disable autoplay for the entire session
    if (!autoplayDisabledForSession) {
      setAutoplayDisabledForSession(true);
    }
    
    // Pause autoplay temporarily
    setAutoplayStopped(true);
    
    // Clear any existing resume timer
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
    }
    
    // Don't resume if already disabled for session
    if (!autoplayDisabledForSession) {
      // Resume after 2 seconds if no new interactions
      resumeTimerRef.current = setTimeout(() => {
        if (Date.now() - lastInteractionRef.current >= RESUME_DELAY) {
          setAutoplayStopped(false);
          setProgress(0);
        }
      }, RESUME_DELAY);
    }
    
    // Dismiss coachmark on first interaction
    if (showCoachmark) {
      handleCoachmarkDismiss();
    }
  }, [autoplayDisabledForSession, showCoachmark, handleCoachmarkDismiss]);

  // Navigation functions
  const goToSlide = useCallback((slideIndex: number, method: string) => {
    handleUserInteraction();
    
    if (slideIndex >= 0 && slideIndex < TOTAL_SLIDES) {
      setCurrentSlide(slideIndex);
      setProgress(0);
      posthog.capture('onboarding_carousel_advance', { method });
    } else if (slideIndex < 0 && currentSlide === 0) {
      // Back from first slide exits onboarding
      handleSkip();
    } else if (slideIndex >= TOTAL_SLIDES) {
      handleComplete();
    }
  }, [currentSlide, handleUserInteraction, handleSkip, handleComplete, posthog]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1, 'tap');
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1, 'tap');
  }, [currentSlide, goToSlide]);

  // Touch and click handlers - 40/60 tap zones
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Ignore clicks on buttons or if on last slide
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button') || currentSlide === TOTAL_SLIDES - 1) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    handleUserInteraction();
    
    // Left 40% = back, right 60% = next
    if (clickX < width * 0.4) {
      prevSlide();
    } else {
      nextSlide();
    }
  }, [prevSlide, nextSlide, handleUserInteraction, currentSlide]);

  // Swipe handling
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      handleUserInteraction();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Don't allow swipe on last slide
      if (currentSlide === TOTAL_SLIDES - 1) {
        return;
      }
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      // Only trigger if horizontal swipe is more significant than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 75) {
        if (deltaX > 0) {
          goToSlide(currentSlide - 1, 'swipe');
        } else {
          goToSlide(currentSlide + 1, 'swipe');
        }
      }
    };

    const container = document.getElementById('onboarding-container');
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [currentSlide, goToSlide, handleUserInteraction]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        e.preventDefault();
        goToSlide(currentSlide - 1, 'keyboard');
      } else if (e.key === 'ArrowRight' || e.key === 'Right' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goToSlide(currentSlide + 1, 'keyboard');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, goToSlide, handleSkip]);

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

      {/* Header with Back Chevron, Progress, and Skip Link */}
      <div 
        className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3 z-40"
        style={{ 
          paddingTop: 'max(env(safe-area-inset-top, 1rem), 1rem)'
        }}
      >
        {/* Back Chevron - left side */}
        <button
          onClick={() => goToSlide(currentSlide - 1, 'progress')}
          className="w-16 h-8 flex items-center justify-start text-foreground hover:text-foreground/80 transition-colors flex-shrink-0"
          aria-label={currentSlide === 0 ? "Exit onboarding" : "Previous slide"}
          data-attr="click-onboarding-back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Progress Strips - center, taking most space */}
        <div className="flex-1 max-w-md">
          <ProgressStrips
            currentSlide={currentSlide}
            totalSlides={TOTAL_SLIDES}
            autoplayActive={!autoplayStopped && !autoplayDisabledForSession}
            progress={progress}
            onStepClick={(stepIndex) => goToSlide(stepIndex, 'progress')}
          />
        </div>

        {/* Skip intro text link - right side */}
        <button
          onClick={handleSkip}
          className="w-16 h-8 flex items-center justify-end text-sm eyebrow-lowercase text-foreground hover:text-foreground/80 transition-colors flex-shrink-0"
          aria-label="Skip intro"
          data-attr="click-onboarding-skip"
        >
          Skip intro
        </button>
      </div>

      {/* Main Content - Carousel with edge-peek */}
      <div 
        id="onboarding-container"
        className="relative flex-1 w-full touch-pan-x select-none overflow-hidden"
        onClick={handleClick}
      >
        <div 
          className="h-full w-full relative flex items-center justify-center px-4"
          style={{
            paddingRight: currentSlide < TOTAL_SLIDES - 1 ? '20px' : '16px',
            paddingLeft: currentSlide > 0 ? '20px' : '16px',
            transition: 'padding 200ms ease-out',
          }}
        >
          <div 
            className="w-full max-w-lg h-full"
            style={{
              transform: `translateX(${currentSlide > 0 ? '-4px' : '0'})`,
              transition: 'transform 200ms ease-out',
            }}
          >
            <Slide 
              {...slides[currentSlide]} 
              currentSlide={currentSlide}
              totalSlides={TOTAL_SLIDES}
              allAssets={slides.map(slide => ({ 
                assetName: slide.assetName || '', 
                alt: slide.imageAlt || slide.iconPlaceholder 
              }))}
              isLastSlide={currentSlide === TOTAL_SLIDES - 1}
              onGetStarted={handleComplete}
            />
          </div>
          
          {/* Left edge-peek: show hint of previous slide */}
          {currentSlide > 0 && (
            <div 
              className="absolute top-0 left-0 h-full pointer-events-none flex items-center pl-2"
              style={{
                width: '20px',
              }}
              aria-hidden="true"
            >
              <div 
                className="h-[calc(100%-3rem)] w-full bg-white dark:bg-white rounded-l-lg shadow-md"
                style={{
                  opacity: 0.6,
                }}
              />
            </div>
          )}
          
          {/* Right edge-peek: show hint of next slide */}
          {currentSlide < TOTAL_SLIDES - 1 && (
            <div 
              className="absolute top-0 right-0 h-full pointer-events-none flex items-center pr-2"
              style={{
                width: '20px',
              }}
              aria-hidden="true"
            >
              <div 
                className="h-[calc(100%-3rem)] w-full bg-white dark:bg-white rounded-r-lg shadow-md"
                style={{
                  opacity: 0.6,
                }}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Coachmark - first slide only, first time */}
      {showCoachmark && currentSlide === 0 && (
        <Coachmark onDismiss={handleCoachmarkDismiss} />
      )}
    </div>
  );
}