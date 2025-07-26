import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const COMBINATIONS_FILE = "data/combinations-2025-07-22T00-28-27-920Z.txt";
const OUTPUT_DIR = "generated-images";
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay to avoid rate limiting
const OFFSET_PROMPTS = 64; // Set to skip the first N prompts (useful for resuming generation)
const LIMIT_PROMPTS = 10; // Set to null or 0 to process all prompts, or a number to limit for testing

// Function to create output directory
function ensureOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

// Function to create filename from slot indices
function createFilenameFromIndices(promptIndex) {
  // Calculate slot indices from the prompt's position (0-based)
  // Each slot has 6 options (0-5), combinations are generated in nested loop order
  const i = Math.floor(promptIndex / 36); // first slot index (6*6=36)
  const j = Math.floor(promptIndex / 6) % 6; // second slot index
  const k = promptIndex % 6; // third slot index

  return `${i}-${j}-${k}.png`;
}

// Function to generate image for a single prompt
async function generateImage(prompt, index, total, zeroBasedIndex) {
  try {
    console.log(
      `🎨 [${index}/${total}] Generating image for: "${prompt.substring(
        0,
        80
      )}${prompt.length > 80 ? "..." : ""}"`
    );

    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1792x1024",
      quality: "hd",
      response_format: "b64_json"
    });

    // Save the image to a file
    const image_base64 = result.data[0].b64_json;
    const image_bytes = Buffer.from(image_base64, "base64");
    const filename = createFilenameFromIndices(zeroBasedIndex); // Convert to 0-based index
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, image_bytes);
    console.log(`✅ [${index}/${total}] Saved: ${filename}`);

    return { success: true, filename, prompt };
  } catch (error) {
    console.error(
      `❌ [${index}/${total}] Error generating image for prompt: "${prompt.substring(
        0,
        50
      )}..."`,
      error.message
    );
    return { success: false, error: error.message, prompt };
  }
}

// Function to add delay between requests
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main execution function
async function main() {
  console.log("🚀 Starting image generation process...");

  try {
    // Check if combinations file exists
    if (!fs.existsSync(COMBINATIONS_FILE)) {
      throw new Error(`Combinations file not found: ${COMBINATIONS_FILE}`);
    }

    // Create output directory
    ensureOutputDirectory();

    // Read all combinations from file
    const fileContent = fs.readFileSync(COMBINATIONS_FILE, "utf-8");
    let prompts = fileContent
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    const totalPrompts = prompts.length;

    // Skip the first OFFSET_PROMPTS prompts
    prompts = prompts.slice(OFFSET_PROMPTS);
    if (OFFSET_PROMPTS > 0) {
      console.log(
        `⏭️  Skipped first ${OFFSET_PROMPTS} prompts (resuming from prompt ${
          OFFSET_PROMPTS + 1
        })`
      );
    }

    // Limit prompts if specified
    if (LIMIT_PROMPTS && LIMIT_PROMPTS > 0) {
      prompts = prompts.slice(0, LIMIT_PROMPTS);
      console.log(`🔧 Limited to ${LIMIT_PROMPTS} prompts for testing`);
    }

    console.log(
      `📊 Processing ${prompts.length} prompts (${OFFSET_PROMPTS + 1}-${
        OFFSET_PROMPTS + prompts.length
      } of ${totalPrompts} total)`
    );
    console.log(
      `⏱️  Estimated time: ~${Math.ceil(
        (prompts.length * DELAY_BETWEEN_REQUESTS) / 1000 / 60
      )} minutes`
    );

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each prompt
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i].trim();
      if (!prompt) continue;

      const actualIndex = OFFSET_PROMPTS + i + 1; // 1-based index for display
      const zeroBasedIndex = OFFSET_PROMPTS + i; // 0-based index for filename generation

      const result = await generateImage(
        prompt,
        actualIndex,
        totalPrompts,
        zeroBasedIndex
      );
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Add delay between requests (except for the last one)
      if (i < prompts.length - 1) {
        console.log(
          `⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s before next request...`
        );
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    }

    // Generate summary report
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      totalPromptsInFile: totalPrompts,
      offsetUsed: OFFSET_PROMPTS,
      promptsProcessed: prompts.length,
      rangeProcessed: `${OFFSET_PROMPTS + 1}-${
        OFFSET_PROMPTS + prompts.length
      }`,
      successful: successCount,
      failed: errorCount,
      isTestRun: LIMIT_PROMPTS && LIMIT_PROMPTS > 0,
      testLimit: LIMIT_PROMPTS || null,
      results: results
    };

    const reportFilename = `data/generation-report-${timestamp.replace(
      /[:.]/g,
      "-"
    )}.json`;
    fs.writeFileSync(reportFilename, JSON.stringify(report, null, 2));

    console.log("\n🎉 Image generation complete!");
    console.log(
      `📈 Summary: ${successCount} successful, ${errorCount} failed out of ${prompts.length} processed`
    );
    if (OFFSET_PROMPTS > 0) {
      console.log(
        `📍 Range processed: prompts ${OFFSET_PROMPTS + 1}-${
          OFFSET_PROMPTS + prompts.length
        } of ${totalPrompts} total`
      );
    }
    console.log(`📄 Report saved: ${reportFilename}`);
    console.log(`📁 Images saved in: ${OUTPUT_DIR}/`);
  } catch (error) {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
