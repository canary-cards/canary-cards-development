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
      
      // Parse address with robust fallback logic (same as send-postcard function)
      const parseAddress = (fullAddress: string, userInfo: any) => {
        if (!fullAddress) return {};
        
        // Try parsing format: "123 Main St, City, State ZIP"
        const parts = fullAddress.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const streetAddress = parts[0];
          const city = parts[1];
          const stateZipPart = parts[2];
          // Extract state and zip from "State ZIP" format
          const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
          if (stateZipMatch) {
            const state = stateZipMatch[1];
            const zip = stateZipMatch[2];
            return { 
              address_line1: streetAddress, 
              city, 
              state, 
              postal_code: zip,
              parsed_via: 'full_address'
            };
          } else {
            // Try to split by space and take last part as zip
            const lastSpaceIndex = stateZipPart.lastIndexOf(' ');
            if (lastSpaceIndex > 0) {
              const state = stateZipPart.substring(0, lastSpaceIndex);
              const zip = stateZipPart.substring(lastSpaceIndex + 1);
              return { 
                address_line1: streetAddress, 
                city, 
                state, 
                postal_code: zip,
                parsed_via: 'split_address'
              };
            }
          }
        }
        // Fallback - use the provided userInfo (this is the key fix!)
        return {
          address_line1: fullAddress,
          city: userInfo.city || '',
          state: userInfo.state || '',
          postal_code: userInfo.zipCode || '',
          parsed_via: 'fallback'
        };
      };

      const userInfo = metadata.postcard_userInfo ? JSON.parse(metadata.postcard_userInfo) : {};
      const parsedAddress = parseAddress(userInfo.streetAddress, userInfo);
      
      // Create complete address text for raw_address_text field
      const completeAddress = `${userInfo.streetAddress || ''}, ${userInfo.city || ''}, ${userInfo.state || ''} ${userInfo.zipCode || ''}`.trim();

      // Generate unique sharing link from full name
      const generateSharingLink = async (fullName: string): Promise<string> => {
        if (!fullName || fullName.trim() === '') {
          return '';
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1].charAt(0).toUpperCase() : '';
        
        if (!firstName || !lastInitial) {
          return '';
        }

        const baseLink = `${firstName}-${lastInitial}`;
        
        // Check if base link exists
        const { data: existingLinks } = await supabase
          .from('customers')
          .select('sharing_link')
          .like('sharing_link', `${baseLink}%`)
          .order('sharing_link', { ascending: true });

        if (!existingLinks || existingLinks.length === 0) {
          return baseLink;
        }

        // Check if exact match exists
        const exactMatch = existingLinks.find(link => link.sharing_link === baseLink);
        if (!exactMatch) {
          return baseLink;
        }

        // Find next available number
        let counter = 2;
        while (true) {
          const testLink = `${baseLink}-${counter}`;
          const exists = existingLinks.some(link => link.sharing_link === testLink);
          if (!exists) {
            return testLink;
          }
          counter++;
        }
      };

      const fullName = metadata.user_full_name || userInfo.fullName || '';
      const sharingLink = await generateSharingLink(fullName);

      // Upsert customer using normalized email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          email: session.customer_email || metadata.user_email,
          full_name: fullName,
          raw_address_text: completeAddress,
          sharing_link: sharingLink || null,
          ...parsedAddress
        }, {
          onConflict: 'email_normalized',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (customerError) {
        console.error("Error creating/updating customer:", customerError);
        throw new Error("Failed to create customer record");
      }

      // Check if order already exists for this session
      let { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('stripe_session_id', session.id)
        .single();

      let order = existingOrder;
      let isNewOrder = false;

      if (!existingOrder) {
        // Create new order record
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            postcard_draft_id: draftId || null, // Convert empty string to null for UUID field
            customer_id: customer.id,
            email_for_receipt: session.customer_email || metadata.user_email,
            send_option: metadata.send_option || metadata.postcard_sendOption,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            stripe_customer_id: session.customer,
            amount_paid: session.amount_total,
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
        
        order = newOrder;
        isNewOrder = true;
      } else {
        console.log("Order already exists for session:", session.id);
      }

      // Link postcard draft to order if draftId provided and it's a new order
      if (draftId && isNewOrder) {
        const { error: linkError } = await supabase
          .from('postcard_drafts')
          .update({ sent_order_id: order.id })
          .eq('id', draftId);

        if (linkError) {
          console.error("Error linking postcard draft to order:", linkError);
        }
      }

      console.log("Successfully processed payment - order", isNewOrder ? "created" : "found");
      
      // Extract postcard data for sending
      const postcardData = {
        userInfo: userInfo,
        representative: metadata.postcard_representative ? JSON.parse(metadata.postcard_representative) : null,
        senators: metadata.postcard_senators ? JSON.parse(metadata.postcard_senators) : [],
        finalMessage: metadata.postcard_finalMessage,
        sendOption: metadata.send_option || metadata.postcard_sendOption,
        email: session.customer_email || metadata.user_email
      };

      // Auto-trigger postcard sending only for new orders
      let postcardResults = null;
      let actualMailingDate = null;
      
      if (isNewOrder) {
        try {
          // Extract simulation parameters from metadata
          // Convert string boolean "true"/"false" to number 1/0
          const simulateFailure = metadata.simulateFailure === 'true' ? 1 : 0;
          const simulatedFailed = metadata.simulatedFailed ? parseInt(metadata.simulatedFailed) : 0;
          
          console.log('Parsing simulation parameters:', {
            raw_simulateFailure: metadata.simulateFailure,
            raw_simulatedFailed: metadata.simulatedFailed,
            parsed_simulateFailure: simulateFailure,
            parsed_simulatedFailed: simulatedFailed
          });
          
          const sendResponse = await supabase.functions.invoke('send-postcard', {
            body: { 
              postcardData,
              orderId: order.id,
              simulateFailure,
              simulatedFailed
            }
          });
          
          console.log("Postcard sending triggered:", sendResponse);
          if (sendResponse.data) {
            postcardResults = sendResponse.data;
            
            // Get actual mailing date from first successful postcard
            if (postcardResults.success && postcardResults.summary?.totalSent > 0) {
              const { data: postcardData, error: postcardError } = await supabase
                .from('postcards')
                .select('ignitepost_send_on')
                .eq('order_id', order.id)
                .not('ignitepost_send_on', 'is', null)
                .limit(1)
                .single();
              
              if (!postcardError && postcardData?.ignitepost_send_on) {
                actualMailingDate = postcardData.ignitepost_send_on;
                console.log("Using actual IgnitePost mailing date:", actualMailingDate);
              } else {
                console.log("No IgnitePost mailing date available, will use fallback");
              }
            }
          }
        } catch (sendError) {
          console.error("Failed to trigger postcard sending:", sendError);
          // Create error results for frontend handling
          postcardResults = {
            success: false,
            error: (sendError as any).message,
            summary: { totalSent: 0, totalFailed: 1, total: 1 },
            results: [{
              type: 'representative',
              recipient: postcardData.representative?.name || 'Unknown',
              status: 'error',
              error: (sendError as any).message
            }]
          };
        }
      } else {
        // For existing orders, create a success response without re-sending postcards
        postcardResults = {
          success: true,
          already_sent: true,
          summary: { message: "Postcards were already sent for this order" }
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
        postcardResults: postcardResults,
        actualMailingDate: actualMailingDate
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // For failed payments, still create an order record for tracking
      const metadata = session.metadata;
      
      try {
        // Parse address with robust fallback logic (same as send-postcard function)
        const parseAddress = (fullAddress: string, userInfo: any) => {
          if (!fullAddress) return {};
          
          // Try parsing format: "123 Main St, City, State ZIP"
          const parts = fullAddress.split(',').map(p => p.trim());
          if (parts.length >= 3) {
            const streetAddress = parts[0];
            const city = parts[1];
            const stateZipPart = parts[2];
            // Extract state and zip from "State ZIP" format
            const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
            if (stateZipMatch) {
              const state = stateZipMatch[1];
              const zip = stateZipMatch[2];
              return { 
                address_line1: streetAddress, 
                city, 
                state, 
                postal_code: zip,
                parsed_via: 'full_address'
              };
            } else {
              // Try to split by space and take last part as zip
              const lastSpaceIndex = stateZipPart.lastIndexOf(' ');
              if (lastSpaceIndex > 0) {
                const state = stateZipPart.substring(0, lastSpaceIndex);
                const zip = stateZipPart.substring(lastSpaceIndex + 1);
                return { 
                  address_line1: streetAddress, 
                  city, 
                  state, 
                  postal_code: zip,
                  parsed_via: 'split_address'
                };
              }
            }
          }
          // Fallback - use the provided userInfo (this is the key fix!)
          return {
            address_line1: fullAddress,
            city: userInfo.city || '',
            state: userInfo.state || '',
            postal_code: userInfo.zipCode || '',
            parsed_via: 'fallback'
          };
        };

        const userInfo = metadata.postcard_userInfo ? JSON.parse(metadata.postcard_userInfo) : {};
        const parsedAddress = parseAddress(userInfo.streetAddress, userInfo);
        
        // Create complete address text for raw_address_text field
        const completeAddress = `${userInfo.streetAddress || ''}, ${userInfo.city || ''}, ${userInfo.state || ''} ${userInfo.zipCode || ''}`.trim();

        // Upsert customer even for failed payments using normalized email
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .upsert({
            email: session.customer_email || metadata.user_email,
            full_name: metadata.user_full_name || userInfo.fullName || '',
            raw_address_text: completeAddress,
            ...parsedAddress
          }, {
            onConflict: 'email_normalized',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (!customerError) {
          // Create failed order record
          await supabase
            .from('orders')
            .insert({
              postcard_draft_id: metadata.postcard_draftId || null,
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
      error: (error as any).message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});