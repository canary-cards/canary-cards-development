import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { RefreshCcw, ArrowLeft, AlertCircle } from 'lucide-react';

export default function PaymentRefunded() {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  
  // Get data from state or URL params (for testing)
  const { 
    failedCount = 1, 
    totalCount = 1, 
    refundAmountCents, 
    refundId, 
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
  const displayRefundAmount = urlRefundAmount ? (parseInt(urlRefundAmount) / 100).toFixed(2) : 
    (refundAmountCents ? (refundAmountCents / 100).toFixed(2) : null);
  const displayRefundId = urlRefundId || refundId;
  const displayErrors = urlError ? [urlError] : (errors.length > 0 ? errors : []);
  
  // Process results for detailed display
  const successfulPostcards = results.filter((r: any) => r.status === 'success');
  const failedPostcards = results.filter((r: any) => r.status === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <RefreshCcw className="h-16 w-16 text-yellow-500" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl display-title">
                Hmm, something went wrong
              </h1>
              
              {displayFailedCount === displayTotalCount ? (
                <p className="body-text text-muted-foreground">
                  We weren't able to order your postcard{displayTotalCount > 1 ? 's' : ''}, and your payment has been refunded.
                </p>
              ) : (
                <p className="body-text text-muted-foreground">
                  {displayFailedCount} of {displayTotalCount} postcard{displayTotalCount > 1 ? 's' : ''} failed to order. 
                  We've issued a partial refund for the failed postcard{displayFailedCount > 1 ? 's' : ''}.
                </p>
              )}
              
              {displayRefundAmount && (
                <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 mt-4">
                  <p className="text-sm font-medium">
                    Refund: ${displayRefundAmount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You'll see this refund in your account within 5–10 business days.
                  </p>
                </div>
              )}
              
              {/* Show detailed postcard results when available */}
              {results.length > 0 && (
                <div className="space-y-3 mt-4">
                  {successfulPostcards.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="h-4 w-4 bg-green-500 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div className="text-sm text-green-800 text-left">
                          <p className="font-medium">Sent successfully:</p>
                          {successfulPostcards.map((result: any, idx: number) => (
                            <p key={idx} className="mt-1">{result.recipient}</p>
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
                          {failedPostcards.map((result: any, idx: number) => (
                            <div key={idx} className="mt-1">
                              <p className="font-medium">{result.recipient}</p>
                              {result.error && <p className="text-xs opacity-75">{result.error}</p>}
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
              
              {displayRefundId && (
                <p className="text-sm text-muted-foreground">
                  Refund ID: {displayRefundId}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link to="/onboarding">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}