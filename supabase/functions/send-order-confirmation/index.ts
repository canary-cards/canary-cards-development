// ============================================
// send-order-confirmation v3
// Sends order confirmation emails via Resend
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v3";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const handler = async (req) => {
  console.log(`[send-order-confirmation ${VERSION}] Function invoked`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userInfo, 
      representative, 
      senators, 
      sendOption, 
      orderResults, 
      finalMessage, 
      actualMailingDate, 
      refundInfo, 
      summary,
      frontendUrl
    } = await req.json();

    if (!userInfo.email) {
      return new Response(JSON.stringify({ message: 'No email provided' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch customer's sharing link from database
    const { data: customer } = await supabase
      .from('customers')
      .select('sharing_link')
      .eq('email', userInfo.email)
      .maybeSingle();

    const sharingLink = customer?.sharing_link || 'direct';

    const successfulOrders = orderResults.filter(order => order.status === 'success');
    const failedOrders = orderResults.filter(order => order.status === 'error');
    const totalOrders = orderResults.length;
    const successCount = successfulOrders.length;
    const failedCount = failedOrders.length;

    // Determine email type
    let emailType;
    if (failedCount === 0) {
      emailType = 'complete_success';
    } else if (successCount === 0) {
      emailType = 'complete_failure';
    } else {
      emailType = 'partial_failure';
    }

    // Format dates
    const orderPlacedDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    let expectedMailingDate;
    if (actualMailingDate) {
      expectedMailingDate = new Date(actualMailingDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } else {
      expectedMailingDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }

    // Generate order number
    const formatOrderNumber = (uuid) => {
      if (!uuid) return 'CC000000';
      return 'CC' + uuid.replace(/-/g, '').slice(-6).toUpperCase();
    };
    const orderNumber = successfulOrders.length > 0 && successfulOrders[0].orderId 
      ? formatOrderNumber(successfulOrders[0].orderId) 
      : 'CC000000';

    // Calculate amounts
    const unitPrice = 5.00;
    let totalAmount, originalAmount, refundAmount;

    if (emailType === 'complete_success') {
      if (successCount === 1) {
        totalAmount = '$5.00';
      } else if (successCount === 2) {
        totalAmount = '$10.00';
      } else if (successCount >= 3) {
        totalAmount = '$12.00';
      }
      originalAmount = totalAmount;
    } else {
      if (refundInfo) {
        originalAmount = `$${(refundInfo.totalAmountCents / 100).toFixed(2)}`;
        refundAmount = `$${(refundInfo.refundAmountCents / 100).toFixed(2)}`;
        if (successCount > 0) {
          const finalAmountCents = refundInfo.totalAmountCents - refundInfo.refundAmountCents;
          totalAmount = `$${(finalAmountCents / 100).toFixed(2)}`;
        } else {
          totalAmount = '$0.00';
        }
      } else {
        originalAmount = totalOrders === 1 ? '$5.00' : totalOrders === 2 ? '$10.00' : '$12.00';
        if (successCount > 0) {
          totalAmount = successCount === 1 ? '$5.00' : successCount === 2 ? '$10.00' : '$12.00';
          const originalCents = totalOrders === 1 ? 500 : totalOrders === 2 ? 1000 : 1200;
          const finalCents = successCount === 1 ? 500 : successCount === 2 ? 1000 : 1200;
          refundAmount = `$${((originalCents - finalCents) / 100).toFixed(2)}`;
        } else {
          totalAmount = '$0.00';
          refundAmount = originalAmount;
        }
      }
    }

    // Header messaging
    let headerTitle, statusText;
    if (emailType === 'complete_success') {
      headerTitle = 'Order confirmed';
      statusText = 'Confirmed';
    } else if (emailType === 'partial_failure') {
      headerTitle = 'Order partially processed';
      statusText = 'Partial';
    } else {
      headerTitle = 'Order refunded';
      statusText = 'Refunded';
    }

    // Format representative name helper
    const formatRepresentativeName = (rep) => {
      const nameParts = rep.name.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      return rep.type === 'representative' ? `Rep. ${lastName}` : `Sen. ${lastName}`;
    };

    // Recipient summary
    let recipientSummary;
    if (successCount === 1) {
      const rep = successfulOrders[0].type === 'representative' 
        ? representative 
        : senators?.find(s => s.name === successfulOrders[0].recipient);
      recipientSummary = rep ? formatRepresentativeName(rep) : successfulOrders[0].recipient;
    } else if (successCount >= 2) {
      const names = successfulOrders.map(order => {
        const rep = order.type === 'representative' 
          ? representative 
          : senators?.find(s => s.name === order.recipient);
        return rep ? formatRepresentativeName(rep) : order.recipient;
      });
      recipientSummary = names.join('<br>');
    }

    // Refund message
    let refundMessage = '';
    let hasRefund = false;
    if (emailType !== 'complete_success' && refundInfo) {
      hasRefund = true;
      if (emailType === 'complete_failure') {
        refundMessage = `Full refund processed: ${refundAmount} • Refund ID: ${refundInfo.refundId}`;
      } else {
        refundMessage = `Partial refund processed: ${refundAmount} • Refund ID: ${refundInfo.refundId}`;
      }
    }

    const primaryRepName = representative ? formatRepresentativeName(representative) : 'your representative';

    // Postcard content
    let postcardContent = '';
    if (finalMessage && successfulOrders.length > 0) {
      const firstRep = successfulOrders[0].type === 'representative' 
        ? representative 
        : senators?.find(s => s.name === successfulOrders[0].recipient);
      const nameParts = firstRep.name.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const shortTitle = firstRep.type === 'representative' ? 'Rep.' : 'Sen.';
      postcardContent = `Dear ${shortTitle} ${lastName},\n\n${finalMessage}`;
    }

    // Other recipients list
    let otherRecipients = '';
    let hasMultipleRecipients = false;
    if (successfulOrders.length > 1) {
      hasMultipleRecipients = true;
      const others = successfulOrders.slice(1).map(order => {
        const rep = order.type === 'representative' 
          ? representative 
          : senators?.find(s => s.name === order.recipient);
        return rep ? formatRepresentativeName(rep) : order.recipient;
      });
      otherRecipients = others.join(' and ');
    }

    // App URLs - use frontendUrl if provided, fallback to FRONTEND_URL env var, then production
    const appUrl = frontendUrl || Deno.env.get('FRONTEND_URL') || 'https://canary.cards';
    const shareUrl = `${appUrl}/share?ref=${encodeURIComponent(sharingLink)}`;

    // Build email HTML
    const emailHtml = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Order confirmed — Your message is in motion</title>
  
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
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: #FFD44D;
      color: #2F4156;
      padding: 6px 12px;
      border-radius: 9999px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      white-space: nowrap;
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
    
    .journey-label {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: #9A9289;
      margin-top: 8px;
    }
    
    .journey-label.active {
      color: #2F4156;
      font-weight: 600;
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
              <h1 class="h1">${headerTitle}</h1>
              <p class="meta-text" style="margin-top: 8px;">Order #${orderNumber}</p>
            </td>
          </tr>
        </table>
        
        <!-- Order Details Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="width: 50%; padding: 0 8px 16px 0; vertical-align: top;">
                      <div class="order-label">RECIPIENTS</div>
                      <div class="order-value">${recipientSummary}</div>
                    </td>
                    <td style="width: 50%; padding: 0 0 16px 8px; vertical-align: top;">
                      <div class="order-label">TOTAL</div>
                      <div class="order-value">${totalAmount}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 50%; padding: 0 8px 0 0; vertical-align: top;">
                      <div class="order-label">PLACED</div>
                      <div class="order-value">${orderPlacedDate}</div>
                    </td>
                    <td style="width: 50%; padding: 0 0 0 8px; vertical-align: top;">
                      <div class="order-label">EXPECTED MAILING</div>
                      <div class="order-value">${expectedMailingDate}</div>
                    </td>
                  </tr>
                </table>
                
                ${hasRefund ? `
                <div style="background-color: #FFF7F7; border: 1px solid #F0C8C8; border-radius: 8px; padding: 16px; margin-top: 16px;">
                  <p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #B25549; line-height: 1.5; margin: 0; font-weight: 500;">
                    ${refundMessage}
                  </p>
                </div>
                ` : ''}
                
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Journey Timeline Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h3 class="h3" style="text-align: left; margin-bottom: 20px;">Here's What Happens Next</h3>
                
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
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Your payment has been processed and your order is queued.</div>
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
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #FFD44D; border: 2px solid #2F4156; font-weight: 600; color: #2F4156; font-size: 14px; text-align: center; line-height: 28px;">2</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Being Written (Current Step)</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Over the next several days, your postcard will be written with a real ballpoint pen on premium card stock.</div>
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
                            <div style="width: 28px; height: 28px; border-radius: 50%; background-color: white; border: 2px solid #E8DECF; font-weight: 600; color: #9A9289; font-size: 14px; text-align: center; line-height: 28px;">3</div>
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Mailing (~${expectedMailingDate})</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">You'll get another email as soon as your postcards are dropped in the mail.</div>
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
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #2F4156; margin-bottom: 4px;">Delivered (About a Week Later)</div>
                            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9A9289; line-height: 1.5;">Your message will be on your representatives' desks in Washington.</div>
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
                  Or copy: <a href="${appUrl}" style="color: #2F4156; font-weight: 600; text-decoration: none;">${appUrl}</a>
                </p>
                
              </div>
            </td>
          </tr>
        </table>
        
        ${finalMessage && successfulOrders.length > 0 ? `
        <!-- Postcard Content Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h3 class="h3">Your message to ${primaryRepName}</h3>
                
                <div class="postcard-preview">${postcardContent}</div>
                
                ${hasMultipleRecipients ? `
                <p class="meta-text" style="margin-top: 12px; text-align: center;">
                  Similar messages sent to ${otherRecipients}
                </p>
                ` : ''}
                
              </div>
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Closing Card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%; margin-bottom: 16px;">
          <tr>
            <td style="padding: 0;">
              <div style="background-color: #ffffff; border: 1px solid #E8DECF; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                <p class="body-text">Thanks for raising your voice. We're proud to stand with you.</p>
                <p class="body-text">—The Canary Cards Team</p>
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

    console.log(`[send-order-confirmation ${VERSION}] Sending email to:`, userInfo.email);
    
    try {
      const emailResponse = await resend.emails.send({
        from: "Canary Cards <hello@canary.cards>",
        to: [userInfo.email],
        subject: "Order confirmed – Your message is in motion",
        html: emailHtml
      });

      console.log(`[send-order-confirmation ${VERSION}] Email sent successfully:`, emailResponse);
      
      return new Response(JSON.stringify({
        success: true,
        emailId: emailResponse.data?.id,
        version: VERSION
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
      
    } catch (emailError) {
      console.error(`[send-order-confirmation ${VERSION}] Failed to send email via Resend:`, emailError);
      return new Response(JSON.stringify({
        success: false,
        error: `Email sending failed: ${emailError.message}`,
        details: emailError.response || emailError.status,
        version: VERSION
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
  } catch (error) {
    console.error(`[send-order-confirmation ${VERSION}] Error in function:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      version: VERSION
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
