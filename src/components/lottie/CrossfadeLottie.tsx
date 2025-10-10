import React, { useEffect, useRef, useState } from 'react';
import { Player } from '@lottiefiles/react-lottie-player';
import animation0 from '@/assets/animations/animation-0.json';
import animation1 from '@/assets/animations/animation-1.json';
import animation2 from '@/assets/animations/animation-2.json';

interface CrossfadeLottieProps {
  onComplete?: () => void;
}

export function CrossfadeLottie({ onComplete }: CrossfadeLottieProps) {
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [playerAVisible, setPlayerAVisible] = useState(true);
  const [playerBVisible, setPlayerBVisible] = useState(false);
  const [playerAAnimIndex, setPlayerAAnimIndex] = useState(0);
  const [playerBAnimIndex, setPlayerBAnimIndex] = useState(0);
  
  const playerARef = useRef<any>(null);
  const playerBRef = useRef<any>(null);

  const animations = [animation0, animation1, animation2];

  useEffect(() => {
    console.log('🎬 CrossfadeLottie mounted, starting animation sequence');
    const timers: number[] = [];
    const FADE_DURATION = 800; // 0.8s fade (shorter for smoother transition)
    const ANIMATION_0_DURATION = 4500; // 4.5s
    const ANIMATION_1_DURATION = 4000; // 4s

    const crossfadeTo = (nextIndex: number, fromPlayer: 'A' | 'B') => {
      console.log(`🎬 Crossfading from ${fromPlayer} to animation ${nextIndex}`);
      const nextPlayer = fromPlayer === 'A' ? 'B' : 'A';
      const nextPlayerRef = nextPlayer === 'A' ? playerARef : playerBRef;

      // FIRST: Preload the animation on the hidden player
      if (nextPlayer === 'A') {
        setPlayerAAnimIndex(nextIndex);
      } else {
        setPlayerBAnimIndex(nextIndex);
      }

      // Wait 100ms for animation to load
      timers.push(window.setTimeout(() => {
        console.log(`🎬 Animation ${nextIndex} loaded, starting crossfade`);
        
        setActivePlayer(nextPlayer);
        
        // Fade out current AND fade in next AT THE SAME TIME (overlapping)
        if (fromPlayer === 'A') {
          setPlayerAVisible(false);
          setPlayerBVisible(true);
        } else {
          setPlayerBVisible(false);
          setPlayerAVisible(true);
        }

        // Start playback immediately
        if (nextPlayerRef.current) {
          nextPlayerRef.current.play();
        }
      }, 100)); // Wait for preload
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
          className="absolute inset-0 transition-opacity duration-[800ms] ease-in-out"
          style={{
            opacity: playerAVisible ? 1 : 0,
            pointerEvents: playerAVisible ? 'auto' : 'none',
          }}
        >
          <Player
            ref={playerARef}
            autoplay={activePlayer === 'A' && playerAAnimIndex === 0}
            loop={playerAAnimIndex === 0 || playerAAnimIndex === 2}
            src={animations[playerAAnimIndex]}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Player B */}
        <div
          className="absolute inset-0 transition-opacity duration-[800ms] ease-in-out"
          style={{
            opacity: playerBVisible ? 1 : 0,
            pointerEvents: playerBVisible ? 'auto' : 'none',
          }}
        >
          <Player
            ref={playerBRef}
            autoplay={false}
            loop={playerBAnimIndex === 2}
            src={animations[playerBAnimIndex]}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
