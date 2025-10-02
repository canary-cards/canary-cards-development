import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
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
              <h2 className="eyebrow-lowercase text-secondary">Why we built this</h2>
              <p className="body-text">
                We built Canary Cards because we were frustrated, too.
              </p>
              <p className="body-text">
                Buying postcards, finding stamps, handwriting a message, and hauling it to the post office — all that effort makes it easy to give up.
              </p>
            </CardContent>
          </Card>

          {/* Solution Card */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Why this works</h2>
              <p className="body-text">
                Postcards cut through. A real card lands on your representative's desk, where emails and petitions usually don't.
              </p>
              <p className="body-text">
                In under two minutes, you write. We handle the rest — non-partisan, no extra steps, just your voice delivered.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}