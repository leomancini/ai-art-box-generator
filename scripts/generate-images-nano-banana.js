import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { slotOptions } from "../config.js";

dotenv.config();

const ai = new GoogleGenAI({});

// Configuration
const OUTPUT_DIR = "generated-images";
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay to avoid rate limiting
const OFFSET_PROMPTS = 0; // Set to skip the first N prompts (useful for resuming generation)
const LIMIT_PROMPTS = 2; // Set to null or 0 to process all prompts, or a number to limit for testing
const BASE_IMAGES_DIR = path.join(OUTPUT_DIR, "nano-banana", "0-base");
const VARIATIONS_DIR = path.join(OUTPUT_DIR, "nano-banana", "1-styles");
const SUBJECT_VARIATIONS_DIR = path.join(
  OUTPUT_DIR,
  "nano-banana",
  "2-subjects"
);

// Mode flags
const CREATE_BASE_IMAGES = false; // Set to true to create base images
const CREATE_STYLE_VARIATIONS = false; // Set to true to create style variations
const CREATE_SUBJECT_VARIATIONS = true; // Set to true to create subject matter variations

// Specific variations to regenerate (leave empty array to generate all)
// Format: ["baseIndex-styleIndex", "baseIndex-styleIndex", ...]
// Example: ["4-1", "2-3", "0-5"] to regenerate only those specific variations
const REGENERATE_SPECIFIC_STYLE_VARIATIONS = []; // Set to [] to generate all variations

// Specific subject variations to regenerate (leave empty array to generate all)
// Format: ["baseIndex-styleIndex-subjectIndex", "baseIndex-styleIndex-subjectIndex", ...]
// Example: ["4-1-2", "2-3-0", "0-5-4"] to regenerate only those specific subject variations
const REGENERATE_SPECIFIC_SUBJECT_VARIATIONS = []; // Set to [] to generate all variations

// Skip existing subject variations (only generate missing ones)
const SKIP_EXISTING_SUBJECT_VARIATIONS = true; // Set to false to regenerate all (overwrite existing)

// Function to create output directory
function ensureOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }
}

// Function to ensure base images directory exists
function ensureBaseImagesDirectory() {
  if (!fs.existsSync(BASE_IMAGES_DIR)) {
    fs.mkdirSync(BASE_IMAGES_DIR, { recursive: true });
    console.log(`📁 Created base images directory: ${BASE_IMAGES_DIR}`);
  }
}

// Function to create base images using Gemini
async function createBaseImages() {
  console.log("🍌 Starting base nano banana image generation...");

  try {
    // Ensure the base images directory exists
    ensureBaseImagesDirectory();

    const baseScenes = slotOptions[0]; // Use the first array from slotOptions
    let totalImagesGenerated = 0;

    console.log(`📊 Generating base images for ${baseScenes.length} scenes...`);

    for (let i = 0; i < baseScenes.length; i++) {
      const scene = baseScenes[i];
      const prompt = scene;

      console.log(
        `🎨 [${i + 1}/${baseScenes.length}] Generating image for: "${scene}"`
      );

      const response = await ai.models.generateImages({
        model: "imagen-4.0-generate-001",
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "16:9"
        }
      });

      let sceneImageCount = 0;
      for (const generatedImage of response.generatedImages) {
        const imgBytes = generatedImage.image.imageBytes;
        const buffer = Buffer.from(imgBytes, "base64");
        // Create filename with simple sequential numbering
        const filename = `${i}.png`;
        const filepath = path.join(BASE_IMAGES_DIR, filename);

        fs.writeFileSync(filepath, buffer);
        console.log(`✅ Base image saved: ${filepath}`);
        sceneImageCount++;
        totalImagesGenerated++;
      }

      if (sceneImageCount === 0) {
        console.log(`⚠️  No images were generated for scene: "${scene}"`);
      }

      // Add delay between requests to avoid rate limiting
      if (i < baseScenes.length - 1) {
        console.log(
          `⏳ Waiting ${DELAY_BETWEEN_REQUESTS / 1000}s before next request...`
        );
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    }

    if (totalImagesGenerated === 0) {
      console.log("⚠️  No images were generated in total");
    } else {
      console.log(
        `🎉 Successfully generated ${totalImagesGenerated} base image(s) across ${baseScenes.length} scenes`
      );
    }

    return {
      success: true,
      imagesGenerated: totalImagesGenerated,
      scenesProcessed: baseScenes.length
    };
  } catch (error) {
    console.error("❌ Error generating base images:", error.message);
    return { success: false, error: error.message };
  }
}

