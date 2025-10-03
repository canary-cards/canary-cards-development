import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const CreateDraftSchema = z.object({
  action: z.literal('create'),
  zipCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/).optional(),
  concerns: z.string().trim().max(5000).optional(),
  personalImpact: z.string().trim().max(5000).optional()
});

const ApproveDraftSchema = z.object({
  action: z.literal('approve'),
  draftId: z.string().uuid(),
  humanApprovedMessage: z.string().trim().min(10).max(1000)
});

const RequestSchema = z.union([CreateDraftSchema, ApproveDraftSchema]);

serve(async (req): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const body = validation.data;
    const { action } = body;
    
    console.log("=== POSTCARD DRAFT DEBUG ===");
    console.log("Action:", action);
    
    if (action !== 'create' && action !== 'approve') {
      throw new Error("Action must be 'create' or 'approve'");
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (action === 'create') {
      // Create a new draft for "Write it myself" flow
      const { zipCode, concerns, personalImpact } = body;
      
      console.log("Creating new postcard draft");
      console.log("Zip code:", zipCode || "not provided");
      console.log("Concerns:", concerns ? "provided" : "missing");
      console.log("Personal impact:", personalImpact ? "provided" : "missing");

      const { data: newDraft, error: createError } = await supabase
        .from('postcard_drafts')
        .insert({
          zip_code: zipCode || null,
          concerns: concerns || null,
          personal_impact: personalImpact || null,
          // recipient_snapshot and recipient_type will be null initially
          // They can be updated later when recipient data is available
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating postcard draft:", createError);
        throw new Error("Failed to create draft");
      }

      console.log("Successfully created postcard draft:", newDraft.id);
      console.log("=== END POSTCARD DRAFT DEBUG ===");

      return new Response(JSON.stringify({ 
        success: true,
        draftId: newDraft.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === 'approve') {
      // Update existing draft with human approved message
      const { draftId, humanApprovedMessage } = body;

      console.log("Approving existing postcard draft");

      const { data: updatedDraft, error: updateError } = await supabase
        .from('postcard_drafts')
        .update({
          human_approved_message: humanApprovedMessage
        })
        .eq('id', draftId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating postcard draft:", updateError);
        throw new Error("Failed to update draft");
      }

      console.log("Successfully approved postcard draft:", updatedDraft.id);
      console.log("Updated human_approved_message:", updatedDraft.human_approved_message ? "present" : "missing");
      console.log("=== END POSTCARD DRAFT DEBUG ===");

      return new Response(JSON.stringify({ 
        success: true,
        draftId: updatedDraft.id,
        humanApprovedMessage: updatedDraft.human_approved_message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // This shouldn't be reached due to the conditions above
    return new Response(JSON.stringify({ 
      success: false,
      error: "Invalid action" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });

  } catch (error: any) {
    console.error("Postcard draft error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});