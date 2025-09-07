import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderConfirmationRequest {
  userInfo: {
    fullName: string;
    email: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  representative: {
    name: string;
    state: string;
    party: string;
    type: string;
  };
  senators?: Array<{
    name: string;
    state: string;
    party: string;
  }>;
  sendOption: 'single' | 'double' | 'triple';
  orderResults: Array<{
    type: string;
    recipient: string;
    orderId: string;
    status: string;
  }>;
  finalMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userInfo, representative, senators, sendOption, orderResults, finalMessage }: OrderConfirmationRequest = await req.json();

    console.log('Sending order confirmation email to:', userInfo.email);

    if (!userInfo.email) {
      console.log('No email provided, skipping email confirmation');
      return new Response(JSON.stringify({ message: 'No email provided' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get app URL for sharing - use canary.cards as primary domain
    const getAppUrl = () => {
      return 'https://canary.cards';
    };

    // Initialize Supabase client to fetch logo
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Try to get logo from direct URL first, then fallback to storage
    let logoUrl = '';
    
    // First priority: Direct EMAIL_LOGO_URL from environment
    const emailLogoUrl = Deno.env.get('EMAIL_LOGO_URL');
    if (emailLogoUrl) {
      try {
        // Validate the URL by making a HEAD request
        const response = await fetch(emailLogoUrl, { method: 'HEAD' });
        if (response.ok) {
          logoUrl = emailLogoUrl;
          console.log('Using direct EMAIL_LOGO_URL:', logoUrl);
        } else {
          console.log('EMAIL_LOGO_URL validation failed:', response.status);
        }
      } catch (error) {
        console.log('EMAIL_LOGO_URL validation error:', error);
      }
    }
    
    // Fallback: Try to get logo from Supabase Storage
    if (!logoUrl) {
      try {
        console.log('Attempting to fetch files from Email logo bucket...');
        const { data: files, error } = await supabase.storage
          .from('Email logo bucket')
          .list('', {
            limit: 100,
            offset: 0
          });

        console.log('Storage response:', { files, error });

        if (!error && files && files.length > 0) {
          console.log('Found files:', files.map(f => f.name));
          
          // Look for PNG files containing 'logo' or 'canary', or use the first PNG
          const logoFile = files.find(file => 
            file.name.toLowerCase().endsWith('.png') && 
            (file.name.toLowerCase().includes('logo') || file.name.toLowerCase().includes('canary'))
          ) || files.find(file => file.name.toLowerCase().endsWith('.png'));

          if (logoFile) {
            const { data: { publicUrl } } = supabase.storage
              .from('Email logo bucket')
              .getPublicUrl(logoFile.name);
            logoUrl = publicUrl;
            console.log('Using logo from storage:', logoUrl);
          } else {
            console.log('No PNG files found in bucket');
          }
        } else {
          console.log('Storage error or no files:', error);
        }
      } catch (storageError) {
        console.log('Failed to fetch logo from storage:', storageError);
      }
    }

    // Fallback to SVG if storage fetch fails
    if (!logoUrl) {
      logoUrl = 'https://www.canary.cards/postallogov1.svg';
      console.log('Using fallback SVG logo');
    }

    const successfulOrders = orderResults.filter(order => order.status === 'success');
    
    // Calculate current date and expected dates for email
    const orderPlacedDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const expectedMailingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Generate order number from successful orders
    const orderNumber = successfulOrders.map(order => order.orderId).join('-');
    
    // Calculate total amount based on number of successful postcards
    const unitPrice = 5.00;
    const successCount = successfulOrders.length;
    let totalAmount;
    if (successCount === 1) {
      totalAmount = '$5.00';
    } else if (successCount === 2) {
      totalAmount = '$10.00';
    } else if (successCount >= 3) {
      totalAmount = '$12.00';
    } else {
      totalAmount = '$5.00'; // fallback
    }
    
    const cardCount = successfulOrders.length;
    
    // Dynamic recipient rendering with proper title formatting
    const formatRepresentativeName = (rep: any, fullName: string) => {
      const nameParts = fullName.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      return rep.type === 'representative' ? `Rep. ${lastName}` : `Sen. ${lastName}`;
    };
    
    let recipientList;
    if (successfulOrders.length === 1) {
      const orderRep = successfulOrders[0].type === 'representative' ? representative : senators?.find(s => s.name === successfulOrders[0].recipient);
      const formattedName = orderRep ? formatRepresentativeName(orderRep, successfulOrders[0].recipient) : successfulOrders[0].recipient;
      recipientList = `<span style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222222; font-size: 1rem; line-height: 1.6;">${formattedName}</span>`;
    } else {
      recipientList = `<ul class="unordered-list" style="padding-left: 1.5rem; margin: 0; list-style-type: disc;">
        ${successfulOrders.map(order => {
          const orderRep = order.type === 'representative' ? representative : senators?.find(s => s.name === order.recipient);
          const formattedName = orderRep ? formatRepresentativeName(orderRep, order.recipient) : order.recipient;
          return `<li style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222222; font-size: 1rem; line-height: 1.6; margin-bottom: 0.5rem;">${formattedName}</li>`;
        }).join('')}
      </ul>`;
    }
    
    // Build postcard messages section
    let postcardMessagesSection = '';
    if (finalMessage) {
      // Build individual postcard messages
      const allRepresentatives = [representative, ...(senators || [])];
      const representativesToShow = allRepresentatives.slice(0, successfulOrders.length);
      
      postcardMessagesSection = representativesToShow.map((rep, index) => {
        const nameParts = rep.name.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        const shortTitle = rep.type === 'representative' ? 'Rep.' : 'Sen.';
        
        return `
        <div style="background-color: #ffffff; padding: 1.5rem; border-radius: 12px; border: 1px solid #E8DECF; margin-bottom: 1rem;">
          <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222222; font-size: 15px; line-height: 1.6; margin: 0;">
            Dear ${shortTitle} ${lastName},<br><br>
            ${finalMessage}
          </p>
        </div>
        `;
      }).join('');
    }
    
    const emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Order confirmed — Your message is in motion</title>
  
  <!-- Web Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  
  <style>
    /* Reset & Normalize */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
    }
    
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      max-width: 100%;
    }
    
    table {
      border-collapse: collapse !important;
    }
    
    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #FEF4E9;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Brand Colors from Design System */
    :root {
      /* Surfaces */
      --background: 31 91% 95%; /* Cream #FEF4E9 */
      --foreground: 0 0% 13%;  /* Neutral text #222222 */
      --card: 0 0% 100%;       /* White */
      --card-foreground: 0 0% 13%;

      /* Brand */
      --primary: 212 29% 26%;            /* Ink Blue #2F4156 */
      --primary-foreground: 0 0% 100%;    /* White */
      --secondary: 7 45% 42%;             /* Brick Red #B25549 */
      --secondary-foreground: 7 45% 42%;  /* Red text */
      --accent: 46 100% 65%;              /* Canary Yellow #FFD44D */
      --accent-foreground: 212 29% 26%;   /* Ink Blue text/border */

      /* Support */
      --muted: 36 35% 86%;                /* Divider #E8DECF */
      --muted-foreground: 209 10% 48%;    /* Muted blue text */
      --border: 36 35% 86%;               /* #E8DECF */
    }
    
    /* Typography from Design System */
    .font-spectral { 
      font-family: 'Spectral', Georgia, 'Times New Roman', serif !important; 
    }
    .font-inter { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; 
    }
    
    /* Email-specific color implementations */
    .bg-cream { background-color: #FEF4E9 !important; }
    .bg-white { background-color: #ffffff !important; }
    .bg-ink-blue { background-color: #2F4156 !important; }
    .bg-brick-red { background-color: #B25549 !important; }
    .bg-canary-yellow { background-color: #FFD44D !important; }
    
    .text-ink-blue { color: #2F4156 !important; }
    .text-brick-red { color: #B25549 !important; }
    .text-neutral { color: #222222 !important; }
    .text-white { color: #ffffff !important; }
    .text-muted { color: #9A9289 !important; }
    
    /* Design System Components */
    .card {
      background-color: #ffffff;
      border-radius: 0.875rem; /* var(--radius) */
      box-shadow: 0 8px 24px -8px hsla(212, 29%, 26%, 0.15), 
                  0 4px 8px -4px hsla(212, 29%, 26%, 0.1);
      margin-bottom: 1.5rem;
    }
    
    /* Button System from Design System */
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 0.875rem;
      text-decoration: none;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      font-size: 1.125rem; /* Increased from 1rem */
      text-align: center;
      line-height: 1.2;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }
    
    .btn-primary {
      background-color: #2F4156; /* hsl(var(--primary)) */
      color: #ffffff; /* hsl(var(--primary-foreground)) */
    }
    
    .btn-primary:hover {
      background-color: #243140; /* 212 29% 22% */
    }
    
    .btn-secondary {
      background-color: transparent;
      color: #B25549; /* hsl(var(--secondary)) */
      border-color: #B25549; /* hsl(var(--secondary)) */
    }
    
    .btn-secondary:hover {
      background-color: #F7EDEA; /* 14 45% 94% */
    }
    
    .btn-spotlight {
      background-color: #FFD44D; /* hsl(var(--accent)) */
      color: #2F4156; /* hsl(var(--accent-foreground)) */
      border-color: #2F4156; /* hsl(var(--primary)) */
    }
    
    .btn-spotlight:hover {
      background-color: #FFC940; /* 46 100% 61% */
    }
    
    /* Typography Scale from Design System */
    .h1 {
      font-family: 'Spectral', Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 2rem; /* 32px */
      line-height: 1.2;
      color: #2F4156; /* hsl(var(--primary)) */
      margin: 0 0 1rem 0;
    }
    
    .h2 {
      font-family: 'Spectral', Georgia, 'Times New Roman', serif;
      font-weight: 600;
      font-size: 1.5rem; /* 24px */
      line-height: 1.25;
      color: #2F4156; /* hsl(var(--primary)) */
      margin: 0 0 1rem 0;
    }
    
    .h3 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 1.25rem; /* 20px */
      line-height: 1.3;
      color: #B25549; /* hsl(var(--secondary)) - Brick Red */
      margin: 0 0 1rem 0;
    }
    
    .subtitle {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 1.125rem; /* 18px */
      color: #B25549; /* hsl(var(--secondary)) */
      margin: 0 0 1rem 0;
    }
    
    .body-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #222222; /* hsl(var(--foreground)) */
      font-size: 1rem; /* 16px */
      line-height: 1.6;
      margin: 0 0 1rem 0;
    }
    
    .meta-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.875rem; /* 14px */
      color: #9A9289; /* hsl(var(--muted-foreground)) */
      line-height: 1.5;
    }
    
    /* List Styles */
    .ordered-list {
      padding-left: 1.5rem;
      margin: 0 0 1.5rem 0;
    }
    
    .ordered-list li {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #222222;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 0.5rem;
    }
    
    .unordered-list {
      padding-left: 1.5rem;
      margin: 0 0 1.5rem 0;
      list-style-type: disc;
    }
    
    .unordered-list li {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #222222;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 0.5rem;
    }
    
    /* Mobile Responsive */
    @media only screen and (max-width: 600px) {
      .container {
        padding: 1rem !important;
      }
      .card {
        margin: 0 0 1rem 0 !important;
      }
      .mobile-padding {
        padding: 1.5rem !important;
      }
      .h1 {
        font-size: 1.5rem !important; /* 24px */
      }
      .h2 {
        font-size: 1.25rem !important; /* 20px */
      }
      .btn {
        padding: 1rem 1.5rem !important;
        font-size: 1.125rem !important;
        min-height: 44px !important; /* Touch-friendly */
      }
      .btn-mobile-full {
        width: calc(100% - 2rem) !important;
        max-width: 400px !important;
        display: block !important;
        margin: 0 auto !important;
      }
    }
    
    /* Footer Links */
    .footer-links {
      text-align: center;
      margin-top: 2rem;
    }
    
    .footer-links a {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #2F4156;
      text-decoration: none;
      font-size: 0.875rem;
      margin: 0 1rem;
    }
    
    .footer-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>

<body style="margin: 0; padding: 0; width: 100%; min-width: 100%; background-color: #FEF4E9;">
  
  <!-- Email Container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #FEF4E9;">
    <tr>
      <td class="container" style="padding: 2rem 1.25rem;">
        
        <!-- Email Header -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-family: 'Spectral', Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 2rem; line-height: 1.2; color: #2F4156; margin: 0 0 0.5rem 0;">Order confirmed</h1>
          <h3 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 1.25rem; line-height: 1.3; color: #B25549; margin: 0 0 1rem 0;">Your message is in motion</h3>
          <img src="https://xwsgyxlvxntgpochonwe.supabase.co/storage/v1/object/public/Email%20logo%20bucket/canaryholdingpen.png" alt="Canary holding pen" style="max-width: 150px; height: auto; margin: 0;" />
        </div>
        
        <!-- Order Details Section -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card" style="width: 100%; margin: 24px 0;">
          <tr>
            <td class="mobile-padding" style="padding: 2rem;">
              
              <!-- Confirmed Badge - First row, right-aligned -->
              <div style="text-align: right; margin-bottom: 1rem;">
                <span style="display: inline-flex; align-items: center; gap: 6px; background-color: #FFD44D; color: #2F4156; padding: 6px 12px; border-radius: 9999px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1); white-space: nowrap;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Confirmed
                </span>
              </div>
              
              <!-- Top line: Order Number (H2, Ink Blue, strong) -->
              <h2 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 1.5rem; line-height: 1.25; color: #2F4156; margin: 0 0 0.5rem 0;">Order #${orderNumber}</h2>

               <!-- Subline: Card count and date (H3, neutral) -->
               <h3 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 400; font-size: 1.125rem; line-height: 1.3; color: #222222; margin: 0 0 1rem 0;">${cardCount} postcards • Placed ${orderPlacedDate}</h3>

               <!-- Key meta (small, muted, stacked) -->
               <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.875rem; color: #9A9289; line-height: 1.5; margin-bottom: 0.5rem;">Total charged: ${totalAmount}</p>
               <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.875rem; color: #9A9289; line-height: 1.5; margin-bottom: 1.5rem;">Expected mailing date: ${expectedMailingDate}</p>

               <!-- Recipients section -->
               <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 0.875rem; color: #9A9289; line-height: 1.5; margin-bottom: 0.5rem;">Postcards sent to:</p>
               <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222222; font-size: 1rem; line-height: 1.6;">
                 ${recipientList}
               </div>
               
            </td>
          </tr>
        </table>
        
        <!-- Timeline Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card" style="width: 100%;">
          <tr>
            <td class="mobile-padding" style="padding: 2rem;">
              
              <!-- H3: Here's What Happens Next -->
              <h3 class="h3">Here's What Happens Next</h3>
              
              <!-- Combined Timeline (Ordered List) -->
              <ol class="ordered-list">
                <li>Over the next several days, your postcard will be written with a real ballpoint pen on premium card stock.</li>
                <li>You'll get another email as soon as your postcards are dropped in the mail.</li>
                <li>About a week later, your message will be on your representatives' desks in Washington.</li>
              </ol>
              
            </td>
          </tr>
        </table>
        
        <!-- Share Card - Direct Action Buttons -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card" style="width: 100%;">
          <tr>
            <td class="mobile-padding" style="padding: 2rem;">
              
              <!-- H2: Friends listen to friends -->
              <h2 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 1.5rem; line-height: 1.25; color: #2F4156; margin: 0 0 1rem 0;">Friends Listen To Friends</h2>
              
              <!-- Share Pitch -->
              <p class="body-text">Your voice is powerful — and even stronger when more join in. Most people join because a friend shared Canary with them. Pass it on and make your impact multiply.</p>
              
              <!-- Single Smart Share Button -->
              <div style="text-align: center; margin-top: 1.5rem;">
                <div style="display: inline-block; background-color: #2F4156; padding: 2px; border-radius: 14px; max-width: calc(100% - 2rem);">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #FFD44D; border-radius: 12px; overflow: hidden;">
                    <tr>
                      <td style="padding: 18px 24px; text-align: center; vertical-align: middle;">
                         <a href="https://xwsgyxlvxntgpochonwe.supabase.co/functions/v1/smart-share?ref=email&order=${orderNumber || ''}" style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 600; color: #2F4156; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; line-height: 1;">>
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                             <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                             <polyline points="16,6 12,2 8,6"/>
                             <line x1="12" y1="2" x2="12" y2="15"/>
                           </svg>
                           Share in the group chat
                         </a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Copy Link Fallback -->
              <div style="text-align: center; margin-top: 1rem;">
                <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; margin: 0;">
                  Or copy this link: <a href="${getAppUrl()}" style="color: #2F4156; text-decoration: none;">${getAppUrl()}</a>
                </p>
              </div>
              
            </td>
          </tr>
        </table>
        
        ${finalMessage ? `
        <!-- Postcard Content Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card" style="width: 100%;">
          <tr>
            <td class="mobile-padding" style="padding: 2rem;">
              
              <!-- H4: Your Postcard Messages -->
              <h4 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 1.125rem; line-height: 1.3; color: #2F4156; margin: 0 0 1rem 0;">Your Postcard Messages</h4>
              
              ${postcardMessagesSection}
              
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Closing Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card" style="width: 100%;">
          <tr>
            <td class="mobile-padding" style="padding: 2rem;">
              
              <!-- Closing Paragraph -->
              <p class="body-text">Thanks for raising your voice. We're proud to stand with you.</p>
              <p class="body-text">—The Canary Cards Team</p>
              
            </td>
          </tr>
        </table>
        
        <!-- Footer Links -->
        <div class="footer-links">
          <a href="mailto:hello@canary.cards">Support</a>
          <a href="https://canary.cards/privacy">Privacy</a>
          <a href="https://canary.cards/unsubscribe">Unsubscribe</a>
        </div>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;

    const emailResponse = await resend.emails.send({
      from: "Canary Cards <hello@canary.cards>",
      to: [userInfo.email],
      subject: "Order confirmed — Your message is in motion",
      html: emailHtml,
    });

    console.log("Order confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-order-confirmation function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);