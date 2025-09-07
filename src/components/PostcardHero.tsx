import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Repeat } from 'lucide-react';

interface PostcardHeroProps {
  className?: string;
}

const ZOOM_SCALE = 2.5;
const PAN_THRESHOLD = 6;

export function PostcardHero({ className = '' }: PostcardHeroProps) {
  const [isShowingBack, setIsShowingBack] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  
  // Refs to avoid stale closures and for panning
  const lastTapTimeRef = useRef(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPanningRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const startTranslateRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const frontImageRef = useRef<HTMLDivElement>(null);
  const backImageRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number>(0);

  const images = [
    { src: '/lovable-uploads/923b18b9-bce0-4521-a280-f38eaec3e09c.png', alt: 'Postcard back with handwritten message' },
    { src: '/postcard_front.png', alt: 'Postcard front with Yosemite scenery' }
  ];

  // Preload images aggressively for instant loading
  useEffect(() => {
    const preloadPromises = images.map(image => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = image.src;
      });
    });
    
    // Wait for all images to load
    Promise.all(preloadPromises).catch(console.error);
  }, []);


  // Flip animation handler
  const performFlip = () => {
    if (isFlipping || isZoomed) return; // Prevent flipping while zoomed
    
    setIsBouncing(true);
    setIsFlipping(true);
    setIsShowingBack(prev => !prev);
    
    // Reset flip state after animation completes
    setTimeout(() => {
      setIsFlipping(false);
    }, 500);
    
    // Reset bounce state quickly
    setTimeout(() => {
      setIsBouncing(false);
    }, 150);
  };

  // GPU-optimized panning functions
  const updateTransformImmediate = (x: number, y: number) => {
    const frontEl = frontImageRef.current;
    const backEl = backImageRef.current;
    
    if (frontEl) {
      frontEl.style.willChange = 'transform';
      frontEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${isZoomed ? ZOOM_SCALE : 1})`;
      frontEl.style.webkitBackfaceVisibility = 'hidden';
    }
    if (backEl) {
      backEl.style.willChange = 'transform';
      backEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${isZoomed ? ZOOM_SCALE : 1})`;
      backEl.style.webkitBackfaceVisibility = 'hidden';
    }
  };

  const clearImperativeStyles = () => {
    const frontEl = frontImageRef.current;
    const backEl = backImageRef.current;
    
    [frontEl, backEl].forEach(el => {
      if (el) {
        el.style.transform = '';
        el.style.transition = '';
        el.style.willChange = '';
        el.style.webkitBackfaceVisibility = '';
      }
    });
  };

  const enableTransitions = () => {
    const frontEl = frontImageRef.current;
    const backEl = backImageRef.current;
    
    if (isZoomed) {
      // Re-enable transitions only if still zoomed
      if (frontEl) frontEl.style.transition = 'transform 0.3s ease-out';
      if (backEl) backEl.style.transition = 'transform 0.3s ease-out';
    } else {
      // Clear transitions if not zoomed
      if (frontEl) frontEl.style.transition = '';
      if (backEl) backEl.style.transition = '';
    }
  };

  const disableTransitions = () => {
    const frontEl = frontImageRef.current;
    const backEl = backImageRef.current;
    
    if (frontEl) {
      frontEl.style.transition = 'none';
    }
    if (backEl) {
      backEl.style.transition = 'none';
    }
  };

  // Helper function to clamp translation within bounds
  const clampTranslate = (x: number, y: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const imageWidth = rect.width * ZOOM_SCALE;
    const imageHeight = rect.height * ZOOM_SCALE;
    
    const maxX = (imageWidth - rect.width) / 2;
    const maxY = (imageHeight - rect.height) / 2;
    
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y))
    };
  };

  // Handle pointer down
  const handlePointerDown = (event: React.PointerEvent) => {
    if (isFlipping) return;

    const currentTime = Date.now();
    const timeDiff = currentTime - lastTapTimeRef.current;

    if (timeDiff < 350) {
      // Double tap detected - zoom and cancel any pending single tap
      event.preventDefault();
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      setIsZoomed(prev => {
        const newZoomed = !prev;
        if (!newZoomed) {
          // Clean zoom-out reset
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = 0;
          }
          isPanningRef.current = false;
          setTranslate({ x: 0, y: 0 });
          clearImperativeStyles(); // Clear all imperative DOM styles
        }
        return newZoomed;
      });
      lastTapTimeRef.current = 0; // Reset to prevent triple tap
    } else {
      // Potential single tap or start of pan
      lastTapTimeRef.current = currentTime;
      
      if (isZoomed) {
        // Start panning setup
        event.preventDefault();
        (event.target as Element).setPointerCapture(event.pointerId);
        isPanningRef.current = false;
        startPointerRef.current = { x: event.clientX, y: event.clientY };
        startTranslateRef.current = { ...translate };
      } else {
        // Clear any existing timeout
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
        }
        
        // Set up delayed flip action
        singleTapTimeoutRef.current = setTimeout(() => {
          // Only flip if this tap wasn't followed by another tap (double tap)
          if (Date.now() - lastTapTimeRef.current >= 300 && !isPanningRef.current) {
            performFlip();
          }
          singleTapTimeoutRef.current = null;
        }, 350);
      }
    }
  };

  // Handle pointer move (for panning)
  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isZoomed || isFlipping) return;

    event.preventDefault();
    const deltaX = event.clientX - startPointerRef.current.x;
    const deltaY = event.clientY - startPointerRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > PAN_THRESHOLD) {
      if (!isPanningRef.current) {
        isPanningRef.current = true;
        disableTransitions();
        // Clear single tap timeout if we start panning
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
        lastTapTimeRef.current = 0; // Clear tap timing
      }

      // Cancel any existing RAF
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Use RAF for smooth panning
      rafIdRef.current = requestAnimationFrame(() => {
        const newTranslate = clampTranslate(
          startTranslateRef.current.x + deltaX,
          startTranslateRef.current.y + deltaY
        );
        
        // Update DOM immediately
        updateTransformImmediate(newTranslate.x, newTranslate.y);
        
        // Update state for other systems
        setTranslate(newTranslate);
      });
    }
  };

  // Handle pointer up/cancel
  const handlePointerUp = (event: React.PointerEvent) => {
    if (isPanningRef.current) {
      // Re-enable transitions after panning
      enableTransitions();
      isPanningRef.current = false;
      
      // Cancel any pending RAF
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      
      // Release pointer capture
      try {
        (event.target as Element).releasePointerCapture(event.pointerId);
      } catch (e) {
        // Ignore errors if capture was already released
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hero Card containing everything */}
      <Card className="p-6">
        {/* Hero text */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary mb-2 font-display">
            Here's how your postcard will look.
          </h1>
          <p className="text-secondary font-inter">
            This is an example — your message will be written with a ballpoint pen on a real postcard we mail for you
          </p>
        </div>

        {/* Caption */}
        <div className="text-center mb-3">
          <p className="text-sm text-muted-foreground font-inter">
            {isShowingBack ? "Back — Your message" : "Front — Photo side"}
          </p>
        </div>

        {/* Postcard Images */}
        <div className="relative overflow-hidden bg-white shadow-xl rounded-lg mb-4" style={{ perspective: '1000px' }}>
          {/* Bounce wrapper */}
          <div 
            className={`relative aspect-[1.6/1] ${
              isBouncing ? 'animate-[bounce_0.2s_ease-out]' : ''
            }`}
          >
            {/* 3D Rotator */}
            <div 
              ref={containerRef}
              className={`w-full h-full transition-transform duration-500 transform-gpu ${
                isZoomed ? (isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ 
                transformStyle: 'preserve-3d',
                transform: `rotateY(${isShowingBack ? 180 : 0}deg)`,
                touchAction: isZoomed ? 'none' : 'manipulation'
              }}
            >
              {/* Front Face */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div
                  ref={frontImageRef}
                  className="w-full h-full transition-transform duration-300"
                  style={{
                    transform: isZoomed || (translate.x !== 0 || translate.y !== 0) 
                      ? `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${isZoomed ? ZOOM_SCALE : 1})`
                      : 'none',
                    transformOrigin: 'center center',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  <img
                    src={images[1].src}
                    alt={images[1].alt}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </div>

              {/* Back Face */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <div
                  ref={backImageRef}
                  className="w-full h-full transition-transform duration-300"
                  style={{
                    transform: isZoomed || (translate.x !== 0 || translate.y !== 0) 
                      ? `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${isZoomed ? ZOOM_SCALE : 1})`
                      : 'none',
                    transformOrigin: 'center center',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  <img
                    src={images[0].src}
                    alt={images[0].alt}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Circular Flip Button - only show when not zoomed */}
          {!isZoomed && (
            <Button 
              variant="primary"
              size="icon"
              onPointerDown={(e) => {
                e.stopPropagation();
                performFlip();
              }}
              className={`absolute bottom-4 right-4 !w-10 !h-10 !min-h-0 rounded-full shadow-lg hover:shadow-xl transition-all p-0 min-w-0 ${
                isFlipping ? 'scale-110 rotate-180' : 'hover:scale-105'
              }`}
              aria-label="Flip postcard"
              disabled={isFlipping}
            >
              <Repeat className="h-4 w-4 text-accent" />
            </Button>
          )}
        </div>

        {/* Instructions for mobile */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Double tap to zoom in.</p>
        </div>
      </Card>
    </div>
  );
}