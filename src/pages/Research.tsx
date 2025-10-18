import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { HamburgerMenu } from '../components/HamburgerMenu';

const Research = () => {
  const [menuOpen, setMenuOpen] = useState(true);

  // Ensure menu opens on mount
  useEffect(() => {
    setMenuOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl display-title mb-4">Research & Evidence</h1>
          <p className="text-lg body-text text-muted-foreground mb-6">
            Learn why handwritten postcards are the most effective way to make your voice heard in Congress.
          </p>
          <button
            onClick={() => setMenuOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
          >
            View Research
          </button>
        </div>
      </main>
      
      {/* Hidden trigger, controlled externally */}
      <HamburgerMenu
        initialView="research"
        externalOpen={menuOpen}
        externalSetOpen={setMenuOpen}
        hideTrigger={true}
      />
    </div>
  );
};

export default Research;
