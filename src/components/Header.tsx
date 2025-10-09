import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { HamburgerMenu } from './HamburgerMenu';
import { DesktopNav } from './navigation/DesktopNav';
import { Logo } from './Logo';
import { useIsMobile } from '../hooks/use-mobile';

interface HeaderProps {
  className?: string;
  isDark?: boolean;
}

export function Header({ className, isDark = false }: HeaderProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAppContext();
  const [scrolled, setScrolled] = useState(false);

  // Add scroll listener for shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogoClick = () => {
    console.log('🖱️ Logo clicked - current path:', location.pathname);
    
    if (location.pathname === '/') {
      // Already on home page, directly reset state
      console.log('🏠 Already on home - directly resetting state');
      dispatch({ type: 'RESET_TO_HOME' });
    } else {
      // Navigate to home page
      console.log('🔄 Navigating to home');
      navigate('/', { state: { skipOnboarding: true } });
    }
  };

  return (
    <header 
      className={`
        h-16 md:h-18 
        sticky top-0 z-[100]
        ${isDark ? 'bg-primary' : 'bg-surface'} 
        ${scrolled ? 'shadow-md' : ''} 
        transition-shadow duration-200
        ${className || ''}
      `}
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-full max-w-7xl mx-auto">
        {/* Left: Logo */}
        <button 
          onClick={handleLogoClick}
          className="flex items-center space-x-3 hover-safe:opacity-80 transition-opacity"
          aria-label="Go to home"
          data-attr="click-header-logo"
        >
          <Logo className="h-10" />
          <div className="hidden">
            <span className={`font-patrick-hand text-3xl text-left ${isDark ? 'text-background' : 'text-primary'}`}>
              Canary Cards
            </span>
          </div>
        </button>
        
        {/* Only show navigation if NOT on onboarding page */}
        {!location.pathname.startsWith('/onboarding') && (
          <>
            {isMobile ? (
              <div className="ml-auto">
                <HamburgerMenu isDark={isDark} />
              </div>
            ) : (
              <DesktopNav />
            )}
          </>
        )}
      </div>
    </header>
  );
}
