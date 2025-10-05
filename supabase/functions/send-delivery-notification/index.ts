// ============================================
// send-delivery-notification v4
// Sends delivery notification emails via Resend
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v4";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const handler = async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      postcardId, 
      recipientName, 
      recipientAddress,
      senderName,
      senderAddress,
      senderCity,
      senderState,
      message, 
      sentAt, 
      userEmail,
      recipientType,
      representativeId,
      uid,
      frontendUrl
    } = await req.json();
    
    console.log(`[send-delivery-notification ${VERSION}] Processing delivery notification for postcard:`, postcardId);
    console.log(`[send-delivery-notification ${VERSION}] Recipient:`, recipientName);
    console.log(`[send-delivery-notification ${VERSION}] User email:`, userEmail);
    
    if (!userEmail) {
      console.log(`[send-delivery-notification ${VERSION}] No user email available, cannot send delivery notification`);
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

    // Fetch customer's sharing link from database using normalized email
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Normalize email to match database normalization logic
    const normalizeEmail = (email: string): string => {
      if (!email) return '';
      
      let normalized = email.toLowerCase().trim();
      const parts = normalized.split('@');
      if (parts.length !== 2) return normalized;
      
      let [localPart, domain] = parts;
      
      // Remove everything after + in local part
      const plusIndex = localPart.indexOf('+');
      if (plusIndex > 0) {
        localPart = localPart.substring(0, plusIndex);
      }
      
      // For Gmail, remove dots from local part
      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        localPart = localPart.replace(/\./g, '');
      }
      
      return `${localPart}@${domain}`;
    };
    
    const normalizedEmail = normalizeEmail(userEmail);

    const { data: customer } = await supabase
      .from('customers')
      .select('sharing_link, email_normalized')
      .eq('email_normalized', normalizedEmail)
      .maybeSingle();

    const sharingLink = customer?.sharing_link || 'direct';
    
    console.log(`[send-delivery-notification ${VERSION}] Sharing link lookup:`, {
      originalEmail: userEmail,
      normalizedEmail,
      foundCustomer: !!customer,
      customerEmailNormalized: customer?.email_normalized,
      sharingLink
    });
    
    // Generate shareable URL - use frontendUrl if provided, fallback to FRONTEND_URL env var, then production
    const appUrl = frontendUrl || Deno.env.get('FRONTEND_URL') || 'https://canary.cards';
    const shareUrl = `${appUrl}/share?ref=${encodeURIComponent(sharingLink)}`;
    
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
    
    // Format mailing date
    const mailingDate = baseDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    // Format delivery date (short)
    const deliveryDateShort = expectedDeliveryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    // Extract rep title and last name from recipientName
    const repTitleAndLastName = recipientName;
    
    // Generate order number from postcardId
    const formatOrderNumber = (uuid) => {
      if (!uuid) return 'CC000000';
      return 'CC' + uuid.replace(/-/g, '').slice(-6).toUpperCase();
    };
    const orderNumber = postcardId ? formatOrderNumber(postcardId) : 'CC000000';
    
    // Escape user message content to prevent HTML injection while preserving line breaks
    const escapeHtml = (str) => {
      return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '\n');
    };
    const safeMessage = escapeHtml(message || '');
    
    // Format message for postcard preview
    const formatPostcardMessage = (msg, repName) => {
      if (!msg.trim().toLowerCase().startsWith('dear')) {
        return `Dear ${repName},\n\n${msg}`;
      }
      return msg;
    };
    const postcardContent = formatPostcardMessage(safeMessage, repTitleAndLastName);
    
    // Create the delivery notification email with order confirmation structure
    const emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Order mailed</title>
  
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
      display: block;
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
    
    .h1 {
      font-family: 'Spectral', Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 28px;
      line-height: 1.2;
      color: #2F4156;
      margin: 0 0 12px 0;
    }
    
    .h2 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 20px;
      line-height: 1.3;
      color: #2F4156;
      margin: 0 0 12px 0;
    }
    
    .h3 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 16px;
      color: #B25549;
      margin: 0 0 8px 0;
    }
    
    .body-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #222222;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 12px 0;
    }
    
    .meta-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #9A9289;
      line-height: 1.5;
    }
    
    .order-label {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #9A9289;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .order-value {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      color: #222222;
      font-weight: 500;
    }
    
    .postcard-preview {
      background-color: #ffffff;
      border: 2px solid #E8DECF;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.8;
      color: #222222;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      white-space: pre-wrap;
    }
    
    @media only screen and (max-width: 600px) {
      .h1 {
        font-size: 24px !important;
      }
      .h2 {
        font-size: 18px !important;
      }
    }
    
    .footer-links a {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #2F4156;
      text-decoration: none;
      font-size: 14px;
      margin: 0 16px;
    }
  </style>
</head>