// Function to ensure variations directory exists
function ensureVariationsDirectory() {
  if (!fs.existsSync(VARIATIONS_DIR)) {
    fs.mkdirSync(VARIATIONS_DIR, { recursive: true });
    console.log(`📁 Created variations directory: ${VARIATIONS_DIR}`);
  }
}

// Function to ensure subject variations directory exists
function ensureSubjectVariationsDirectory() {
  if (!fs.existsSync(SUBJECT_VARIATIONS_DIR)) {
    fs.mkdirSync(SUBJECT_VARIATIONS_DIR, { recursive: true });
    console.log(
      `📁 Created subject variations directory: ${SUBJECT_VARIATIONS_DIR}`
    );
  }
}

// Function to create style variations (using base images + styles)
async function createStyleVariations() {
  console.log("🔄 Starting nano banana style variations generation...");

  try {
    // Ensure the variations directory exists
    ensureVariationsDirectory();

    const baseScenes = slotOptions[0]; // Base scenes (6 items)
    const styles = slotOptions[1]; // Styles (6 items)
    let totalVariationsGenerated = 0;

    // Check if we're regenerating specific variations
    const isRegeneratingSpecific =
      REGENERATE_SPECIFIC_STYLE_VARIATIONS.length > 0;

    if (isRegeneratingSpecific) {
      // Validate the specific variations format
      const validVariations = [];
      for (const variation of REGENERATE_SPECIFIC_STYLE_VARIATIONS) {
        const parts = variation.split("-");
        if (parts.length === 2) {
          const baseIndex = parseInt(parts[0]);
          const styleIndex = parseInt(parts[1]);
          if (
            baseIndex >= 0 &&
            baseIndex < baseScenes.length &&
            styleIndex >= 0 &&
            styleIndex < styles.length
          ) {
            validVariations.push(variation);
          } else {
            console.log(
              `⚠️  Invalid variation indices: ${variation} (base: 0-${
                baseScenes.length - 1
              }, style: 0-${styles.length - 1})`
            );
          }
        } else {
          console.log(
            `⚠️  Invalid variation format: ${variation} (should be "baseIndex-styleIndex")`
          );
        }
      }

      if (validVariations.length === 0) {
        console.log("❌ No valid specific variations found. Exiting...");
        return { success: false, error: "No valid specific variations" };
      }

      console.log(
        `📊 Regenerating specific style variations: ${validVariations.join(
          ", "
        )}`
      );
    } else {
      console.log(
        `📊 Generating variations for ${baseScenes.length} base images × ${
          styles.length
        } styles = ${baseScenes.length * styles.length} variations...`
      );
    }

    // For each base image
    for (let baseIndex = 0; baseIndex < baseScenes.length; baseIndex++) {
      const baseImagePath = path.join(BASE_IMAGES_DIR, `${baseIndex}.png`);

      // Check if base image exists
      if (!fs.existsSync(baseImagePath)) {
        console.log(`⚠️  Base image not found: ${baseImagePath}, skipping...`);
        continue;
      }

      console.log(
        `🖼️  Processing base image ${baseIndex}: "${baseScenes[baseIndex]}"`
      );

      // Read and encode the base image
      const imageData = fs.readFileSync(baseImagePath);
      const base64Image = imageData.toString("base64");

      // For each style
      for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
        const style = styles[styleIndex];
        const variationKey = `${baseIndex}-${styleIndex}`;

        // Check if we should process this specific variation
        if (
          isRegeneratingSpecific &&
          !REGENERATE_SPECIFIC_STYLE_VARIATIONS.includes(variationKey)
        ) {
          continue; // Skip this variation if it's not in the specific list
        }

        console.log(
          `🎨 [${baseIndex}-${styleIndex}] Generating variation in style: "${style}"`
        );

        const prompt = [
          {
            text: `Convert this into the style of ${style}`
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image
            }
          }
        ];

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt
        });

        let variationImageCount = 0;
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            console.log("📝 Generated text:", part.text);
          } else if (part.inlineData) {
            const imageData = part.inlineData.data;
            const buffer = Buffer.from(imageData, "base64");
            // Create filename: baseIndex-styleIndex.png (e.g., 0-0.png, 0-1.png, 1-0.png, etc.)
            const filename = `${baseIndex}-${styleIndex}.png`;
            const filepath = path.join(VARIATIONS_DIR, filename);

            fs.writeFileSync(filepath, buffer);
            console.log(`✅ Variation saved: ${filepath}`);
            variationImageCount++;
            totalVariationsGenerated++;
            break; // Use the first image if multiple are generated
          }
        }

        if (variationImageCount === 0) {
          console.log(
            `⚠️  No variation generated for base ${baseIndex} + style "${style}"`
          );
        }

        // Add delay between requests to avoid rate limiting
        if (
          baseIndex < baseScenes.length - 1 ||
          styleIndex < styles.length - 1
        ) {
          console.log(
            `⏳ Waiting ${
              DELAY_BETWEEN_REQUESTS / 1000
            }s before next request...`
          );
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      }
    }

    if (totalVariationsGenerated === 0) {
      console.log("⚠️  No variations were generated in total");
    } else {
      console.log(
        `🎉 Successfully generated ${totalVariationsGenerated} variation(s)`
      );
    }

    return {
      success: true,
      styleVariationsGenerated: totalVariationsGenerated
    };
  } catch (error) {
    console.error("❌ Error generating style variations:", error.message);
    return { success: false, error: error.message };
  }
}

