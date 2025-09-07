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

    // Parse the webhook payload - this is the actual IgnitePost format
    const webhookData = await req.json();
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
      
      // Try to extract user info from metadata
      let userEmail = null;
      let recipientType = null;
      let representativeId = null;
      
      if (metadata) {
        console.log('Extracting user info from metadata...');
        
        // Try to get user email if stored in metadata
        if (metadata.userEmail) {
          userEmail = metadata.userEmail;
          console.log('User email from metadata:', userEmail);
        } else {
          console.warn('⚠️ No userEmail found in metadata - delivery notification cannot be sent');
        }
        
        // Get recipient type and ID for context
        if (metadata.recipient_type) {
          recipientType = metadata.recipient_type;
          console.log('Recipient type:', recipientType);
        }
        
        if (metadata.representative_id) {
          representativeId = metadata.representative_id;
          console.log('Representative ID:', representativeId);
        }
      } else {
        console.warn('⚠️ No metadata found in webhook payload - delivery notification cannot be sent');
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

  } catch (error) {
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