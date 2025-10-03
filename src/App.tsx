import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { FinalizingOrderScreen } from "./components/FinalizingOrderScreen";
import { PostHogErrorBoundary } from "posthog-js/react";
import { Header } from "./components/Header";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import ContactUs from "./pages/ContactUs";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentReturn from "./pages/PaymentReturn";
import PaymentRefunded from "./pages/PaymentRefunded";
import Share from "./pages/Share";
import { useEffect, useState } from "react";

import { AppProvider, useAppContext } from "./context/AppContext";

const queryClient = new QueryClient();

// Component to detect payment returns and show immediate loading
const PaymentLoadingDetector = () => {
  const location = useLocation();
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    // Detect payment return with session_id parameter
    if (location.pathname === '/payment-return' && location.search.includes('session_id=')) {
      dispatch({ type: 'SET_PAYMENT_LOADING', payload: true });
    } else {
      // Clear payment loading when navigating away from payment-return
      if (state.isPaymentLoading && location.pathname !== '/payment-return') {
        dispatch({ type: 'SET_PAYMENT_LOADING', payload: false });
      }
    }
  }, [location, dispatch, state.isPaymentLoading]);

  if (state.isPaymentLoading) {
    return <FinalizingOrderScreen status="loading" />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/about" element={<About />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/share" element={<Share />} />
      <Route path="/share/:orderId" element={<Share />} />
      
      <Route path="/payment-return" element={<PaymentReturn />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-refunded" element={<PaymentRefunded />} />
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppContent = () => (
  <AppProvider>
    <PaymentLoadingDetector />
  </AppProvider>
);

const ErrorFallback = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Header />
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-4xl display-title mb-4">Oops!</h1>
        <p className="text-xl body-text text-muted-foreground mb-4">
          Something went wrong. Please refresh the page to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
        >
          Refresh Page
        </button>
      </div>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="civic-postcard-theme">
      <TooltipProvider>
        <PostHogErrorBoundary fallback={<ErrorFallback />}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </PostHogErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
