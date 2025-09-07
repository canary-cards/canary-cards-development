import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { SharedBanner } from '../components/SharedBanner';
import { ProgressStrips } from '../components/onboarding/ProgressStrips';
import { Slide } from '../components/onboarding/Slide';

const SLIDE_DURATION = 4500;
const TOTAL_SLIDES = 4;

const slides = [
  {
    title: "Handwritten postcards are the gold standard in D.C.",
    subtitle: "15× more likely to have influence than form emails*.",
    finePrint: "* 2019 Congressional Management Foundation study",
    iconPlaceholder: "ICON / WHY POSTCARDS",
    assetName: "onboarding-icon-1-v4",
    imageAlt: "Why postcards are effective in D.C."
  },
  {
    title: "Canary does the hard work for you.",
    subtitle: "It researches the issues you care about — then writes a clear, persuasive postcard in seconds.",
    iconPlaceholder: "ICON / CANARY RESEARCH",
    assetName: "onboarding-icon-2-v4",
    imageAlt: "Canary research process"
  },
  {
    title: "Your words, written in real ink with a real pen.",
    subtitle: "Indistinguishable from human handwriting. Authentic and personal.",
    finePrint: "Written by a robot holding a blue ballpoint. Authentic & affordable",
    iconPlaceholder: "ICON / REAL INK HANDWRITING",
    assetName: "onboarding-icon-3-v4",
    imageAlt: "Real handwriting with ink and pen"
  },
  {
    title: "No stamps. No hassle.",
    subtitle: "Your postcard is mailed straight to your representative's desk.",
    iconPlaceholder: "ICON / MAILED FOR YOU",
    assetName: "onboarding-icon-4-v4",
    imageAlt: "Postcard delivery service"
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoplayStopped, setAutoplayStopped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [sharedBy, setSharedBy] = useState('');


  // Check for shared link
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sharedByParam = urlParams.get('shared_by');
    
    if (sharedByParam) {
      setSharedBy(decodeURIComponent(sharedByParam));
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

  // Touch and click handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    // If autoplay is active, first tap should just pause it
    if (!autoplayStopped) {
      setAutoplayStopped(true);
      setProgress(100); // Fill current bar completely when paused
      return;
    }
    
    // If autoplay is already paused, handle navigation
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    if (clickX < width / 2) {
      prevSlide();
    } else {
      nextSlide();
    }
  }, [autoplayStopped, prevSlide, nextSlide]);

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
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
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
    <div className="fixed inset-0 z-50 bg-background h-[100dvh] overflow-hidden">
      {/* Shared Banner */}
      {showSharedBanner && (
        <SharedBanner 
          sharedBy={sharedBy} 
          onDismiss={() => setShowSharedBanner(false)} 
        />
      )}

      {/* Progress Strips - Fixed at top */}
      <div 
        className="fixed left-0 right-0 z-40 bg-foreground/90 text-background"
        style={{ 
          top: showSharedBanner ? '3.25rem' : 0,
          paddingTop: 'env(safe-area-inset-top, 0px)'
        }}
      >
        <ProgressStrips
          currentSlide={currentSlide}
          totalSlides={TOTAL_SLIDES}
          autoplayActive={!autoplayStopped}
          progress={progress}
        />
      </div>

      {/* X Button - Fixed */}
      <button
        onClick={exitToHome}
        className="fixed right-4 z-50 w-10 h-10 flex items-center justify-center text-foreground hover:text-foreground/80 transition-colors"
        style={{ 
          top: showSharedBanner ? 'calc(3.25rem + 1rem)' : '1rem'
        }}
        aria-label="Skip onboarding"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Content - Full height container */}
      <div 
        id="onboarding-container"
        className="relative h-full w-full touch-pan-x select-none"
        style={{ 
          paddingTop: showSharedBanner ? 'calc(3.25rem + 5.5rem)' : '5.75rem'
        }}
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