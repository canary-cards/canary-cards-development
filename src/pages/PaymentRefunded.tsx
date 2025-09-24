import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw, CheckCircle, ArrowLeft } from 'lucide-react';
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
  const successfulPostcards = results.filter((r: PostcardResult) => r.status === 'success');
  const failedPostcards = results.filter((r: PostcardResult) => r.status === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col animate-fade-in">
      <Header />
      <div className="flex-1 flex items-start justify-center p-4 pt-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-10">
            <div className="flex justify-center">
              <AlertCircle className="h-6 w-6 text-destructive/70" />
            </div>
            
            <div className="space-y-4">
              <h1 className="display-title text-primary">
                Postcard{displayFailedCount > 1 ? 's' : ''} hit a snag – but you're covered
              </h1>
              
              {orderId && (
                <p className="text-sm text-muted-foreground">
                  Order #{formatOrderNumber(orderId)}
                </p>
              )}
              
              <p className="body-text text-muted-foreground">
                We refunded your postcard{displayFailedCount > 1 ? 's' : ''}, no action needed on your part.
              </p>
              
               <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6 animate-fade-in">
                 <div className="flex items-center justify-center gap-2 mb-2">
                   <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    Refund issued: ${displayRefundAmount}
                  </p>
                </div>
                <p className="text-sm text-green-600">
                  You'll see it in 5–10 business days
                </p>
                {displayRefundId && (
                  <div className="mt-3 pt-3 border-t border-green-200">
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
              </div>
              
              {/* Show detailed postcard results when available */}
              {results.length > 0 && (
                <div className="space-y-3 mt-4">
                  {successfulPostcards.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="h-4 w-4 bg-green-500 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div className="text-sm text-green-800 text-left">
                          <p className="font-medium">Sent successfully:</p>
                           {successfulPostcards.map((result: PostcardResult, idx: number) => (
                             <p key={idx} className="mt-1">{String((result as any).recipient)}</p>
                           ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {failedPostcards.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-destructive text-left">
                          <p className="font-medium">Couldn't send:</p>
                           {failedPostcards.map((result: PostcardResult, idx: number) => (
                             <div key={idx} className="mt-1">
                               <p className="font-medium">{String((result as any).recipient)}</p>
                               {(result as any).error && <p className="text-xs opacity-75">{String((result as any).error)}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Fallback to legacy error display */}
              {results.length === 0 && displayErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-destructive text-left">
                      <p className="font-medium">Error Details:</p>
                      {displayErrors.map((err: string, idx: number) => (
                        <p key={idx} className="mt-1">{err}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Separator className="my-8" />

             <div className="space-y-4">
                <Button asChild className="w-full">
                  <Link to="/onboarding">
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Resend your postcard now
                  </Link>
                </Button>
               
               <Button variant="secondary" asChild className="w-full text-muted-foreground">
                 <Link to="/">
                   <ArrowLeft className="h-4 w-4 mr-1" />
                   Back to home
                 </Link>
               </Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}