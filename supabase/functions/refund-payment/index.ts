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
    const { sessionId, reason, amount } = await req.json();
    
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    console.log(`[REFUND-PAYMENT] Processing refund for session: ${sessionId}, amount: ${amount || 'full'}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Retrieve the checkout session to get the payment intent
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session.payment_intent) {
      throw new Error("No payment intent found for this session");
    }

    console.log(`[REFUND-PAYMENT] Found payment intent: ${session.payment_intent}`);

    // Create refund parameters
    const refundParams: any = {
      payment_intent: session.payment_intent as string,
      reason: "requested_by_customer",
      metadata: {
        reason: reason || "Postcard creation failed",
        session_id: sessionId,
      },
    };

    // Add amount if specified (for partial refunds)
    if (amount && typeof amount === 'number' && amount > 0) {
      refundParams.amount = amount;
    }

    // Add idempotency key to prevent duplicate refunds
    const idempotencyKey = `refund-session-${sessionId}-${amount || 'full'}`;

    // Create the refund
    const refund = await stripe.refunds.create(refundParams, {
      idempotencyKey,
    });

    console.log(`[REFUND-PAYMENT] Refund created: ${refund.id}, Status: ${refund.status}, Amount: ${refund.amount}`);

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        status: refund.status,
        amount: refund.amount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[REFUND-PAYMENT] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});