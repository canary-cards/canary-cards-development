import React from 'react';
import { Button } from './ui/button';
import { useAppContext } from '../context/AppContext';
import { Search, User, ShoppingBag } from 'lucide-react';
import { Logo } from './Logo';

export function LandingPage() {
  const { dispatch } = useAppContext();

  const handleStartWriting = () => {
    dispatch({ type: 'SET_STEP', payload: 1 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-900 dark:to-emerald-950">
      {/* Navigation Header */}
      <header className="w-full px-6 py-4">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-8">
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Home</span>
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">About</span>
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">How it Works</span>
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Contact</span>
          </div>
          
          {/* Centered Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo className="h-10" />
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Services</span>
            <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">Account</span>
            <Search className="w-5 h-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex items-center justify-between max-w-7xl mx-auto px-6 py-16 min-h-[80vh]">
        {/* Left Content */}
        <div className="flex-1 max-w-xl">
          
          
          <h1 className="text-6xl md:text-7xl display-title font-normal leading-tight mb-8">
            Handwritten
            <br />
            <span className="font-bold">Postcards</span>
            <br />
            <span className="font-normal">to Your Reps</span>
          </h1>
          
          <p className="text-lg body-text text-muted-foreground mb-8 leading-relaxed max-w-md">
            Send authentic, handwritten postcards to your elected representatives. 
            Real ink, real impact, delivered directly to their offices.
          </p>
          
          <Button 
            size="lg" 
            onClick={handleStartWriting}
            className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-base font-medium rounded-sm transition-all duration-300 hover:shadow-lg"
          >
            Start Writing →
          </Button>
        </div>

        {/* Right Content - Machine Image */}
        <div className="flex-1 relative">
          <div className="relative">
            {/* Background decorative elements */}
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-emerald-200/30 dark:bg-emerald-800/20 rounded-full blur-3xl"></div>
            <div className="absolute top-20 -left-10 w-48 h-48 bg-slate-200/40 dark:bg-slate-700/20 rounded-full blur-2xl"></div>
            
            {/* Machine Image */}
            <div className="relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <img 
                src="/lovable-uploads/4a28f90c-fcc7-44c5-8ba8-0dd0d56a5a9d.png"
                alt="Automated handwriting machine creating personalized postcards"
                className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl border border-border/20"
              />
            </div>
            
            {/* Floating elements */}
            <div className="absolute top-16 right-12 bg-card/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border/20 transform rotate-6 hover:rotate-3 transition-transform duration-300">
              <p className="text-xs text-muted-foreground mb-1">Real Handwriting</p>
              <p className="text-sm font-medium">Authentic • Personal</p>
            </div>
            
            <div className="absolute bottom-20 left-8 bg-card/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border/20 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <p className="text-xs text-muted-foreground mb-1">Direct Delivery</p>
              <p className="text-sm font-medium">To Representatives</p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Features */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-600 dark:text-emerald-400 text-xl">✍️</span>
            </div>
            <h3 className="subtitle text-base mb-2">Authentic Handwriting</h3>
            <p className="text-sm body-text text-muted-foreground">Real ink on real paper, written by advanced robotics</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 dark:text-blue-400 text-xl">🏛️</span>
            </div>
            <h3 className="subtitle text-base mb-2">Direct to Officials</h3>
            <p className="text-sm body-text text-muted-foreground">Delivered straight to your representatives' offices</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-purple-600 dark:text-purple-400 text-xl">⚡</span>
            </div>
            <h3 className="subtitle text-base mb-2">Maximum Impact</h3>
            <p className="text-sm body-text text-muted-foreground">Stand out from digital messages with tangible mail</p>
          </div>
        </div>
      </section>
    </div>
  );
}