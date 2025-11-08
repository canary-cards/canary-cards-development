import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const UserInfoSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  streetAddress: z.string().trim().min(5).max(200),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().max(50).optional(),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/).optional()
});

const RepresentativeSchema = z.object({
  name: z.string().min(1).max(200),
  district: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  id: z.string().optional(),
  address: z.string().max(500).optional(),
  contact: z.object({
    address: z.string().max(500).optional()
  }).optional()
});

const PostcardDataSchema = z.object({
  userInfo: UserInfoSchema,
  representative: RepresentativeSchema,
  senators: z.array(RepresentativeSchema).optional(),
  finalMessage: z.string().trim().min(10).max(1000),
  sendOption: z.enum(['single', 'double', 'triple']),
  email: z.string().trim().email().max(255)
});

const RequestSchema = z.object({
  postcardData: PostcardDataSchema,
  orderId: z.string().uuid(),
  simulateFailure: z.number().int().min(0).max(1).optional(),
  simulatedFailed: z.number().int().min(0).max(10).optional(),
  frontendUrl: z.string().url().optional()
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('IGNITE_POST');
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

    // Parse and validate request body
    const rawBody = await req.json();
    const validation = RequestSchema.safeParse(rawBody);
    
    if (!validation.success) {
      console.error('Input validation failed:', validation.error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data',
          details: validation.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { postcardData, orderId, simulateFailure, simulatedFailed, frontendUrl } = validation.data;
    
    // Check environment and origin to enable simulation - only in non-production
    const environment = Deno.env.get('ENVIRONMENT') || 'development';
    const origin = req.headers.get('origin') || '';
    const isLovableDomain = origin.includes('.lovable.app') || origin.includes('lovable.app');
    
    // Block simulation in production
    if (environment === 'production' && (simulateFailure || simulatedFailed)) {
      console.error('Simulation parameters not allowed in production');
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const shouldSimulateFailure = isLovableDomain && simulateFailure === 1 && simulatedFailed && simulatedFailed > 0;
    
    console.log('Simulation check:', {
      origin,
      isLovableDomain,
      simulateFailure,
      simulatedFailed,
      shouldSimulateFailure
    });
    console.log('Received postcard data:', JSON.stringify(postcardData, null, 2));

    if (!postcardData || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Postcard data and order ID required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { userInfo, representative, senators, finalMessage, sendOption } = postcardData;
    const userEmail = postcardData.email; // Extract email to avoid variable shadowing issues

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

    // Function to select a random template ID from hardcoded list
    const selectRandomTemplate = () => {
      // Use only the two active templates as requested
      const templateList = ['10420', '10428'];
      console.log('Using hardcoded template list:', templateList);

      // Randomly select a template
      const randomIndex = Math.floor(Math.random() * templateList.length);
      const selectedTemplate = templateList[randomIndex];
      console.log(`Selected template ID: ${selectedTemplate} (from ${templateList.length} available templates)`);
      
      return selectedTemplate;
    };

    // Function to select a random font key
    const selectRandomFont = () => {
      const approvedFonts = ['tracy', 'becca', 'dunn', 'kletzien', 'pea', 'sarah'];
      const randomIndex = Math.floor(Math.random() * approvedFonts.length);
      const selectedFont = approvedFonts[randomIndex];
      console.log(`Selected font: ${selectedFont} (from ${approvedFonts.length} approved fonts)`);
      return selectedFont;
    };

    // Helper to strip greeting from message (IgnitePost templates handle greetings)
    const stripGreeting = (message: string): string => {
      const greetingPattern = /^(?:Dear\s+)?(Rep|Sen)\.\s+\w+,?\s*\n?/i;
      return message.replace(greetingPattern, '').trim();
    };

    // Simple helper to derive office address - use exact contact.address with standardized city/state
    const deriveOfficeAddress = (recipient: any, recipientType: 'representative' | 'senator') => {
      console.log(`Deriving address for ${recipientType}:`, recipient);
      
      const contactAddress = recipient.address || recipient.contact?.address;
      
      if (contactAddress && typeof contactAddress === 'string') {
        console.log(`Using contact address: ${contactAddress}`);
        
        // Extract ZIP code from the address string if present
        const zipMatch = contactAddress.match(/(\d{5}(?:-\d{4})?)/);
        const zip = zipMatch ? zipMatch[1] : (recipientType === 'representative' ? '20515' : '20510');
        
        return {
          address_one: contactAddress,
          city: 'Washington',
          state: 'DC',
          zip: zip
        };
      }
      
      console.log(`No contact address found for ${recipientType}, using default`);
      
      // Default fallback
      return {
        address_one: recipientType === 'representative' ? '2157 Rayburn House Office Building' : 'U.S. Senate',
        city: 'Washington',
        state: 'DC',
        zip: recipientType === 'representative' ? '20515' : '20510'
      };
    };

    // Function to create a postcard order
    const createPostcardOrder = async (recipient: any, message: string, recipientType: 'representative' | 'senator', templateId: string, fontKey: string, shouldFailOrder: boolean = false) => {
      const recipientName = recipientType === 'representative' 
        ? `Rep. ${recipient.name.split(' ').pop()}` 
        : `Sen. ${recipient.name.split(' ').pop()}`;

      // Get recipient address using the helper function
      const recipientAddress = deriveOfficeAddress(recipient, recipientType);

      // First, create postcard record in database to get the postcard ID
      const postcardRecord = {
        order_id: orderId,
        recipient_type: recipientType,
        recipient_snapshot: recipient,
        recipient_name: recipientName,
        recipient_title: recipientType === 'representative' ? 'Representative' : 'Senator',
        recipient_office_address: recipientAddress.address_one,
        recipient_district_info: recipient.district || `${recipient.state} ${recipientType}`,
        message_text: message,
        ignitepost_template_id: templateId,
        handwriting_font_key: fontKey,
        sender_snapshot: {
          fullName: userInfo.fullName,
          streetAddress: senderAddress.streetAddress,
          city: senderAddress.city,
          state: senderAddress.state,
          zipCode: senderAddress.zip
        },
        delivery_status: 'failed' // Will be updated on successful IgnitePost submission
      };

      const { data: insertedPostcard, error: postcardError } = await supabase
        .from('postcards')
        .insert(postcardRecord)
        .select()
        .single();

      if (postcardError) {
        console.error('Error creating postcard record:', postcardError);
        throw new Error(`Failed to create postcard record: ${postcardError.message}`);
      }

      const postcardId = insertedPostcard.id;
      console.log(`Created postcard record with ID: ${postcardId}`);

      // Now use the postcard ID as the UID for IgnitePost
      const orderData = {
        letter_template_id: templateId,
        font: fontKey,
        message: stripGreeting(message),
        // Only include image parameter if not simulating failure
        ...(shouldFailOrder ? {} : { image: 'white' }), // Remove image parameter for failure simulation
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
        uid: postcardId, // Use postcard ID instead of order ID
        'metadata[recipient_type]': recipientType,
        'metadata[representative_id]': recipient.id || 'unknown',
        'metadata[template_id]': templateId,
        'metadata[font_key]': fontKey,
        'metadata[order_id]': orderId,
        'metadata[postcard_id]': postcardId
      };

      console.log(`Creating ${recipientType} postcard order${shouldFailOrder ? ' (SIMULATING FAILURE)' : ''} with UID ${postcardId}`);
      console.log(`Original message: ${message.substring(0, 100)}...`);
      console.log(`Stripped message: ${orderData.message.substring(0, 100)}...`);
      console.log(`Full order data:`, JSON.stringify(orderData, null, 2));

      let ignitepostResult = null;
      let deliveryStatus = 'failed';
      let ignitepostError = null;

      try {
        const response = await fetch('https://dashboard.ignitepost.com/api/v1/orders', {
          method: 'POST',
          headers: {
            'X-TOKEN': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(orderData).toString()
        });

        ignitepostResult = await response.json();
        console.log(`${recipientType} order response:`, JSON.stringify(ignitepostResult, null, 2));

        if (!response.ok) {
          ignitepostError = `IgnitePost API error: ${JSON.stringify(ignitepostResult)}`;
          throw new Error(ignitepostError);
        } else {
          deliveryStatus = 'submitted';
        }
      } catch (error) {
        ignitepostError = (error as any).message;
        console.error(`Failed to create ${recipientType} postcard:`, error);
      }

      // Update postcard record with IgnitePost response
      const updateData: any = {
        delivery_status: deliveryStatus,
        ignitepost_error: ignitepostError
      };

      if (ignitepostResult) {
        updateData.ignitepost_order_id = ignitepostResult.id;
        updateData.ignitepost_send_on = ignitepostResult.send_on;
        updateData.ignitepost_created_at = ignitepostResult.created_at ? new Date(ignitepostResult.created_at).toISOString() : null;
      }

      const { error: updateError } = await supabase
        .from('postcards')
        .update(updateData)
        .eq('id', postcardId);

      if (updateError) {
        console.error('Error updating postcard record:', updateError);
      }

      if (deliveryStatus === 'failed') {
        throw new Error(ignitepostError);
      }

      return { 
        ...ignitepostResult, 
        postcard_id: postcardId,
        delivery_status: deliveryStatus 
      };
    };

    const results = [];
    let failureCounter = 0; // Track how many failures to simulate

    // Helper function to replace user placeholders
    const replaceUserPlaceholders = (message: string) => {
      const nameParts = userInfo.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const city = senderAddress.city || userInfo.city || '';
      
      return message
        .replace(/\[name\]/g, userInfo.fullName)
        .replace(/\[First Name\]/g, firstName)
        .replace(/\[Last Name\]/g, lastName)
        .replace(/\[City\]/g, city);
    };

    // Select a random template and font for all postcards in this batch
    const selectedTemplateId = selectRandomTemplate();
    const selectedFontKey = selectRandomFont();

    // Send to representative
    try {
      // Replace "Dear Rep." pattern with actual rep name, or use original message
      let repMessage = finalMessage.includes('Dear Rep.') 
        ? finalMessage.replace(/Dear Rep\.\s*\w*/g, `Dear Rep. ${representative.name.split(' ').pop()}`)
        : finalMessage.replace(/Rep\.\s+\w+/g, `Rep. ${representative.name.split(' ').pop()}`);
      
      // Replace user placeholders
      repMessage = replaceUserPlaceholders(repMessage);
      
      // Determine if this postcard should fail (representative is first, so fails if any failure requested)
      const shouldFailThisOrder = shouldSimulateFailure && failureCounter < simulatedFailed;
      if (shouldFailThisOrder) failureCounter++;
      
      const repResult = await createPostcardOrder(representative, repMessage, 'representative', selectedTemplateId, selectedFontKey, shouldFailThisOrder);
      results.push({
        type: 'representative',
        recipient: representative.name,
        orderId: orderId, // Use database order ID, not IgnitePost ID
        status: 'success'
      });
    } catch (error: any) {
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
          
          // Determine if this postcard should fail (continue failure counter from representative)
          const shouldFailThisOrder = shouldSimulateFailure && failureCounter < simulatedFailed;
          if (shouldFailThisOrder) failureCounter++;
          
          const senResult = await createPostcardOrder(senator, senMessage, 'senator', selectedTemplateId, selectedFontKey, shouldFailThisOrder);
          results.push({
            type: 'senator',
            recipient: senator.name,
            orderId: orderId, // Use database order ID, not IgnitePost ID
            status: 'success'
          });
        } catch (error) {
          console.error(`Failed to send senator postcard to ${senator.name}:`, error);
          results.push({
            type: 'senator',
            recipient: senator.name,
            status: 'error',
            error: (error as any).message
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
      hasEmail: !!userEmail,
      email: userEmail,
      shouldSendEmail: successCount > 0 && userEmail
    });

    // Send confirmation email for all scenarios (success, partial failure, complete failure)
    if (userEmail) {
      try {
        console.log('Triggering order confirmation email for all scenarios...');
        
        // Calculate refund information if there are failures
        let refundInfo = undefined;
        if (errorCount > 0) {
          const unitPrice = 500; // $5.00 in cents
          const totalPrice = results.length === 1 ? 500 : results.length === 2 ? 1000 : 1200;
          let refundAmountCents: number;
          
          if (errorCount === results.length) {
            // All failed - full refund
            refundAmountCents = totalPrice;
          } else {
            // Partial failure - refund per failed postcard
            refundAmountCents = errorCount * unitPrice;
          }
          
          refundInfo = {
            refundAmountCents,
            refundId: 'PENDING', // Will be updated when actual refund is processed
            totalAmountCents: totalPrice
          };
        }
        
        // Extract actual mailing date from first successful postcard
        let actualMailingDate = null;
        const successfulResults = results.filter(r => r.status === 'success');
        if (successfulResults.length > 0) {
          try {
            // Query the database for the actual mailing date from any successful postcard
            const { data: postcardData, error: postcardError } = await supabase
              .from('postcards')
              .select('ignitepost_send_on')
              .eq('order_id', orderId)
              .eq('delivery_status', 'submitted')
              .limit(1)
              .single();
            
            if (!postcardError && postcardData?.ignitepost_send_on) {
              actualMailingDate = postcardData.ignitepost_send_on;
              console.log('Using actual IgnitePost mailing date for email:', actualMailingDate);
            } else {
              console.log('No IgnitePost mailing date available for email, will use fallback');
            }
          } catch (error) {
            console.error('Error fetching mailing date for email:', error);
          }
        }
        
        const { data: emailResult, error: emailInvokeError } = await supabase.functions.invoke('send-order-confirmation', {
          body: {
            userInfo: {
              fullName: userInfo.fullName,
              email: userEmail,
              streetAddress: userInfo.streetAddress,
              city: userInfo.city,
              state: userInfo.state,
              zipCode: userInfo.zipCode
            },
            representative,
            senators,
            sendOption,
            orderResults: results.map(r => ({
              type: r.type,
              recipient: r.recipient,
              orderId: r.status === 'success' ? orderId : undefined, // Only include orderId for successful ones
              status: r.status,
              error: r.error
            })),
            finalMessage,
            actualMailingDate: actualMailingDate,
            refundInfo: refundInfo,
            summary: {
              totalSent: successCount,
              totalFailed: errorCount,
              total: results.length
            },
            frontendUrl
          }
        });
        
        if (emailInvokeError) {
          console.error('Email function invocation error:', emailInvokeError);
        } else {
          console.log('Email confirmation result:', emailResult);
        }
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
        details: (error as any).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});