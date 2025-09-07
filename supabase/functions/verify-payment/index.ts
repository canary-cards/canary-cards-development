import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    console.log("=== VERIFY PAYMENT DEBUG ===");
    console.log("Session ID to verify:", sessionId);
    
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Retrieve the checkout session to verify payment status
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log("Session details:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      customer_email: session.customer_email,
      metadata: session.metadata
    });

    // Check if payment was successful
    const isPaymentSuccessful = session.payment_status === 'paid' && session.status === 'complete';
    
    // Extract postcard data from session metadata
    let postcardData = null;
    if (isPaymentSuccessful && session.metadata) {
      try {
        const metadata = session.metadata;
        if (metadata.postcard_userInfo && metadata.postcard_representative && metadata.postcard_finalMessage) {
          postcardData = {
            userInfo: JSON.parse(metadata.postcard_userInfo),
            representative: JSON.parse(metadata.postcard_representative),
            senators: metadata.postcard_senators ? JSON.parse(metadata.postcard_senators) : [],
            finalMessage: metadata.postcard_finalMessage,
            sendOption: metadata.postcard_sendOption || metadata.send_option,
            email: metadata.postcard_email || metadata.user_email
          };
          console.log("Successfully extracted postcard data from session metadata");
        }
      } catch (error) {
        console.error("Error parsing postcard data from metadata:", error);
      }
    }
    
    console.log("Payment verification result:", {
      sessionId,
      isPaymentSuccessful,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      hasPostcardData: !!postcardData
    });

    console.log("=== END VERIFY PAYMENT DEBUG ===");

    return new Response(JSON.stringify({ 
      success: isPaymentSuccessful,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      amountTotal: session.amount_total,
      customerEmail: session.customer_email,
      metadata: session.metadata,
      postcardData: postcardData // Include extracted postcard data
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});