import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    // Initialize Stripe and Supabase
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

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
    
    if (isPaymentSuccessful) {
      const metadata = session.metadata;
      const draftId = metadata.postcard_draftId;
      
      console.log("Draft ID from metadata:", draftId);
      
      // Parse address with fallback
      const parseAddress = (rawText) => {
        if (!rawText) return {};
        
        // Simple regex parsing as fallback
        const match = rawText.match(/^([^,]+)(?:,\s*([^,]+))?(?:,\s*([A-Z]{2}))?\s*(\d{5}(?:-\d{4})?)?$/);
        if (match) {
          return {
            address_line1: match[1]?.trim() || rawText,
            city: match[2]?.trim(),
            state: match[3]?.trim(),
            postal_code: match[4]?.trim(),
            parsed_via: 'regex'
          };
        }
        return { address_line1: rawText, parsed_via: 'fallback' };
      };

      const userInfo = metadata.postcard_userInfo ? JSON.parse(metadata.postcard_userInfo) : {};
      const parsedAddress = parseAddress(userInfo.streetAddress);

      // Upsert customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          email: session.customer_email || metadata.user_email,
          full_name: metadata.user_full_name || userInfo.fullName || '',
          raw_address_text: userInfo.streetAddress || '',
          ...parsedAddress
        }, {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (customerError) {
        console.error("Error creating/updating customer:", customerError);
        throw new Error("Failed to create customer record");
      }

      // Create order record
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          ai_draft_id: draftId || null, // Convert empty string to null for UUID field
          customer_id: customer.id,
          email_for_receipt: session.customer_email || metadata.user_email,
          send_option: metadata.send_option || metadata.postcard_sendOption,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          stripe_customer_id: session.customer,
          amount_paid: session.amount_total, // Using new column name
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          metadata_snapshot: metadata
        })
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        throw new Error("Failed to create order record");
      }

      // Link AI draft to order if draftId provided
      if (draftId) {
        const { error: linkError } = await supabase
          .from('ai_drafts')
          .update({ sent_order_id: order.id })
          .eq('id', draftId);

        if (linkError) {
          console.error("Error linking AI draft to order:", linkError);
        }
      }

      console.log("Successfully processed payment and created records");
      
      // Extract postcard data for sending
      const postcardData = {
        userInfo: userInfo,
        representative: metadata.postcard_representative ? JSON.parse(metadata.postcard_representative) : null,
        senators: metadata.postcard_senators ? JSON.parse(metadata.postcard_senators) : [],
        finalMessage: metadata.postcard_finalMessage,
        sendOption: metadata.send_option || metadata.postcard_sendOption,
        email: session.customer_email || metadata.user_email
      };

      // Auto-trigger postcard sending
      let postcardResults = null;
      try {
        const sendResponse = await supabase.functions.invoke('send-postcard', {
          body: { 
            postcardData,
            orderId: order.id
          }
        });
        
        console.log("Postcard sending triggered:", sendResponse);
        if (sendResponse.data) {
          postcardResults = sendResponse.data;
        }
      } catch (sendError) {
        console.error("Failed to trigger postcard sending:", sendError);
        // Create error results for frontend handling
        postcardResults = {
          success: false,
          error: sendError.message,
          summary: { totalSent: 0, totalFailed: 1, total: 1 },
          results: [{
            type: 'representative',
            recipient: postcardData.representative?.name || 'Unknown',
            status: 'error',
            error: sendError.message
          }]
        };
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        amountTotal: session.amount_total,
        customerEmail: session.customer_email,
        orderId: order.id,
        postcardData: postcardData,
        postcardResults: postcardResults
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // For failed payments, still create an order record for tracking
      const metadata = session.metadata;
      
      try {
        // Parse address with fallback
        const parseAddress = (rawText) => {
          if (!rawText) return {};
          
          // Simple regex parsing as fallback
          const match = rawText.match(/^([^,]+)(?:,\s*([^,]+))?(?:,\s*([A-Z]{2}))?\s*(\d{5}(?:-\d{4})?)?$/);
          if (match) {
            return {
              address_line1: match[1]?.trim() || rawText,
              city: match[2]?.trim(),
              state: match[3]?.trim(),
              postal_code: match[4]?.trim(),
              parsed_via: 'regex'
            };
          }
          return { address_line1: rawText, parsed_via: 'fallback' };
        };

        const userInfo = metadata.postcard_userInfo ? JSON.parse(metadata.postcard_userInfo) : {};
        const parsedAddress = parseAddress(userInfo.streetAddress);

        // Upsert customer even for failed payments
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .upsert({
            email: session.customer_email || metadata.user_email,
            full_name: metadata.user_full_name || userInfo.fullName || '',
            raw_address_text: userInfo.streetAddress || '',
            ...parsedAddress
          }, {
            onConflict: 'email',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (!customerError) {
          // Create failed order record
          await supabase
            .from('orders')
            .insert({
              ai_draft_id: metadata.postcard_draftId || null,
              customer_id: customer.id,
              email_for_receipt: session.customer_email || metadata.user_email,
              send_option: metadata.send_option || metadata.postcard_sendOption || 'single',
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              stripe_customer_id: session.customer,
              amount_paid: 0, // No amount paid for failed payment
              payment_status: 'failed',
              metadata_snapshot: metadata
            });

          console.log('Failed payment order recorded');
        }
      } catch (error) {
        console.error('Error recording failed payment:', error);
      }

      return new Response(JSON.stringify({ 
        success: false,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        amountTotal: session.amount_total,
        customerEmail: session.customer_email,
        metadata: session.metadata
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
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