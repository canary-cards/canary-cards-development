import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <Card className="card-warm">
            <CardContent className="p-8 text-center">
              <h1 className="display-title">Contact Us</h1>
            </CardContent>
          </Card>

          {/* Contact Content */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <h2 className="eyebrow-lowercase text-secondary">Get in touch</h2>
                <p className="body-text">
                  We'd love to hear from you.
                </p>
                <div className="space-y-6">
                  <div className="space-y-3 pt-2">
                    <h3 className="eyebrow normal-case text-primary">
                      Questions, ideas, or feedback?
                    </h3>
                    <p className="body-text">
                      Reach out anytime — we read every message, even if it takes a couple of days to reply.
                    </p>
                  </div>
                  <div className="pt-4">
                    <p className="body-text">
                      <strong>📧 <a href="mailto:hello@canary.cards" className="text-primary underline decoration-primary hover:no-underline">hello@canary.cards</a></strong>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}