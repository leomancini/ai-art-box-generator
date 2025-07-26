import fs from "fs";
import path from "path";

// Define the options for each slot
const slotOptions = [
  [
    "People on a crowded subway",
    "Sunset over a city skyline",
    "Desert gas station at night",
    "Ice cream truck in a snowstorm",
    "People eating at a diner",
    "Lighthouse on a foggy cliff"
  ],
  [
    "vintage American travel brochure",
    "Afro-futuristic computer rendering",
    "French impressionist painting",
    "traditional Chinese painting",
    "space-age NASA poster",
    "film noir cinematography"
  ],
  [
    "reading a book",
    "washing dishes at a window",
    "gardening in their backyard",
    "picking apples from a tree",
    "petting their cat at home",
    "riding a bicycle"
  ]
];

// Function to generate all combinations
function generateCombinations(options) {
  const combinations = [];

  for (let i = 0; i < options[0].length; i++) {
    for (let j = 0; j < options[1].length; j++) {
      for (let k = 0; k < options[2].length; k++) {
        combinations.push(
          `${options[0][i]} in the style of ${options[1][j]} with a person ${options[2][k]}`
        );
      }
    }
  }

  return combinations;
}

// Main execution
console.log("Generating combinations...");

try {
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "../data/");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("📁 Created data directory");
  }

  // Generate all combinations
  const combinations = generateCombinations(slotOptions);

  // Create the content for the txt file
  const fileContent = [...combinations].join("\n");

  // Create filename with timestamp and save to data folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `combinations-${timestamp}.txt`;
  const filepath = path.join(dataDir, filename);

  // Write the file
  fs.writeFileSync(filepath, fileContent);

  console.log(`✅ Successfully generated ${combinations.length} combinations!`);
  console.log(`📄 File saved as: ${filename}`);
  console.log(`📍 Location: ${filepath}`);
} catch (error) {
  console.error("❌ Error generating combinations:", error);
  process.exit(1);
}