// Function to create subject matter variations (using style variations + subject matter)
async function createSubjectVariations() {
  console.log(
    "🔄 Starting nano banana subject matter variations generation..."
  );

  try {
    // Ensure the subject variations directory exists
    ensureSubjectVariationsDirectory();

    const baseScenes = slotOptions[0]; // Base scenes (6 items)
    const styles = slotOptions[1]; // Styles (6 items)
    const subjects = slotOptions[2]; // Subject matter/actions (6 items)
    let totalSubjectVariationsGenerated = 0;

    // Check if we're regenerating specific subject variations
    const isRegeneratingSpecificSubjects =
      REGENERATE_SPECIFIC_SUBJECT_VARIATIONS.length > 0;

    if (isRegeneratingSpecificSubjects) {
      // Validate the specific subject variations format
      const validSubjectVariations = [];
      for (const variation of REGENERATE_SPECIFIC_SUBJECT_VARIATIONS) {
        const parts = variation.split("-");
        if (parts.length === 3) {
          const baseIndex = parseInt(parts[0]);
          const styleIndex = parseInt(parts[1]);
          const subjectIndex = parseInt(parts[2]);
          if (
            baseIndex >= 0 &&
            baseIndex < baseScenes.length &&
            styleIndex >= 0 &&
            styleIndex < styles.length &&
            subjectIndex >= 0 &&
            subjectIndex < subjects.length
          ) {
            validSubjectVariations.push(variation);
          } else {
            console.log(
              `⚠️  Invalid subject variation indices: ${variation} (base: 0-${
                baseScenes.length - 1
              }, style: 0-${styles.length - 1}, subject: 0-${
                subjects.length - 1
              })`
            );
          }
        } else {
          console.log(
            `⚠️  Invalid subject variation format: ${variation} (should be "baseIndex-styleIndex-subjectIndex")`
          );
        }
      }

      if (validSubjectVariations.length === 0) {
        console.log(
          "❌ No valid specific subject variations found. Exiting..."
        );
        return {
          success: false,
          error: "No valid specific subject variations"
        };
      }

      console.log(
        `📊 Regenerating specific subject variations: ${validSubjectVariations.join(
          ", "
        )}`
      );
    } else {
      console.log(
        `📊 Generating subject variations for ${baseScenes.length} × ${
          styles.length
        } style variations × ${subjects.length} subjects = ${
          baseScenes.length * styles.length * subjects.length
        } total variations...`
      );

      if (SKIP_EXISTING_SUBJECT_VARIATIONS) {
        console.log(
          "⏭️  Skip mode enabled: Will only generate missing subject variations"
        );
      } else {
        console.log(
          "🔄 Overwrite mode: Will regenerate all subject variations (including existing ones)"
        );
      }
    }

    // For each base image
    for (let baseIndex = 0; baseIndex < baseScenes.length; baseIndex++) {
      // For each style variation of that base image
      for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
        const styleVariationPath = path.join(
          VARIATIONS_DIR,
          `${baseIndex}-${styleIndex}.png`
        );

        // Check if style variation image exists
        if (!fs.existsSync(styleVariationPath)) {
          console.log(
            `⚠️  Style variation not found: ${styleVariationPath}, skipping...`
          );
          continue;
        }

        console.log(
          `🖼️  Processing style variation ${baseIndex}-${styleIndex}: "${baseScenes[baseIndex]}" + "${styles[styleIndex]}"`
        );

        // Read and encode the style variation image
        const imageData = fs.readFileSync(styleVariationPath);
        const base64Image = imageData.toString("base64");

        // For each subject matter
        for (
          let subjectIndex = 0;
          subjectIndex < subjects.length;
          subjectIndex++
        ) {
          const subject = subjects[subjectIndex];
          const subjectVariationKey = `${baseIndex}-${styleIndex}-${subjectIndex}`;

          // Check if we should process this specific subject variation
          if (
            isRegeneratingSpecificSubjects &&
            !REGENERATE_SPECIFIC_SUBJECT_VARIATIONS.includes(
              subjectVariationKey
            )
          ) {
            continue; // Skip this subject variation if it's not in the specific list
          }

          // Check if we should skip existing subject variations
          // Note: If specific variations are requested, always regenerate them regardless of skip flag
          const subjectVariationFilename = `${baseIndex}-${styleIndex}-${subjectIndex}.png`;
          const subjectVariationFilepath = path.join(
            SUBJECT_VARIATIONS_DIR,
            subjectVariationFilename
          );

          if (
            SKIP_EXISTING_SUBJECT_VARIATIONS &&
            !isRegeneratingSpecificSubjects &&
            fs.existsSync(subjectVariationFilepath)
          ) {
            console.log(
              `⏭️  [${baseIndex}-${styleIndex}-${subjectIndex}] Skipping existing subject variation: "${subject}"`
            );
            continue; // Skip this subject variation as it already exists
          }

          // Show different message if we're regenerating a specific variation that already exists
          if (
            isRegeneratingSpecificSubjects &&
            fs.existsSync(subjectVariationFilepath)
          ) {
            console.log(
              `🔄 [${baseIndex}-${styleIndex}-${subjectIndex}] Regenerating specific subject variation: "${subject}"`
            );
          } else {
            console.log(
              `🎨 [${baseIndex}-${styleIndex}-${subjectIndex}] Adding subject matter: "${subject}"`
            );
          }

          const prompt = [
            {
              text: `Make sure there is someone who is ${subject} in this scene`
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image
              }
            }
          ];

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: prompt
          });

          let subjectVariationCount = 0;
          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              console.log("📝 Generated text:", part.text);
            } else if (part.inlineData) {
              const imageData = part.inlineData.data;
              const buffer = Buffer.from(imageData, "base64");
              // Create filename: baseIndex-styleIndex-subjectIndex.png (e.g., 0-0-0.png, 0-0-1.png, etc.)
              const filename = `${baseIndex}-${styleIndex}-${subjectIndex}.png`;
              const filepath = path.join(SUBJECT_VARIATIONS_DIR, filename);

              fs.writeFileSync(filepath, buffer);
              console.log(`✅ Subject variation saved: ${filepath}`);
              subjectVariationCount++;
              totalSubjectVariationsGenerated++;
              break; // Use the first image if multiple are generated
            }
          }

          if (subjectVariationCount === 0) {
            console.log(
              `⚠️  No subject variation generated for ${baseIndex}-${styleIndex} + subject "${subject}"`
            );
          }

          // Add delay between requests to avoid rate limiting
          if (
            baseIndex < baseScenes.length - 1 ||
            styleIndex < styles.length - 1 ||
            subjectIndex < subjects.length - 1
          ) {
            console.log(
              `⏳ Waiting ${
                DELAY_BETWEEN_REQUESTS / 1000
              }s before next request...`
            );
            await delay(DELAY_BETWEEN_REQUESTS);
          }
        }
      }
    }

    if (totalSubjectVariationsGenerated === 0) {
      console.log("⚠️  No subject variations were generated in total");
    } else {
      console.log(
        `🎉 Successfully generated ${totalSubjectVariationsGenerated} subject variation(s)`
      );
    }

    return {
      success: true,
      subjectVariationsGenerated: totalSubjectVariationsGenerated
    };
  } catch (error) {
    console.error("❌ Error generating subject variations:", error.message);
    return { success: false, error: error.message };
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

// Function to generate image using Imagen
async function generateImageImagen(prompt, index, total, zeroBasedIndex) {
  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: "16:9"
    }
  });

  let imageGenerated = false;
  const filename = createFilenameFromIndices(zeroBasedIndex);
  const filepath = path.join(OUTPUT_DIR, filename);

  for (const generatedImage of response.generatedImages) {
    const imgBytes = generatedImage.image.imageBytes;
    const buffer = Buffer.from(imgBytes, "base64");
    fs.writeFileSync(filepath, buffer);
    imageGenerated = true;
    break; // Use the first image if multiple are generated
  }

  if (!imageGenerated) {
    throw new Error("No image data received from Imagen API");
  }

  return { success: true, filename, prompt };
}