<body style="margin: 0; padding: 0; width: 100%; background-color: #FEF4E9;">
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #FEF4E9;">
    <tr>
      <td style="padding: 32px 20px;">
        
        <!-- Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td align="center">
              <img src="https://raw.githubusercontent.com/canary-cards/canary-cards-development/main/public/New%20Logo%20V5-min.png" 
                   alt="Canary Cards" 
                   width="100" 
                   height="auto" 
                   style="display: block; margin: 0 auto; max-width: 100px; border: 0;" />
            </td>
          </tr>
        </table>
        
        <!-- Hero Section -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 24px;">
          <tr>
            <td align="center">
              <h1 class="h1">Order mailed</h1>
            </td>
          </tr>
        </table>
        
        <!-- Delivery Details Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="width: 50%; padding: 0 8px 16px 0; vertical-align: top;">
                      <div class="order-label">RECIPIENT</div>
                      <div class="order-value">${repTitleAndLastName}</div>
                    </td>
                    <td style="width: 50%; padding: 0 0 16px 8px; vertical-align: top;">
                      <div class="order-label">MAILED</div>
                      <div class="order-value">${mailingDate}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 0 8px 0 0; vertical-align: top;">
                      <div class="order-label">ORDER #</div>
                      <div class="order-value">${orderNumber}</div>
                    </td>
                    <td style="width: 50%; padding: 0 0 0 8px; vertical-align: top;">
                      <div class="order-label">EXPECTED DELIVERY</div>
                      <div class="order-value">${deliveryDateShort}</div>
                    </td>
                  </tr>
                </table>
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Journey Timeline Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h3 class="h3" style="text-align: left; margin-bottom: 20px;">Your Postcard's Journey</h3>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 12px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top; padding-right: 12px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #2F4156; border: 2px solid #2F4156; font-weight: 600; color: white; font-size: 14px; text-align: center; line-height: 28px;">✓</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Order Confirmed</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Your payment was processed and order queued.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 12px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top; padding-right: 12px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #2F4156; border: 2px solid #2F4156; font-weight: 600; color: white; font-size: 14px; text-align: center; line-height: 28px;">✓</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Being Written</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Written with a real ballpoint pen on premium cardstock.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 12px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top; padding-right: 12px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #2F4156; border: 2px solid #2F4156; font-weight: 600; color: white; font-size: 14px; text-align: center; line-height: 28px;">✓</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Mailed (Today)</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Stamped first-class and dropped in the mail. Congressional mailrooms screen it, then it moves upstairs.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 12px 0 0 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top; padding-right: 12px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: white; border: 2px solid #E8DECF; font-weight: 600; color: #9A9289; font-size: 14px; text-align: center; line-height: 28px;">4</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Delivered (~${deliveryDateShort})</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Your message lands on their desk. Unlike emails, postcards get read.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- How Your Postcard Was Made Card (with GIF) -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); text-align: center;">
                
                <h3 class="h3" style="text-align: left; margin-bottom: 16px;">How Your Postcard Was Made</h3>
                
                <img src="https://raw.githubusercontent.com/canary-cards/canary-cards-development/main/public/robot-writing.gif" 
                     alt="Robot writing your postcard with a real ballpoint pen"
                     width="350"
                     style="display: block; margin: 0 auto 16px auto; max-width: 100%; height: auto; border-radius: 8px;" />
                
                <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5; margin: 0;">
                  Real ballpoint pen on premium cardstock
                </p>
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Impact Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <a href="https://canary.cards/research" style="text-decoration: none; display: block;">
                <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); transition: all 0.2s ease;">
                  
                  <h3 class="h3" style="margin-bottom: 16px;">THE RESEARCH</h3>
                  
                  <p class="body-text" style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5;">
                    96% of staffers say personalized constituent messages influence undecided votes.
                  </p>
                  
                  <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #9A9289; line-height: 1.5; margin: 0;">
                    Source: CMF 2011 Study →
                  </p>
                  
                </div>
              </a>
            </td>
          </tr>
        </table>
        
        <!-- Share Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h2 class="h2" style="text-align: center;">Friends Listen to Friends</h2>
                <p class="body-text" style="text-align: center;">When 5 friends join, your collective impact reaches the threshold staffers notice.</p>
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-top: 16px;">
                  <tr>
                    <td align="center">
                      <a href="${shareUrl}" style="background-color: #FFD44D; color: #2F4156; border: 2px solid #2F4156; text-decoration: none; display: inline-block; padding: 14px 24px; border-radius: 12px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; font-size: 16px; max-width: 280px; min-width: 200px;">
                        Share Canary with Friends ↗
                      </a>
                    </td>
                  </tr>
                </table>
                
                <p class="meta-text" style="text-align: center; margin-top: 12px;">
                  Or copy: <a href="${shareUrl}" style="color: #2F4156; font-weight: 600; text-decoration: none;">${shareUrl}</a>
                </p>
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Postcard Content Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h3 class="h3">Your message to ${repTitleAndLastName}</h3>
                
                <div class="postcard-preview">${postcardContent}</div>
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Closing Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                <p class="body-text">Thanks for raising your voice. We're proud to stand with you.</p>
                <p class="body-text">–The Canary Cards Team</p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Footer -->
        <div class="footer-links" style="text-align: center; margin-top: 32px;">
          <a href="mailto:hello@canary.cards">Support</a>
          <a href="https://canary.cards/privacy">Privacy</a>
        </div>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;

    console.log(`[send-delivery-notification ${VERSION}] Sending mailed notification email to:`, userEmail);
    
    const emailResponse = await resend.emails.send({
      from: "Canary Cards <hello@canary.cards>",
      to: [userEmail],
      subject: `Order mailed - your postcard to ${repTitleAndLastName} is on its way`,
      html: emailHtml,
      text: `Your postcard to ${repTitleAndLastName} has been mailed and should arrive around ${formattedExpectedDate}.`
    });
    
    if (emailResponse.error) {
      console.error(`[send-delivery-notification ${VERSION}] Resend API error:`, emailResponse.error);
      console.error(`[send-delivery-notification ${VERSION}] Error details:`, {
        statusCode: 500,
        message: emailResponse.error.message,
        userEmail,
        postcardId
      });
    } else {
      console.log(`[send-delivery-notification ${VERSION}] Mailed notification email sent successfully:`, emailResponse);
    }
    
    return new Response(JSON.stringify({
      success: true,
      emailId: emailResponse.data?.id,
      postcardId,
      recipientName,
      version: VERSION
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error(`[send-delivery-notification ${VERSION}] Error in function:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      version: VERSION
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
