import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SharedBanner } from '../components/SharedBanner';
import { ProgressStrips } from '../components/onboarding/ProgressStrips';
import { Slide } from '../components/onboarding/Slide';

const SLIDE_DURATION = 6500;
const TOTAL_SLIDES = 4;

const slides = [
  {
    title: "Handwritten postcards are the gold standard in D.C.",
    subtitle: "15× more likely to have influence than form emails*.",
    finePrint: "* 2019 Congressional Management Foundation study",
    iconPlaceholder: "ICON / WHY POSTCARDS",
    assetName: "onboarding_icon_1.svg",
    imageAlt: "Why postcards are effective in D.C."
  },
  {
    title: "Canary does the hard work for you.",
    subtitle: "It researches the issues you care about — then writes a clear, persuasive postcard in seconds.",
    iconPlaceholder: "ICON / CANARY RESEARCH",
    assetName: "onboarding_icon_2.svg",
    imageAlt: "Canary research process"
  },
  {
    title: "Your words, written in real ink with a real pen.",
    subtitle: "Indistinguishable from human handwriting. Authentic and personal.",
    finePrint: "Written by a robot holding a blue ballpoint. Authentic & affordable",
    iconPlaceholder: "ICON / REAL INK HANDWRITING",
    assetName: "onboarding_icon_3.svg",
    imageAlt: "Real handwriting with ink and pen"
  },
  {
    title: "No stamps. No hassle.",
    subtitle: "Your postcard is mailed straight to your representative's desk.",
    iconPlaceholder: "ICON / MAILED FOR YOU",
    assetName: "onboarding_icon_4.svg",
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
  const [showControls, setShowControls] = useState(false);


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
        className="fixed left-0 right-0 z-40"
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
        className="relative h-full w-full touch-pan-x select-none group"
        style={{ 
          paddingTop: showSharedBanner ? 'calc(3.25rem + 5.5rem)' : '5.75rem'
        }}
        onClick={handleClick}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Desktop Hover Navigation Controls */}
        <div className={`hidden md:block transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Left Navigation Area */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoplayStopped(true);
              setProgress(100);
              prevSlide();
            }}
            disabled={currentSlide === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-all ${
              currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'
            }`}
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          {/* Right Navigation Area */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoplayStopped(true);
              setProgress(100);
              nextSlide();
            }}
            disabled={currentSlide === TOTAL_SLIDES - 1}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/40 transition-all ${
              currentSlide === TOTAL_SLIDES - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'
            }`}
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Slide Indicator Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-30">
            {Array.from({ length: TOTAL_SLIDES }, (_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(index);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentSlide 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

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