// Function to generate image for a single prompt using Imagen
async function generateImage(prompt, index, total, zeroBasedIndex) {
  try {
    console.log(
      `🎨 [${index}/${total}] Generating image (IMAGEN) for: "${prompt.substring(
        0,
        80
      )}${prompt.length > 80 ? "..." : ""}"`
    );

    const result = await generateImageImagen(
      prompt,
      index,
      total,
      zeroBasedIndex
    );

    console.log(`✅ [${index}/${total}] Saved: ${result.filename}`);
    return result;
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
  console.log(
    "🚀 Starting nano banana image generation process using IMAGEN..."
  );

  try {
    // Create output directory
    ensureOutputDirectory();

    // Generate combinations directly from slot options
    let prompts = [];
    for (let i = 0; i < slotOptions[0].length; i++) {
      for (let j = 0; j < slotOptions[1].length; j++) {
        for (let k = 0; k < slotOptions[2].length; k++) {
          prompts.push(
            `${slotOptions[0][i]} in the style of ${slotOptions[1][j]} with a person ${slotOptions[2][k]}`
          );
        }
      }
    }

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
      imageGenerationMode: "imagen",
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

// Run the script based on flags
async function runScript() {
  try {
    if (
      CREATE_BASE_IMAGES &&
      CREATE_STYLE_VARIATIONS &&
      CREATE_SUBJECT_VARIATIONS
    ) {
      console.log(
        "🚀 Running base images, style variations, and subject variations generation..."
      );
      await createBaseImages();
      await createStyleVariations();
      await createSubjectVariations();
    } else if (CREATE_BASE_IMAGES && CREATE_STYLE_VARIATIONS) {
      console.log(
        "🚀 Running both base images and style variations generation..."
      );
      await createBaseImages();
      await createStyleVariations();
    } else if (CREATE_STYLE_VARIATIONS && CREATE_SUBJECT_VARIATIONS) {
      console.log(
        "🚀 Running both style variations and subject variations generation..."
      );
      await createStyleVariations();
      await createSubjectVariations();
    } else if (CREATE_BASE_IMAGES) {
      console.log("🚀 Running base images generation only...");
      await createBaseImages();
    } else if (CREATE_STYLE_VARIATIONS) {
      console.log("🚀 Running style variations generation only...");
      await createStyleVariations();
    } else if (CREATE_SUBJECT_VARIATIONS) {
      console.log("🚀 Running subject variations generation only...");
      await createSubjectVariations();
    } else {
      console.log("🚀 Running main combination generation...");
      await main();
    }
  } catch (error) {
    console.error("💥 Script execution error:", error);
    process.exit(1);
  }
}

runScript();
