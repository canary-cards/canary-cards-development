import React from 'react';
import { DynamicSvg } from '@/components/DynamicSvg';
import { ExpandableChart } from '@/components/ExpandableChart';

export function AboutContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why We Built Canary</h3>
        <p className="body-text">
          When the early drafts of the One Big Beautiful Bill Act included sweeping public land sell‑offs, Americans from all sides flooded Congress with letters, postcards, and phone calls demanding: <strong>public land is not for sale</strong>. The public backlash was so intense that lawmakers across the political spectrum quietly stripped out the land‑sale provisions from the final legislation.
        </p>
        <p className="body-text">
          That moment made something very clear to us: <strong>when people speak, decision‑makers listen</strong>. The problem is, most citizens lack the time, the confidence, or the know‑how to turn their concern into real influence.
        </p>
        <p className="body-text">
          So we built <strong>Canary</strong>, to lower the barrier so that every constituent can be heard. In just a couple of taps, your voice adds to a movement that can't be ignored. Real change can start with one clear message—your message—landing where it matters.
        </p>
      </div>
    </div>
  );
}

export function FAQContent({ onSeeResearch }: { onSeeResearch?: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          What does my postcard look like?
        </h4>
        <p className="body-text">
          A sturdy 5×7 postcard on glossy stock featuring beautiful imagery of great American national parks. Real words, real ink, mailed to your representative.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          Is it really handwritten?
        </h4>
        <p className="body-text">
          Yes. Robots use real pens with natural variations in pressure, spacing, and letter forms — indistinguishable from human handwriting.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          Do postcards really make a difference?
        </h4>
        <div>
          <p className="body-text">
            Yes. Research shows that personalized correspondence is the best way to make your voice heard, and physical mail cannot be ignored.
          </p>
          {onSeeResearch && (
            <button
              onClick={onSeeResearch}
              className="text-blue-600 underline hover:text-blue-800 cursor-pointer block mt-1"
            >
              See the Research
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          How do the robots work?
        </h4>
        <p className="body-text">
          We send your message to robots that hold real pens and write each card uniquely. Then we drop it in the mail.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          Will I know when my card is sent?
        </h4>
        <p className="body-text">
          Yes. You'll get a confirmation email once your card has been mailed.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          Do you sell my personal information?
        </h4>
        <p className="body-text">
          No. We don't sell your personal data (names, addresses, emails, or individual postcard content). We may sell aggregated, anonymized data at the house district level to help organizations understand community engagement trends.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="eyebrow normal-case text-secondary">
          Is Canary partisan?
        </h4>
        <p className="body-text">
          No. Canary is proudly non-partisan. It works for anyone who wants their voice heard.
        </p>
      </div>
    </div>
  );
}

export function ContactContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Get in touch</h3>
        <p className="body-text">
          We'd love to hear from you.
        </p>
        <div className="space-y-6">
          <div className="space-y-3 pt-2">
            <h4 className="eyebrow normal-case text-primary">
              Questions, ideas, or feedback?
            </h4>
            <p className="body-text">
              Reach out anytime — we read every message, even if it takes a couple of days to reply.
            </p>
          </div>
          <div className="pt-4">
             <p className="body-text">
               <strong>📧 <a href="mailto:hello@canary.cards" className="text-primary underline decoration-primary hover-safe:no-underline">hello@canary.cards</a></strong>
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrivacyTermsContent() {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Privacy & Terms</h3>
        <p className="body-text text-sm text-secondary">Last updated: September 25, 2025</p>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Who Can Use Canary Cards</h4>
            <p className="body-text text-sm">
              You must be 18 or older. Use our service only for lawful purposes — don't use it to harass, spam, or break election laws.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">What We Collect</h4>
            <p className="body-text text-sm">
              We collect your email, mailing address, postcard content, payment info (securely processed), and basic usage data to send your postcards and improve our service.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">How We Use Your Data</h4>
            <p className="body-text text-sm">
              We use your information to send and deliver postcards, provide order confirmations and delivery updates, improve Canary Cards, understand what issues matter to communities, and send occasional marketing emails (you can opt out at any time).
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">What We Don't Do</h4>
            <p className="body-text text-sm">
              We do not sell or share your personal data (name, address, email). We do not share your individual postcard text beyond what's required to fulfill and deliver it.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Sharing With Trusted Partners</h4>
            <p className="body-text text-sm">
              We share only what's necessary with vendors who help us operate: IgnitePost to write and mail postcards, Supabase to securely store postcard text, Geocodio/Google Places to look up representatives and validate addresses, and Stripe/Resend for payments and transactional emails.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Your Choices & Rights</h4>
            <p className="body-text text-sm">
              You can opt out of marketing emails anytime by clicking "unsubscribe" in the email or contacting us. You can request a copy of the data we hold about you.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Your Privacy</h4>
            <p className="body-text text-sm">
              We don't sell your personal data (names, addresses, emails, or individual postcard content). We share only what's necessary with trusted partners like IgnitePost, Supabase, and Stripe to deliver your postcards. We may sell aggregated, anonymized data at the house district level to help organizations understand community engagement trends.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Security</h4>
            <p className="body-text text-sm">
              We use industry-standard security measures to protect your data. By using Canary Cards, you agree to these basic terms for sending postcards to elected officials.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">Contact</h4>
            <p className="body-text text-sm">
              Questions? Reach us at <strong>hello@canary.cards</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResearchContent() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="eyebrow-lowercase text-secondary">Why a handwritten postcard is the gold standard in 2025</h3>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">1. Personalized correspondence is the key to influence.</h4>
            <p className="body-text text-sm">
              Congressional offices consistently state that nothing has more sway on undecided votes than personalized communication from real constituents—not mass petitions, not form letters, not even most calls. In fact, 96% of Capitol Hill staff say that personalized letters specifically influence how their bosses vote, especially when the issue is undecided. The Congressional Management Foundation's research has found that messages which include personal stories, details about how an issue affects the sender, and some sign of genuine effort—like writing by hand—get more attention and are far more likely to be passed directly to the Member.
            </p>
            
            {/* Responsive Chart */}
            <div className="w-full mt-4 mb-2">
              <DynamicSvg
                assetName="chart_mobile_desaturated_key_1.svg"
                alt="Chart showing constituent importance rankings - mobile view"
                className="w-full h-auto md:hidden"
              />
              <ExpandableChart
                assetName="chart_desktop_desaturated_key_brandcolors.svg"
                alt="Chart showing constituent importance rankings - desktop view"
                className="hidden md:block"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              Data source: CMF 2011 Communicating with Congress: Perceptions of Citizen Advocacy on Capitol Hill
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">2. Generative AI has changed the email game.</h4>
            <p className="body-text text-sm">
              Mass AI-generated emails can now mimic personalization. According to CMF, many congressional offices are increasingly aware of this and are treating many digital messages—no matter how "personal"—like form emails, discounting their impact.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="eyebrow normal-case text-primary">3. Physical mail cuts through.</h4>
            <p className="body-text text-sm">
              We use AI to help write your message, but our postcards are AI-proof. Congressional offices use digital tools and AI to scan, categorize, and filter emails before any human reads them. Physical postcards must be handled, sorted, and read by a real person, guaranteeing your message breaks through the digital wall.
            </p>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-[#E8DECF]">
            <p className="body-text text-sm font-semibold text-primary text-center">
              Send a postcard. Be heard.
            </p>
          </div>
          
          <div className="pt-4 border-t border-[#E8DECF]/50">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Sources:</p>
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
        </div>
      </div>
    </div>
  );
}
