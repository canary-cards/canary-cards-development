import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DynamicSvg } from '@/components/DynamicSvg';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Research() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto px-4 max-w-2xl py-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="display-title mb-4">The Research</h1>
          <p className="subtitle text-base">
            The science behind why handwritten postcards cut through
          </p>
        </div>

        {/* Main Content Card */}
        <Card className="mb-6 border-primary/20 shadow-sm">
          <CardContent className="px-6 py-8 space-y-8">
            {/* Section 1: Personalized correspondence */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                1. Personalized correspondence is the key to influence.
              </h2>
              <p className="body-text text-foreground leading-relaxed">
                Congressional offices consistently state that nothing has more sway on undecided votes than personalized communication from real constituents—not mass petitions, not form letters, not even most calls. In fact, 96% of Capitol Hill staff say that personalized letters specifically influence how their bosses vote, especially when the issue is undecided. The Congressional Management Foundation's research has found that messages which include personal stories, details about how an issue affects the sender, and some sign of genuine effort—like writing by hand—get more attention and are far more likely to be passed directly to the Member.
              </p>

              {/* Responsive Chart */}
              <div className="w-full mt-6 mb-4">
                <DynamicSvg
                  assetName="constituent-importance-mobile.svg"
                  alt="Chart showing constituent importance rankings - mobile view"
                  className="w-full h-auto md:hidden"
                />
                <DynamicSvg
                  assetName="constituent-importance-desktop.svg"
                  alt="Chart showing constituent importance rankings - desktop view"
                  className="hidden md:block w-full h-auto"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                Data source: CMF 2011 Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill
              </p>
            </div>

            {/* Section 2: AI impact */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                2. Generative AI has changed the email game.
              </h2>
              <p className="body-text text-foreground leading-relaxed">
                Mass AI-generated emails can now mimic personalization. According to CMF, many congressional offices are increasingly aware of this and are treating many digital messages—no matter how "personal"—like form emails, discounting their impact.
              </p>
            </div>

            {/* Section 3: Physical mail advantages */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                3. Physical mail cuts through.
              </h2>
              <p className="body-text text-foreground leading-relaxed">
                We use AI to help write the postcards, but our postcards are AI-proof. Congressional offices use digital tools and AI to scan, categorize, and filter emails before any human reads them. Physical postcards must be handled, sorted, and read by a real person, guaranteeing your message breaks through the digital wall.
              </p>
            </div>

            {/* Call to action */}
            <div className="text-center pt-6 border-t border-muted">
              <p className="text-lg font-semibold text-primary mb-4">
                Send a postcard. Be heard.
              </p>
              <Button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto"
              >
                Get Started
              </Button>
            </div>

            {/* Sources */}
            <div className="pt-6 border-t border-muted/50">
              <p className="text-sm font-medium text-foreground mb-3">Sources:</p>
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Abernathy, C.E. (2015). Legislative Correspondence Management Practices: Congressional Offices and the Treatment of Constituent Opinion. Vanderbilt University Ph.D. Dissertation.
                </p>
                <p>Congressional Management Foundation. Building Trust by Modernizing Constituent Engagement (2022).</p>
                <p>
                  Congressional Management Foundation. Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill (2011).
                </p>
                <p>
                  Congressional Management Foundation. Communicating with Congress: How Citizen Advocacy Is Changing Mail Operations on Capitol Hill (2011).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
