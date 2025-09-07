import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, draftId, humanApprovedMessage, zipCode, recipientSnapshot, recipientType, concerns, personalImpact } = body;
    
    console.log("=== POSTCARD DRAFT DEBUG ===");
    console.log("Action:", action);
    console.log("Draft ID:", draftId);
    console.log("Human approved message:", humanApprovedMessage ? "provided" : "missing");
    
    if (!action || (action !== 'create' && action !== 'approve')) {
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
      if (!zipCode || !recipientSnapshot || !recipientType) {
        throw new Error("zipCode, recipientSnapshot, and recipientType are required for creating a draft");
      }

      console.log("Creating new postcard draft");
      console.log("Zip code:", zipCode);
      console.log("Recipient type:", recipientType);
      console.log("Concerns:", concerns ? "provided" : "missing");
      console.log("Personal impact:", personalImpact ? "provided" : "missing");

      const { data: newDraft, error: createError } = await supabase
        .from('postcard_drafts')
        .insert({
          zip_code: zipCode,
          recipient_snapshot: recipientSnapshot,
          recipient_type: recipientType,
          concerns: concerns || null,
          personal_impact: personalImpact || null,
          // Don't set generation_status for manual drafts - only for AI generation
          // Don't set human_approved_message until user clicks "Continue"
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
        draftId: newDraft.id,
        message: "Draft created successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === 'approve') {
      // Update existing draft with human approved message
      if (!draftId || !humanApprovedMessage) {
        throw new Error("Draft ID and human approved message are required for approval");
      }

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
        humanApprovedMessage: updatedDraft.human_approved_message,
        message: "Draft approved successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
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