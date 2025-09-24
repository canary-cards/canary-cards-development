import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { formatOrderNumber } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

// Helper function to calculate refund amount based on pricing structure
function calculateRefundAmount(failedCount: number, totalCount: number): number {
  // Pricing structure:
  // - $5 for a single postcard
  // - $12 for 3 postcards (3-pack)
  // - $5 each for mix and match
  
  if (totalCount === 1) {
    // Single postcard
    return 5.00;
  } else if (totalCount === 3) {
    // 3-pack pricing ($12 total = $4 per postcard)
    return (failedCount * 12) / 3;
  } else {
    // Mix and match pricing ($5 each)
    return failedCount * 5.00;
  }
}

export default function PaymentRefunded() {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  
  // Get data from state or URL params (for testing)
  const { 
    failedCount = 1, 
    totalCount = 1, 
    refundAmountCents, 
    refundId,
    orderId,
    results = [],
    errors = [] 
  } = location.state || {};
  
  // URL params for testing (override state if present)
  const urlFailedCount = urlParams.get('failedCount');
  const urlTotalCount = urlParams.get('totalCount');
  const urlRefundAmount = urlParams.get('refundAmountCents');
  const urlRefundId = urlParams.get('refundId');
  const urlError = urlParams.get('error');
  
  // URL params for testing postcard results
  const urlResults = urlParams.get('results');
  let parsedResults = results;
  
  // Parse URL results for testing
  if (urlResults) {
    try {
      parsedResults = JSON.parse(decodeURIComponent(urlResults));
    } catch (e) {
      console.warn('Invalid results parameter:', e);
      parsedResults = results;
    }
  }
  
  const displayFailedCount = urlFailedCount ? parseInt(urlFailedCount) : failedCount;
  const displayTotalCount = urlTotalCount ? parseInt(urlTotalCount) : totalCount;
  
  // Calculate refund amount based on pricing structure
  const calculatedRefundAmount = calculateRefundAmount(displayFailedCount, displayTotalCount);
  const displayRefundAmount = urlRefundAmount ? (parseInt(urlRefundAmount) / 100).toFixed(2) : 
    calculatedRefundAmount.toFixed(2);
  const displayRefundId = urlRefundId || refundId;
  const displayErrors = urlError ? [urlError] : (errors.length > 0 ? errors : []);
  
  // Process results for detailed display
  interface PostcardResult {
    status: 'success' | 'error';
    [key: string]: unknown;
  }
  const successfulPostcards = parsedResults.filter((r: PostcardResult) => r.status === 'success');
  const failedPostcards = parsedResults.filter((r: PostcardResult) => r.status === 'error');
  

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Title and Subtitle */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Postcard refunded
          </h1>
          {orderId && (
            <p className="text-sm text-muted-foreground mb-4">
              Order #{formatOrderNumber(orderId)}
            </p>
          )}
          <p className="subtitle">
            We've got it covered. No action needed, we'll let you know when it's fixed.
          </p>
        </div>

        {/* Refund Card */}
        <Card className="bg-green-50 border-green-200 mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Refund issued: ${displayRefundAmount}
              </p>
            </div>
            <p className="text-sm text-green-600 text-center">
              Expected in 5–10 business days
            </p>
            {displayRefundId && (
              <div className="mt-3 pt-3 border-t border-green-200 text-center">
                <p className="text-xs text-green-700">
                  <span className="font-medium">Refund ID:</span> {displayRefundId}
                </p>
                {orderId && (
                  <p className="text-xs text-green-700 mt-1">
                    <span className="font-medium">Order:</span> #{formatOrderNumber(orderId)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Card */}
        {successfulPostcards.length > 0 && (
          <Card className="card-warm mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {successfulPostcards.length} postcard{successfulPostcards.length > 1 ? 's' : ''} sent successfully
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {successfulPostcards.map((result: PostcardResult, idx: number) => 
                      String((result as any).recipient)
                    ).join(' & ')} will receive your message
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failure Card */}
        {(failedPostcards.length > 0 || (parsedResults.length === 0 && displayFailedCount > 0)) && (
          <Card className="card-warm mb-8">
            <CardContent className="p-6">
              <div className="space-y-3">
                {failedPostcards.length > 0 ? (
                  failedPostcards.map((result: PostcardResult, idx: number) => (
                    <div key={idx} className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {String((result as any).recipient)} postcard failed
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Mailing issue on our end — we're already fixing it
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {displayFailedCount} postcard{displayFailedCount > 1 ? 's' : ''} failed to send
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Mailing issue on our end — we're already fixing it
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fallback Error Display */}
        {parsedResults.length === 0 && displayErrors.length > 0 && (
          <Card className="card-warm mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Error Details</h3>
                  {displayErrors.map((err: string, idx: number) => (
                    <p key={idx} className="text-sm text-muted-foreground">{err}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Return Home Button */}
        <Button variant="primary" asChild className="w-full">
          <Link to="/">
            Return home
          </Link>
        </Button>
      </div>
    </div>
  );
}