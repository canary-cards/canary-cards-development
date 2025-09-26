import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client for calling functions
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Webhook verification function
const verifyWebhookSignature = async (payload: string, signature: string, secret: string): Promise<boolean> => {
  try {
    // IgnitePost uses HMAC-SHA256 for webhook signatures
    const crypto = globalThis.crypto;
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(payload);
    
    // Create HMAC signature
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare signatures (should be prefixed with 'sha256=')
    const receivedSignature = signature.replace('sha256=', '');
    return expectedSignature === receivedSignature;
  } catch {
    return false;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== IgnitePost Webhook Received ===');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    // Only process POST requests
    if (req.method !== 'POST') {
      console.log('Non-POST request received, ignoring');
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature') || req.headers.get('x-ignitepost-signature');
    const webhookSecret = Deno.env.get('IGNITEPOST_WEBHOOK_SECRET');
    
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      console.log('Verifying webhook signature...');
      const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('❌ Invalid webhook signature');
        return new Response('Unauthorized', { 
          status: 401, 
          headers: corsHeaders 
        });
      }
      console.log('✅ Webhook signature verified');
    } else if (webhookSecret) {
      console.warn('⚠️ Webhook secret configured but no signature provided');
    } else {
      console.warn('⚠️ Webhook signature verification disabled (no secret configured)');
    }

    // Parse the webhook payload - this is the actual IgnitePost format
    const webhookData = JSON.parse(rawBody);
    console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));

    // Extract information from the actual IgnitePost webhook format
    const {
      id: postcardId,
      letter_template_id,
      message,
      metadata,
      uid,
      recipient_name,
      recipient_address_one,
      recipient_city,
      recipient_state,
      sender_name,
      sender_address_one,
      sender_city,
      sender_state,
      created_at,
      send_on,
      sent_at,
      sent_at_unix
    } = webhookData;

    console.log('=== Extracted Information ===');
    console.log('Postcard ID:', postcardId);
    console.log('Recipient:', recipient_name);
    console.log('Sender:', sender_name);
    console.log('Message:', message);
    console.log('Metadata:', metadata);
    console.log('UID:', uid);
    console.log('Sent At:', sent_at);
    console.log('Created At:', created_at);

    // Check if this is a delivery notification (webhook only fires when delivered)
    if (sent_at) {
      console.log('📮 DELIVERY notification detected - postcard has been sent to mail!');
      
      // Use the UID (which is now the postcard ID) to find and update the postcard
      let userEmail = null;
      let recipientType = null;
      let representativeId = null;
      
      if (uid) {
        console.log('Looking up postcard using UID (postcard ID):', uid);
        
        // Update postcard record using the UID (postcard ID)
        const { data: updatedPostcard, error: updateError } = await supabase
          .from('postcards')
          .update({
            delivery_status: 'mailed',
            mailed_at: new Date(sent_at).toISOString(),
            webhook_received_at: new Date().toISOString(),
            delivery_metadata: {
              sent_at_unix,
              ignitepost_id: postcardId,
              webhook_received: true
            }
          })
          .eq('id', uid) // Use postcard ID directly
          .select('order_id, recipient_type')
          .single();

        if (updateError) {
          console.error('Error updating postcard delivery status:', updateError);
          console.warn('⚠️ Could not find postcard - delivery notification cannot be sent');
        } else {
          console.log('Updated postcard delivery status:', updatedPostcard);
          
          // Get user email from the order through the postcard's order_id
          if (updatedPostcard?.order_id) {
            const { data: orderData, error: orderError } = await supabase
              .from('orders')
              .select('email_for_receipt')
              .eq('id', updatedPostcard.order_id)
              .single();
              
            if (orderError) {
              console.error('Error looking up order:', orderError);
              console.warn('⚠️ Could not find order - delivery notification cannot be sent');
            } else if (orderData) {
              userEmail = orderData.email_for_receipt;
              console.log('User email from our database:', userEmail);
            }
          }
          
          recipientType = updatedPostcard?.recipient_type;
        }
        
        // Get recipient ID from metadata
        if (metadata) {
          representativeId = metadata.representative_id;
          console.log('Representative ID:', representativeId);
        }
      } else {
        console.warn('⚠️ No UID provided in webhook - delivery notification cannot be sent');
      }

      // Call the delivery notification function
      try {
        console.log('Triggering delivery notification email...');
        
        const deliveryResult = await supabase.functions.invoke('send-delivery-notification', {
          body: {
            postcardId,
            recipientName: recipient_name,
            recipientAddress: `${recipient_address_one}, ${recipient_city}, ${recipient_state}`,
            senderName: sender_name,
            senderAddress: sender_address_one,
            senderCity: sender_city,
            senderState: sender_state,
            message,
            sentAt: sent_at,
            userEmail,
            recipientType,
            representativeId,
            uid
          }
        });

        if (deliveryResult.error) {
          console.error('Error calling delivery notification function:', deliveryResult.error);
        } else {
          console.log('Delivery notification result:', deliveryResult.data);
        }
      } catch (emailError) {
        console.error('Failed to send delivery notification:', emailError);
      }
    } else {
      console.log('ℹ️ Webhook received but no sent_at timestamp - not a delivery notification');
    }

    console.log('=== Webhook Processing Complete ===');

    // Return success response to IgnitePost
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook received and processed',
        postcard_id: postcardId 
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to process webhook',
        message: error.message
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});