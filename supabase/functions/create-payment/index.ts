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
    // Parse request body
    const { sendOption, email, fullName, postcardData, simulateFailure, simulatedFailed } = await req.json();
    
    console.log("=== CREATE PAYMENT DEBUG ===");
    console.log("Request data:", { sendOption, email, fullName });
    console.log("Postcard data received:", postcardData ? "Yes" : "No");
    
    if (!sendOption || !email) {
      throw new Error("Missing required fields: sendOption and email");
    }

    // Prepare postcard data for metadata storage
    let postcardMetadata = {};
    if (postcardData) {
      try {
        // Store essential postcard data in metadata (Stripe has size limits)
        postcardMetadata = {
          postcard_userInfo: JSON.stringify(postcardData.userInfo || {}),
          postcard_representative: JSON.stringify(postcardData.representative || {}),
          postcard_senators: JSON.stringify(postcardData.senators || []),
          postcard_finalMessage: postcardData.finalMessage || "",
          postcard_sendOption: postcardData.sendOption || sendOption,
          postcard_email: postcardData.email || email
        };
        console.log("Prepared postcard metadata for session");
      } catch (error) {
        console.error("Error preparing postcard metadata:", error);
        postcardMetadata = {}; // Fallback to empty metadata
      }
    }

    // Parse full name into first and last name for Stripe
    let firstName = "";
    let lastName = "";
    if (fullName) {
      const nameParts = fullName.trim().split(" ");
      firstName = nameParts[0] || "";
      lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Set pricing based on send option
    const pricing = {
      single: { amount: 500, name: "Single Postcard" },
      double: { amount: 1000, name: "Double Postcard Package" },
      triple: { amount: 1200, name: "Triple Postcard Package" } // $12 with bundle savings
    };

    const selectedPricing = pricing[sendOption as keyof typeof pricing];
    if (!selectedPricing) {
      throw new Error("Invalid send option");
    }

    // Create or update Stripe customer with name information
    let customerId;
    const customers = await stripe.customers.list({ email, limit: 1 });
    console.log("Existing customers found:", customers.data.length);
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("Found existing customer:", { 
        id: customerId, 
        name: customers.data[0].name, 
        email: customers.data[0].email 
      });
      
      // Update existing customer with name and billing details if provided
      if (fullName && (!customers.data[0].name || customers.data[0].name !== fullName)) {
        console.log("Updating customer with new name:", fullName);
        await stripe.customers.update(customerId, { 
          name: fullName,
          metadata: { full_name: fullName }
        });
        console.log("Customer updated successfully");
      }
    } else {
      // Always create new customer, with or without name
      console.log("Creating new customer with:", { email, name: fullName });
      const customer = await stripe.customers.create({
        email,
        name: fullName || undefined, // Let Stripe handle empty names gracefully
        metadata: { full_name: fullName || "" }
      });
      customerId = customer.id;
      console.log("New customer created:", { 
        id: customerId, 
        name: customer.name, 
        email: customer.email 
      });
    }

    // Verify final customer state before creating session
    const finalCustomer = await stripe.customers.retrieve(customerId);
    console.log("Final customer before session:", { 
      id: finalCustomer.id, 
      name: finalCustomer.name, 
      email: finalCustomer.email,
      metadata: finalCustomer.metadata 
    });

    // Get the origin for the return URL
    const origin = req.headers.get("origin");
    let returnUrl = `${origin}/payment-return?session_id={CHECKOUT_SESSION_ID}`;
    
    // Add simulation flags to return URL if provided
    if (simulateFailure) {
      returnUrl += `&simulate_failure=1`;
      if (simulatedFailed) {
        returnUrl += `&simulate_failed=${simulatedFailed}`;
      }
    }
    
    console.log("Setting up Stripe session with return URL:", returnUrl);
    console.log("Origin header:", origin);

    // Create embedded checkout session with forced customer creation
    const session = await stripe.checkout.sessions.create({
      customer_creation: 'always',
      customer_email: email,
      billing_address_collection: 'auto',
      payment_method_types: ['card', 'link'],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: selectedPricing.name,
              description: `Civic postcard delivery to your representative`
            },
            unit_amount: selectedPricing.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      return_url: returnUrl,
      metadata: {
        send_option: sendOption,
        user_email: email,
        user_full_name: fullName || "",
        recipient_count: postcardData?.senators ? (sendOption === 'triple' ? postcardData.senators.length + 1 : 
                                                    sendOption === 'double' ? Math.min(postcardData.senators.length + 1, 2) : 1) : 1,
        recipient_list: postcardData ? JSON.stringify([
          postcardData.representative?.name,
          ...(postcardData.senators || []).slice(0, sendOption === 'triple' ? 2 : sendOption === 'double' ? 1 : 0).map(s => s.name)
        ].filter(Boolean)) : "[]",
        ...postcardMetadata // Include all postcard data in session metadata
      }
    });

    console.log("Session created with customer:", customerId);
    console.log("Session ID:", session.id);
    console.log("=== END CREATE PAYMENT DEBUG ===");

    console.log("Created Stripe embedded session:", session.id, "for", email, "option:", sendOption);

    return new Response(JSON.stringify({ 
      client_secret: session.client_secret,
      session_id: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});