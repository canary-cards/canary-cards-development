import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <Card className="card-warm">
            <CardContent className="p-8 text-center">
              <h1 className="display-title">Privacy & Terms</h1>
              <p className="body-text text-secondary mt-2">Last updated: September 25, 2025</p>
            </CardContent>
          </Card>

          {/* Introduction */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Introduction</h2>
              <p className="body-text">
                Canary Cards makes it simple to send real, handwritten postcards to your elected officials. This document explains how we handle your information and the basic terms for using our service. By using Canary Cards, you agree to these terms.
              </p>
            </CardContent>
          </Card>

          {/* Who Can Use */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Who Can Use Canary Cards</h2>
              <ul className="body-text space-y-2">
                <li>• You must be 18 or older.</li>
                <li>• Use our service only for lawful purposes. Don't use it to harass, spam, or break election laws.</li>
              </ul>
            </CardContent>
          </Card>

          {/* What We Collect */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">What We Collect</h2>
              <p className="body-text">To send your postcards, we collect:</p>
              <ul className="body-text space-y-2 mt-4">
                <li>• <strong>Email address</strong>: used for receipts, delivery updates, and occasional marketing emails.</li>
                <li>• <strong>Mailing address</strong>: only to correctly send your postcard to your representative.</li>
                <li>• <strong>Postcard content</strong>: the text you write or generate.</li>
                <li>• <strong>Payment info</strong>: processed securely by our payment providers (we don't store card numbers).</li>
                <li>• <strong>Usage data</strong>: basic analytics on how people use Canary Cards.</li>
              </ul>
            </CardContent>
          </Card>

          {/* How We Use Data */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">How We Use Your Data</h2>
              <p className="body-text">We use your information to:</p>
              <ul className="body-text space-y-2 mt-4">
                <li>• Send and deliver postcards.</li>
                <li>• Provide order confirmations and delivery updates.</li>
                <li>• Improve Canary Cards.</li>
                <li>• Understand what issues matter to communities.</li>
                <li>• Send occasional marketing emails (you can opt out at any time).</li>
              </ul>
              <p className="body-text mt-4">
                We may use <strong>aggregate, de-identified data</strong> (for example: "500 people in District 5 wrote about climate this month") for research, reporting, or commercial purposes. We will never tie this information to your name, address, or individual messages.
              </p>
            </CardContent>
          </Card>

          {/* What We Don't Do */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">What We Don't Do</h2>
              <ul className="body-text space-y-2">
                <li>• We do not sell or share your personal data (name, address, email).</li>
                <li>• We do not share your individual postcard text beyond what's required to fulfill and deliver it.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Sharing With Partners */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Sharing With Trusted Partners</h2>
              <p className="body-text">We share only what's necessary with vendors who help us operate:</p>
              <ul className="body-text space-y-2 mt-4">
                <li>• <strong>IgnitePost</strong> to write and mail postcards.</li>
                <li>• <strong>Supabase</strong> to securely store postcard text.</li>
                <li>• <strong>Geocodio / Google Places</strong> to look up representatives and validate addresses.</li>
                <li>• <strong>Stripe / Resend</strong> for payments and transactional emails.</li>
              </ul>
              <p className="body-text mt-4">
                We may also share information if required by law.
              </p>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Your Choices & Rights</h2>
              <ul className="body-text space-y-2">
                <li>• You can opt out of marketing emails anytime by clicking "unsubscribe" in the email or contacting us.</li>
                <li>• You can request a copy of the data we hold about you.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Security</h2>
              <p className="body-text">
                We use industry-standard safeguards (encrypted connections, secure vendors, limited access). No system is 100% secure, but we take protecting your data seriously.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-4">
              <h2 className="eyebrow-lowercase text-secondary">Contact Us</h2>
              <p className="body-text">
                Questions or concerns? Reach us at <strong><a href="mailto:hello@canary.cards" className="text-primary underline decoration-primary hover-safe:no-underline">hello@canary.cards</a></strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}