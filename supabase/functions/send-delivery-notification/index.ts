import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const handler = async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { postcardId, recipientName, recipientAddress, senderName, senderAddress, senderCity, senderState, message, sentAt, userEmail, recipientType, representativeId, uid } = await req.json();
    
    console.log('Processing delivery notification for postcard:', postcardId);
    console.log('Recipient:', recipientName);
    console.log('Sender:', senderName);
    console.log('User email:', userEmail);

    // If no user email provided, we can't send the notification
    if (!userEmail) {
      console.log('No user email available, cannot send delivery notification');
      return new Response(JSON.stringify({
        success: false,
        message: 'No user email available for delivery notification'
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    // Calculate expected delivery date (9 days from sentAt or now)
    const baseDate = sentAt ? new Date(sentAt) : new Date();
    const expectedDeliveryDate = new Date(baseDate);
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 9);
    
    const formattedExpectedDate = expectedDeliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Extract rep title and last name from recipientName
    const repTitleAndLastName = recipientName; // This should already be in format "Rep. Johnson" or "Sen. Smith"
    
    // Escape user message content to prevent HTML injection while preserving line breaks
    const escapeHtml = (str) => {
      return str.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/\n/g, '<br>');
    };
    
    const safeMessage = escapeHtml(message || '');
    
    // Use the provided PNG logo URL with cache-buster
    const logoUrl = `https://xwsgyxlvxntgpochonwe.supabase.co/storage/v1/object/public/Email%20logo%20bucket/flyingcanarywithpostcard.png?v=1`;
    
    // Create the mailed notification email with table-based layout matching order confirmation
    const emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your postcard is on its way</title>
  
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
      --background: 31 91% 95%; /* Cream #FEF4E9 */
      --foreground: 0 0% 13%;  /* Neutral text #222222 */
      --card: 0 0% 100%;       /* White */
      --card-foreground: 0 0% 13%;
      --primary: 212 29% 26%;            /* Ink Blue #2F4156 */
      --primary-foreground: 0 0% 100%;    /* White */
      --secondary: 7 45% 42%;             /* Brick Red #B25549 */
      --secondary-foreground: 7 45% 42%;  /* Red text */
      --accent: 46 100% 65%;              /* Canary Yellow #FFD44D */
      --accent-foreground: 212 29% 26%;   /* Ink Blue text/border */
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
      border-radius: 0.875rem;
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
      font-size: 1.125rem;
      text-align: center;
      line-height: 1.2;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }
    
    .btn-primary {
      background-color: #2F4156;
      color: #ffffff;
    }
    
    .btn-primary:hover {
      background-color: #243140;
    }
    
    .btn-secondary {
      background-color: transparent;
      color: #B25549;
      border-color: #B25549;
    }
    
    .btn-secondary:hover {
      background-color: #F7EDEA;
    }
    
    .btn-spotlight {
      background-color: #FFD44D;
      color: #2F4156;
      border-color: #2F4156;
    }
    
    .btn-spotlight:hover {
      background-color: #FFC940;
    }
    
    /* Typography Scale from Design System */
    .h1 {
      font-family: 'Spectral', Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 2rem;
      line-height: 1.2;
      color: #2F4156;
      margin: 0 0 1rem 0;
    }
    
    .h2 {
      font-family: 'Spectral', Georgia, 'Times New Roman', serif;
      font-weight: 600;
      font-size: 1.5rem;
      line-height: 1.25;
      color: #2F4156;
      margin: 0 0 1rem 0;
    }
    
    .h3 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 1.25rem;
      line-height: 1.3;
      color: #B25549;
      margin: 0 0 1rem 0;
    }
    
    .subtitle {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 1.125rem;
      color: #B25549;
      margin: 0 0 1rem 0;
    }
    
    .body-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #222222;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 1rem 0;
    }
    
    .meta-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.875rem;
      color: #9A9289;
      line-height: 1.5;
    }
    
    /* CTA styling matching design system */
    .primary-cta {
      background-color: #FFD44D;
      border: 2px solid #2F4156;
      border-radius: 12px;
      padding: 16px 24px;
      text-align: center;
      text-decoration: none;
      display: block;
      margin-bottom: 16px;
      transition: background-color 0.2s ease;
    }
    
    .primary-cta:hover {
      background-color: #FFD041;
    }
    
    .primary-cta-text {
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 18px;
      color: #2F4156;
      margin: 0;
    }
    
    .secondary-cta {
      background-color: transparent;
      border: 2px solid #B25549;
      border-radius: 12px;
      padding: 12px 24px;
      text-align: center;
      text-decoration: none;
      display: block;
    }
    
    .secondary-cta:hover {
      background-color: #F7EDEA;
    }
    
    .secondary-cta-text {
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      font-size: 16px;
      color: #B25549;
      margin: 0;
    }
    
    .postcard-content {
      background-color: #FFFFFF;
      border-radius: 8px;
      padding: 20px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #222222;
      border: 1px solid #E8DECF;
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
        font-size: 1.5rem !important;
      }
      .h2 {
        font-size: 1.25rem !important;
      }
      .btn {
        padding: 1rem 1.5rem !important;
        font-size: 1.125rem !important;
        min-height: 44px !important;
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

<body style="margin: 0; padding: 0; width: 100%; background-color: #FEF4E9; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Full-width table wrapper for background -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FEF4E9;">
    <tr>
      <td align="center" style="padding: 0;">
        <!-- Main content container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #FEF4E9;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              
              <!-- Header -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <h1 class="h1" style="font-family: 'Spectral', Georgia, serif; font-weight: 700; font-size: 32px; line-height: 1.2; color: #2F4156; text-align: center; margin: 0;">Your Postcard Is In The Mail!</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 30px;">
                    <img src="${logoUrl}" alt="Canary delivering postcard" style="width: 120px; height: auto; display: block;">
                  </td>
                </tr>
              </table>

              <!-- Main Content Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: none;">
                <tr>
                  <td>
                    <div class="card">
                      <div style="padding: 32px;">
                        <h2 class="h3" style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 20px; color: #B25549; margin: 0 0 20px 0;">Done! Your Postcard Is On Its Way To D.C.</h2>
                    
                    <p style="font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 500; color: #222222; margin: 0 0 20px 0;">
                      Expected delivery date: <strong style="color: #2F4156;">${formattedExpectedDate}</strong>
                    </p>
                    
                    <p class="body-text" style="font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.6; color: #222222; margin: 0 0 16px 0;">
                      We wrote your message with a real ballpoint pen on premium cardstock, stamped it first-class, and sent it to ${repTitleAndLastName}.
                    </p>
                    
                        <p class="body-text" style="font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.6; color: #222222; margin: 0;">
                          Congressional mailrooms do a quick security screen—then your card moves upstairs. Unlike a package, postcards don't come with tracking. But they arrive faster than letters, and they get read.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Thanks Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: none;">
                <tr>
                  <td>
                    <div class="card">
                      <div style="padding: 32px;">
                        <h2 class="h3" style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 20px; color: #B25549; margin: 0 0 20px 0;">Thanks For Speaking Up</h2>
                        
                        <p class="body-text" style="font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.6; color: #222222; margin: 0;">
                          Research shows that just 50 handwritten postcards can influence a member's vote. <em>— 2019 Congressional Management Foundation Study</em>
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Share Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: none;">
                <tr>
                  <td>
                    <div class="card">
                      <div style="padding: 32px;">
                        <h2 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 24px; color: #2F4156; margin: 0 0 8px 0;">Movements Grow One Friend At A Time</h2>
                    
                    <p class="body-text" style="font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.6; color: #222222; margin: 0 0 24px 0;">
                      Invite a friend to send their own postcard—together, we're impossible to ignore.
                    </p>
                    
                     <a href="https://xwsgyxlvxntgpochonwe.supabase.co/functions/v1/smart-share?ref=delivery&postcard=${postcardId || ''}" class="primary-cta" style="background-color: #FFD44D; border: 2px solid #2F4156; border-radius: 12px; padding: 16px 24px; text-align: center; text-decoration: none; display: block; margin-bottom: 16px;">>
                       <p class="primary-cta-text" style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; color: #2F4156; margin: 0;">Share Canary Cards</p>
                     </a>
                    
                    <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #5A646E; margin: 8px 0 20px 0; text-align: center;">Your share today could help another postcard land next week.</p>
                    
                        <a href="https://www.canary.cards" class="secondary-cta" style="background-color: transparent; border: 2px solid #B25549; border-radius: 12px; padding: 12px 24px; text-align: center; text-decoration: none; display: block;">
                          <p class="secondary-cta-text" style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 16px; color: #B25549; margin: 0;">Write Another Postcard</p>
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Postcard Message Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: none;">
                <tr>
                  <td>
                    <div class="card">
                      <div style="padding: 32px;">
                        <h4 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 1.125rem; line-height: 1.3; color: #2F4156; margin: 0 0 1rem 0;">Your Message To ${repTitleAndLastName}</h4>
                        
                        <div class="postcard-content" style="background-color: #FFFFFF; border-radius: 8px; padding: 20px; font-family: 'Inter', sans-serif; font-size: 14px; line-height: 1.5; color: #222222; border: 1px solid #E8DECF;">
                          ${safeMessage}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Team Message Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="card">
                <tr>
                  <td style="padding: 32px;">
                    <p style="font-family: 'Inter', sans-serif; font-size: 16px; color: #222222; margin: 0 0 16px 0;">
                      Thanks for raising your voice. We're proud to stand with you.
                    </p>
                    <p style="font-family: 'Inter', sans-serif; font-size: 16px; color: #222222; margin: 0;">
                      —The Canary Cards Team
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #E8DECF;">
                    <div style="text-align: center;">
                      <a href="#" style="font-family: 'Inter', sans-serif; font-size: 14px; color: #5A646E; text-decoration: none; margin: 0 20px;">Support</a>
                      <a href="#" style="font-family: 'Inter', sans-serif; font-size: 14px; color: #5A646E; text-decoration: none; margin: 0 20px;">Privacy</a>
                      <a href="#" style="font-family: 'Inter', sans-serif; font-size: 14px; color: #5A646E; text-decoration: none; margin: 0 20px;">Unsubscribe</a>
                    </div>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    
    console.log('Sending mailed notification email to:', userEmail);
    const emailResponse = await resend.emails.send({
      from: "Canary Cards <hello@canary.cards>",
      to: [
        userEmail
      ],
      subject: `Your postcard to ${repTitleAndLastName} is on its way`,
      html: emailHtml,
      text: `We've written and mailed your postcard.`
    });
    // Enhanced logging for debugging email delivery issues
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      console.error("Error details:", {
        statusCode: emailResponse.error.statusCode,
        message: emailResponse.error.message,
        userEmail,
        postcardId
      });
    } else {
      console.log("Mailed notification email sent successfully:", emailResponse);
    }
    return new Response(JSON.stringify({
      success: true,
      emailId: emailResponse.data?.id,
      postcardId,
      recipientName
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in send-delivery-notification function:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
};
serve(handler);