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
    const { draftId, humanApprovedMessage } = await req.json();
    
    console.log("=== UPDATE AI DRAFT DEBUG ===");
    console.log("Draft ID:", draftId);
    console.log("Human approved message:", humanApprovedMessage ? "provided" : "missing");
    
    if (!draftId || !humanApprovedMessage) {
      throw new Error("Draft ID and human approved message are required");
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Update the postcard draft with human approved message and approved status
    const { data: updatedDraft, error: updateError } = await supabase
      .from('postcard_drafts')
      .update({
        human_approved_message: humanApprovedMessage,
        generation_status: 'approved'
      })
      .eq('id', draftId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating AI draft:", updateError);
      throw new Error("Failed to update draft");
    }

    console.log("Successfully updated AI draft:", updatedDraft.id);
    console.log("=== END UPDATE AI DRAFT DEBUG ===");

    return new Response(JSON.stringify({ 
      success: true,
      draftId: updatedDraft.id,
      message: "Draft updated successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("AI draft update error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});