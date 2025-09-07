import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('IgnitePostAPI Key - Test');
    if (!apiKey) {
      console.error('IgnitePost API key not found');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { postcardData } = await req.json();
    console.log('Received postcard data:', JSON.stringify(postcardData, null, 2));

    if (!postcardData) {
      return new Response(
        JSON.stringify({ error: 'Postcard data required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { userInfo, representative, senators, finalMessage, sendOption } = postcardData;

    // Validate required fields with detailed error messages
    if (!userInfo) {
      console.error('Missing userInfo in postcardData');
      return new Response(
        JSON.stringify({ error: 'User information is required', missingField: 'userInfo' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!userInfo.streetAddress) {
      console.error('Missing streetAddress in userInfo:', userInfo);
      return new Response(
        JSON.stringify({ error: 'Return address is required', missingField: 'userInfo.streetAddress' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!representative) {
      console.error('Missing representative in postcardData');
      return new Response(
        JSON.stringify({ error: 'Representative information is required', missingField: 'representative' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!finalMessage) {
      console.error('Missing finalMessage in postcardData');
      return new Response(
        JSON.stringify({ error: 'Message content is required', missingField: 'finalMessage' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse user's street address into components
    const parseAddress = (fullAddress: string) => {
      // Simple parsing - assuming format: "123 Main St, City, State ZIP"
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
          return { streetAddress, city, state, zip };
        } else {
          // Try to split by space and take last part as zip
          const lastSpaceIndex = stateZipPart.lastIndexOf(' ');
          if (lastSpaceIndex > 0) {
            const state = stateZipPart.substring(0, lastSpaceIndex);
            const zip = stateZipPart.substring(lastSpaceIndex + 1);
            return { streetAddress, city, state, zip };
          }
        }
      }
      // Fallback - use the provided userInfo
      return {
        streetAddress: fullAddress,
        city: userInfo.city || '',
        state: userInfo.state || '',
        zip: userInfo.zipCode || ''
      };
    };

    const senderAddress = parseAddress(userInfo.streetAddress);

    // Function to fetch available letter templates from IgnitePost
    const fetchAvailableTemplates = async () => {
      try {
        console.log('Fetching available letter templates from IgnitePost...');
        const response = await fetch('https://dashboard.ignitepost.com/api/v1/letter_templates', {
          method: 'GET',
          headers: {
            'X-TOKEN': apiKey,
          }
        });

        if (!response.ok) {
          throw new Error(`Template API request failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Template API response:', JSON.stringify(result, null, 2));

        if (Array.isArray(result) && result.length > 0) {
          // API returns templates directly as an array
          const templateIds = result.map(template => template.id.toString());
          console.log('Available template IDs:', templateIds);
          return templateIds;
        } else if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          // Fallback for wrapped response format
          const templateIds = result.data.map(template => template.id.toString());
          console.log('Available template IDs:', templateIds);
          return templateIds;
        } else {
          throw new Error('No templates found in API response');
        }
      } catch (error) {
        console.error('Failed to fetch templates from API:', error);
        return null;
      }
    };

    // Function to select a random template ID
    const selectRandomTemplate = async () => {
      // First try to fetch templates dynamically
      const availableTemplates = await fetchAvailableTemplates();
      
      let templateList;
      if (availableTemplates && availableTemplates.length > 0) {
        templateList = availableTemplates;
        console.log('Using dynamically fetched templates:', templateList);
      } else {
        // Fallback to known template IDs
        templateList = ['10428', '10420'];
        console.log('Using fallback templates:', templateList);
      }

      // Randomly select a template
      const randomIndex = Math.floor(Math.random() * templateList.length);
      const selectedTemplate = templateList[randomIndex];
      console.log(`Selected template ID: ${selectedTemplate} (from ${templateList.length} available templates)`);
      
      return selectedTemplate;
    };

    // Function to create a postcard order
    const createPostcardOrder = async (recipient: any, message: string, recipientType: 'representative' | 'senator', templateId: string) => {
      const recipientName = recipientType === 'representative' 
        ? `Rep. ${recipient.name.split(' ').pop()}` 
        : `Sen. ${recipient.name.split(' ').pop()}`;

      // Use representative address from Geocodio data, or default Senate address for senators
      let recipientAddress;
      if (recipientType === 'representative' && recipient.address) {
        recipientAddress = {
          address_one: recipient.address,
          city: recipient.city,
          state: recipient.state,
          zip: recipient.district ? '20515' : '20510' // House vs Senate default
        };
      } else {
        // Default Senate address for senators without specific addresses
        recipientAddress = {
          address_one: 'U.S. Senate',
          city: 'Washington',
          state: 'DC',
          zip: '20510'
        };
      }

      const orderData = {
        letter_template_id: templateId, // Use selected template instead of hardcoded font/image
        message: message,
        recipient_name: recipientName,
        recipient_address_one: recipientAddress.address_one,
        recipient_city: recipientAddress.city,
        recipient_state: recipientAddress.state,
        recipient_zip: recipientAddress.zip,
        sender_name: userInfo.fullName,
        sender_address_one: senderAddress.streetAddress,
        sender_city: senderAddress.city,
        sender_state: senderAddress.state,
        sender_zip: senderAddress.zip,
        uid: `${Date.now()}-${recipientType}-${recipient.id || 'unknown'}`,
        'metadata[recipient_type]': recipientType,
        'metadata[representative_id]': recipient.id || 'unknown',
        'metadata[template_id]': templateId,
        'metadata[userEmail]': postcardData.email,
        'metadata[uid]': `${Date.now()}-${recipientType}-${recipient.id || 'unknown'}`
      };

      console.log(`Creating ${recipientType} postcard order:`, JSON.stringify(orderData, null, 2));

      const response = await fetch('https://dashboard.ignitepost.com/api/v1/orders', {
        method: 'POST',
        headers: {
          'X-TOKEN': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(orderData).toString()
      });

      const result = await response.json();
      console.log(`${recipientType} order response:`, JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(`Failed to create ${recipientType} postcard: ${JSON.stringify(result)}`);
      }

      return result;
    };

    const results = [];

    // Helper function to replace user placeholders
    const replaceUserPlaceholders = (message: string) => {
      const nameParts = userInfo.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const city = senderAddress.city || userInfo.city || '';
      
      return message
        .replace(/\[First Name\]/g, firstName)
        .replace(/\[Last Name\]/g, lastName)
        .replace(/\[City\]/g, city);
    };

    // Select a random template for all postcards in this batch
    const selectedTemplateId = await selectRandomTemplate();

    // Send to representative
    try {
      // Replace "Dear Rep." pattern with actual rep name, or use original message
      let repMessage = finalMessage.includes('Dear Rep.') 
        ? finalMessage.replace(/Dear Rep\.\s*\w*/g, `Dear Rep. ${representative.name.split(' ').pop()}`)
        : finalMessage.replace(/Rep\.\s+\w+/g, `Rep. ${representative.name.split(' ').pop()}`);
      
      // Replace user placeholders
      repMessage = replaceUserPlaceholders(repMessage);
      
      const repResult = await createPostcardOrder(representative, repMessage, 'representative', selectedTemplateId);
      results.push({
        type: 'representative',
        recipient: representative.name,
        orderId: repResult.id,
        status: 'success'
      });
    } catch (error) {
      console.error('Failed to send representative postcard:', error);
      results.push({
        type: 'representative',
        recipient: representative.name,
        status: 'error',
        error: error.message
      });
    }

    // Send to senators based on sendOption
    if ((sendOption === 'double' || sendOption === 'triple') && senators && senators.length > 0) {
      const senatorsToSend = sendOption === 'double' ? senators.slice(0, 1) : senators;
      console.log(`Sending to ${senatorsToSend.length} senators for ${sendOption} package`);
      for (const senator of senatorsToSend) {
        try {
          // Replace "Dear Rep." with "Dear Sen." for senators, or replace any Rep references with Sen
          let senMessage = finalMessage;
          if (finalMessage.includes('Dear Rep.')) {
            senMessage = finalMessage.replace(/Dear Rep\.\s*\w*/g, `Dear Sen. ${senator.name.split(' ').pop()}`);
          } else {
            senMessage = finalMessage.replace(/Rep\.\s+\w+/g, `Sen. ${senator.name.split(' ').pop()}`);
          }
          
          // Replace user placeholders
          senMessage = replaceUserPlaceholders(senMessage);
          
          const senResult = await createPostcardOrder(senator, senMessage, 'senator', selectedTemplateId);
          results.push({
            type: 'senator',
            recipient: senator.name,
            orderId: senResult.id,
            status: 'success'
          });
        } catch (error) {
          console.error(`Failed to send senator postcard to ${senator.name}:`, error);
          results.push({
            type: 'senator',
            recipient: senator.name,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Postcard sending complete: ${successCount} successful, ${errorCount} failed`);

    // Debug email sending
    console.log('Email sending debug:', {
      successCount,
      hasEmail: !!postcardData.email,
      email: postcardData.email,
      shouldSendEmail: successCount > 0 && postcardData.email
    });

    // Send confirmation email if any postcards succeeded and email is provided
    if (successCount > 0 && postcardData.email) {
      try {
        console.log('Triggering order confirmation email...');
        
        // Calculate amount based on successful postcards only
        const unitPrice = 5.00;
        const amount = successCount === 2 ? 10.00 : successCount >= 3 ? 12.00 : unitPrice;
        
        // Generate order ID
        const orderId = `CC-${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const emailResponse = await fetch('https://xwsgyxlvxntgpochonwe.supabase.co/functions/v1/send-order-confirmation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            userInfo: {
              fullName: userInfo.fullName,
              email: postcardData.email,
              streetAddress: userInfo.streetAddress,
              city: userInfo.city,
              state: userInfo.state,
              zipCode: userInfo.zipCode
            },
            representative,
            senators,
            sendOption,
            orderResults: results.filter(r => r.status === 'success'),
            amount,
            orderId,
            paymentMethod: 'card',
            finalMessage
          })
        });
        
        const emailResult = await emailResponse.json();
        console.log('Email confirmation result:', emailResult);
      } catch (emailError) {
        console.error('Failed to send confirmation email (non-blocking):', emailError);
        // Don't fail the main flow if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        results,
        summary: {
          totalSent: successCount,
          totalFailed: errorCount,
          sendOption,
          total: results.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Postcard sending error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send postcards',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});