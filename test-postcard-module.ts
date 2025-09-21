// Test script to verify postcard module works locally
import { generatePostcardAndSources } from "./postcard_module.ts";

async function testPostcardGeneration() {
  console.log("🧪 Testing postcard generation...");
  
  try {
    const result = await generatePostcardAndSources({
      zipCode: "90210",
      concerns: "healthcare costs",
      personalImpact: "my insulin prescriptions are too expensive"
    });
    
    console.log("✅ Generation successful!");
    console.log("📝 Postcard:", result.postcard);
    console.log("📚 Sources:", result.sources);
    console.log("📏 Character count:", result.postcard.length);
    
    if (result.postcard.length > 290) {
      console.log("⚠️  Warning: Postcard exceeds character limit!");
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

testPostcardGeneration();