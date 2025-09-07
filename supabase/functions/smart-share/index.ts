import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("=== SMART-SHARE FUNCTION CALLED ===");
  console.log("Request URL:", req.url);
  console.log("Request method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ref = url.searchParams.get('ref') || 'direct';
    const orderNumber = url.searchParams.get('order') || '';
    
    console.log("Parsed params - ref:", ref, "orderNumber:", orderNumber);
    
    // Get user agent to detect mobile vs desktop
    const userAgent = req.headers.get('user-agent') || '';
    console.log("User agent:", userAgent);

    // Get app URL for sharing
    const getAppUrl = () => {
      const frontendUrl = Deno.env.get('FRONTEND_URL');
      console.log("FRONTEND_URL env var:", frontendUrl);
      if (frontendUrl) return frontendUrl;
      return 'https://canary.cards';
    };

    const appUrl = getAppUrl();
    console.log("App URL:", appUrl);
    
    // Redirect to the React app's share route
    const shareUrl = `${appUrl}/share?ref=${encodeURIComponent(ref)}&order=${encodeURIComponent(orderNumber)}`;
    
    console.log('REDIRECTING TO:', shareUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": shareUrl,
      },
    });

  } catch (error: any) {
    console.error("=== ERROR IN SMART-SHARE FUNCTION ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Return a simple fallback redirect
    const fallbackUrl = 'https://canary.cards/share?ref=error';
    console.log("Redirecting to fallback URL:", fallbackUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        "Location": fallbackUrl,
      },
    });
  }
};

serve(handler);