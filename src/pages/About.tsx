import React, { useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import posthog from 'posthog-js';

export default function About() {
  // Track page view when component mounts
  useEffect(() => {
    if (posthog.__loaded) {
      posthog.capture('view_about_page');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <Card className="card-warm">
            <CardContent className="p-8 text-center">
              <h1 className="display-title">About Canary</h1>
            </CardContent>
          </Card>

          {/* Story Card */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Why We Built Canary</h2>
              <p className="body-text">
                When the early drafts of the One Big Beautiful Bill Act included sweeping public land sell‑offs, Americans from all sides flooded Congress with letters, postcards, and phone calls demanding: <strong>public land is not for sale</strong>. The public backlash was so intense that lawmakers across the political spectrum quietly stripped out the land‑sale provisions from the final legislation.
              </p>
              <p className="body-text">
                That moment made something very clear to us: <strong>when people speak, decision‑makers listen</strong>. The problem is, most citizens lack the time, the confidence, or the know‑how to turn their concern into real influence.
              </p>
              <p className="body-text">
                So we built <strong>Canary</strong>, to lower the barrier so that every constituent can be heard. In just a couple of taps, your voice adds to a movement that can't be ignored. Real change can start with one clear message—your message—landing where it matters.
              </p>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}