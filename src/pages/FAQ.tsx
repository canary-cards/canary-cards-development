import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { HamburgerMenu } from '@/components/HamburgerMenu';

export default function FAQ() {
  const [openResearchMenu, setOpenResearchMenu] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <Card className="card-warm">
            <CardContent className="p-8 text-center">
              <h1 className="display-title">FAQ</h1>
            </CardContent>
          </Card>

          {/* All FAQ Content */}
          <Card className="card-warm">
            <CardContent className="p-8 space-y-8">
              {/* About the postcard */}
              <div className="space-y-4">
                <h2 className="eyebrow-lowercase text-primary">About the postcard</h2>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="eyebrow normal-case text-primary">
                      What does my postcard look like?
                    </h3>
                    <p className="body-text">
                      A sturdy 5×7 postcard on glossy stock featuring beautiful imagery of great American national parks. Real words, real ink, mailed to your representative.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="eyebrow normal-case text-primary">
                      Is it really handwritten?
                    </h3>
                    <p className="body-text">
                      Yes. Robots use real pens with natural variations in pressure, spacing, and letter forms — indistinguishable from human handwriting.
                    </p>
                  </div>
                </div>
              </div>

              {/* Why it works */}
              <div className="space-y-4">
                <h2 className="eyebrow-lowercase text-primary">Why it works</h2>
                <div className="space-y-3">
                  <h3 className="eyebrow normal-case text-primary">
                    Do postcards really make a difference?
                  </h3>
                  <p className="body-text">
                    Yes. Research shows that personalized correspondence is the best way to make your voice heard, and physical mail cannot be ignored.{' '}
                    <button
                      onClick={() => setOpenResearchMenu(true)}
                      className="text-blue-600 underline hover:text-blue-800 font-medium cursor-pointer"
                    >
                      See the Research
                    </button>
                  </p>
                </div>
              </div>

              {/* How it works */}
              <div className="space-y-4">
                <h2 className="eyebrow-lowercase text-primary">How it works</h2>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="eyebrow normal-case text-primary">
                      How do the robots work?
                    </h3>
                    <p className="body-text">
                      We send your message to robots that hold real pens and write each card uniquely. Then we drop it in the mail.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h3 className="eyebrow normal-case text-primary">
                      Will I know when my card is sent?
                    </h3>
                    <p className="body-text">
                      Yes. You'll get a confirmation email once your card has been mailed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Non-partisan promise */}
              <div className="space-y-4">
                <h2 className="eyebrow-lowercase text-primary">Non-partisan promise</h2>
                <div className="space-y-3">
                  <h3 className="eyebrow normal-case text-primary">
                    Is Canary partisan?
                  </h3>
                  <p className="body-text">
                    No. Canary is proudly non-partisan. It works for anyone who wants their voice heard.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <HamburgerMenu
        isDark={false}
        initialView="research"
        externalOpen={openResearchMenu}
        externalSetOpen={setOpenResearchMenu}
        hideTrigger={true}
      />
    </div>
  );
}