import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    console.log("=== ENV DIAGNOSTICS ===");
    
    // Check critical environment variables
    const diagnostics = {
      timestamp: new Date().toISOString(),
      secrets: {
        // Stripe
        STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY") ? "✓ Present" : "✗ Missing",
        "stripe secret key": Deno.env.get("stripe secret key") ? "✓ Present (alt name)" : "✗ Missing (alt name)",
        
        // Google/Places
        Google: Deno.env.get("Google") ? "✓ Present" : "✗ Missing",
        GOOGLE_PLACES_API_KEY: Deno.env.get("GOOGLE_PLACES_API_KEY") ? "✓ Present (alt name)" : "✗ Missing (alt name)",
        
        // Geocodio
        GeoCodioKey: Deno.env.get("GeoCodioKey") ? "✓ Present" : "✗ Missing",
        GEOCODIO_API_KEY: Deno.env.get("GEOCODIO_API_KEY") ? "✓ Present (alt name)" : "✗ Missing (alt name)",
        
        // Anthropic
        ANTHROPIC_API_KEY_1: Deno.env.get("ANTHROPIC_API_KEY_1") ? "✓ Present" : "✗ Missing",
        ANTHROPIC_API_KEY_2: Deno.env.get("ANTHROPIC_API_KEY_2") ? "✓ Present" : "✗ Missing", 
        ANTHROPIC_API_KEY_3: Deno.env.get("ANTHROPIC_API_KEY_3") ? "✓ Present" : "✗ Missing",
        ANTHROPIC_API_KEY_4: Deno.env.get("ANTHROPIC_API_KEY_4") ? "✓ Present" : "✗ Missing",
        ANTHROPIC_API_KEY_5: Deno.env.get("ANTHROPIC_API_KEY_5") ? "✓ Present" : "✗ Missing",
        anthropickey: Deno.env.get("anthropickey") ? "✓ Present (alt name)" : "✗ Missing (alt name)",
        
        // News APIs
        CONGRESS_API_KEY: Deno.env.get("CONGRESS_API_KEY") ? "✓ Present" : "✗ Missing",
        GUARDIAN_API_KEY: Deno.env.get("GUARDIAN_API_KEY") ? "✓ Present" : "✗ Missing", 
        NYT_API_KEY: Deno.env.get("NYT_API_KEY") ? "✓ Present" : "✗ Missing",
        
        // Other
        RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ? "✓ Present" : "✗ Missing",
        IGNITE_POST: Deno.env.get("IGNITE_POST") ? "✓ Present" : "✗ Missing",
        
        // Supabase
        SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "✓ Present" : "✗ Missing",
        SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ? "✓ Present" : "✗ Missing",
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "✓ Present" : "✗ Missing",
      }
    };

    // Log full diagnostics
    console.log("Environment diagnostics:", JSON.stringify(diagnostics, null, 2));
    
    // Test actual API calls
    const apiTests = {
      stripe: false,
      google: false,
      anthropic: false
    };

    // Test Stripe
    try {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("stripe secret key");
      if (stripeKey) {
        const testResponse = await fetch("https://api.stripe.com/v1/customers?limit=1", {
          headers: { "Authorization": `Bearer ${stripeKey}` }
        });
        apiTests.stripe = testResponse.ok;
        console.log(`Stripe API test: ${testResponse.ok ? "✓ Success" : "✗ Failed"} (${testResponse.status})`);
      }
    } catch (e) {
      console.log(`Stripe API test failed: ${e.message}`);
    }

    // Test Google Places
    try {
      const googleKey = Deno.env.get("Google") || Deno.env.get("GOOGLE_PLACES_API_KEY");
      if (googleKey) {
        const testResponse = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleKey
          },
          body: JSON.stringify({
            input: "test",
            includedRegionCodes: ["US"]
          })
        });
        apiTests.google = testResponse.ok;
        console.log(`Google Places API test: ${testResponse.ok ? "✓ Success" : "✗ Failed"} (${testResponse.status})`);
      }
    } catch (e) {
      console.log(`Google Places API test failed: ${e.message}`);
    }

    // Test Anthropic
    try {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY_1") || Deno.env.get("anthropickey");
      if (anthropicKey) {
        const testResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "test" }]
          })
        });
        apiTests.anthropic = testResponse.ok;
        console.log(`Anthropic API test: ${testResponse.ok ? "✓ Success" : "✗ Failed"} (${testResponse.status})`);
      }
    } catch (e) {
      console.log(`Anthropic API test failed: ${e.message}`);
    }

    const result = {
      ...diagnostics,
      apiTests,
      summary: {
        criticalSecrets: [
          diagnostics.secrets.STRIPE_SECRET_KEY,
          diagnostics.secrets.Google,
          diagnostics.secrets.ANTHROPIC_API_KEY_1
        ].filter(s => s.includes("✓")).length + "/3 critical secrets present",
        workingApis: Object.values(apiTests).filter(Boolean).length + "/3 APIs working"
      }
    };

    console.log("=== END DIAGNOSTICS ===");

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Diagnostics error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
