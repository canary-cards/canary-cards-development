import React, { useEffect, useRef, useState } from 'react';
import { Player } from '@lottiefiles/react-lottie-player';

interface CrossfadeLottieProps {
  onComplete?: () => void;
}

export function CrossfadeLottie({ onComplete }: CrossfadeLottieProps) {
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [playerAVisible, setPlayerAVisible] = useState(true);
  const [playerBVisible, setPlayerBVisible] = useState(false);
  const [currentAnimIndex, setCurrentAnimIndex] = useState(0);
  
  const playerARef = useRef<any>(null);
  const playerBRef = useRef<any>(null);

  // Import animations
  const animations = [
    require('@/assets/animations/animation-0.json'),
    require('@/assets/animations/animation-1.json'),
    require('@/assets/animations/animation-2.json'),
  ];

  useEffect(() => {
    console.log('🎬 CrossfadeLottie mounted, starting animation sequence');
    const timers: number[] = [];
    const FADE_DURATION = 1500; // 1.5s CSS fade
    const ANIMATION_0_DURATION = 4500; // 4.5s
    const ANIMATION_1_DURATION = 4000; // 4s

    const crossfadeTo = (nextIndex: number, fromPlayer: 'A' | 'B') => {
      console.log(`🎬 Crossfading from ${fromPlayer} to animation ${nextIndex}`);
      const nextPlayer = fromPlayer === 'A' ? 'B' : 'A';
      const nextPlayerRef = nextPlayer === 'A' ? playerARef : playerBRef;

      // Fade out current
      if (fromPlayer === 'A') {
        setPlayerAVisible(false);
      } else {
        setPlayerBVisible(false);
      }

      // After fade completes, switch
      timers.push(window.setTimeout(() => {
        setCurrentAnimIndex(nextIndex);
        setActivePlayer(nextPlayer);
        
        // Fade in next
        if (nextPlayer === 'A') {
          setPlayerAVisible(true);
        } else {
          setPlayerBVisible(true);
        }

        // Start playback
        if (nextPlayerRef.current) {
          nextPlayerRef.current.play();
        }
      }, FADE_DURATION));
    };

    // Sequence: anim0 (4.5s) → crossfade → anim1 (4s) → crossfade → anim2 (loop)
    timers.push(window.setTimeout(() => {
      crossfadeTo(1, 'A');

      timers.push(window.setTimeout(() => {
        crossfadeTo(2, 'B');
        // Animation 2 loops indefinitely until onComplete is called externally
      }, ANIMATION_1_DURATION + FADE_DURATION * 2));
    }, ANIMATION_0_DURATION));

    return () => {
      console.log('🧹 Cleaning up CrossfadeLottie timers');
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-[66vw] h-[66vw] max-w-sm sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] flex items-center justify-center ml-[13px]">
      <div className="w-full h-full flex items-center justify-center relative">
        {/* Player A */}
        <div
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{
            opacity: playerAVisible ? 1 : 0,
            pointerEvents: playerAVisible ? 'auto' : 'none',
          }}
        >
          <Player
            ref={playerARef}
            autoplay={activePlayer === 'A' && currentAnimIndex === 0}
            loop={currentAnimIndex === 0 || currentAnimIndex === 2}
            src={animations[currentAnimIndex]}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Player B */}
        <div
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{
            opacity: playerBVisible ? 1 : 0,
            pointerEvents: playerBVisible ? 'auto' : 'none',
          }}
        >
          <Player
            ref={playerBRef}
            autoplay={false}
            loop={false}
            src={animations[0]}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
