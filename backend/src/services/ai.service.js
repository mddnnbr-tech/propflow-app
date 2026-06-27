const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function imageToBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return data.toString('base64');
}

function getMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return map[ext] || 'image/jpeg';
}

// ─── Classify a maintenance photo ────────────────────────────────────────────
async function classifyMaintenancePhoto(imagePath, description = '') {
  const base64 = imageToBase64(imagePath);
  const mediaType = getMediaType(imagePath);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are a property maintenance classifier. Analyze this maintenance issue photo${description ? ` with description: "${description}"` : ''}.

Return a JSON object with these fields:
- trade: The specific trade needed. Use exactly one of: "Plumbing", "Electrical", "HVAC", "Appliance Repair", "Carpentry", "Painting", "Roofing", "General Maintenance", "Pest Control", "Locksmith", "Flooring"
- category: A short category label (e.g., "Leaking Faucet", "Broken Outlet", "AC Not Cooling")
- summary: 1-2 sentence description of the issue and what work is needed
- priority: One of: "LOW", "NORMAL", "HIGH", "EMERGENCY" — use EMERGENCY only for active water leaks, gas smells, no heat in winter, security issues
- confidence: Number 0-1 for your confidence in the trade classification

Return only the JSON object, no markdown.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

// ─── Read a check image (front + back) ────────────────────────────────────────
async function readCheck(frontPath, backPath) {
  const frontBase64 = imageToBase64(frontPath);
  const backBase64 = imageToBase64(backPath);
  const frontType = getMediaType(frontPath);
  const backType = getMediaType(backPath);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Front of check:' },
          { type: 'image', source: { type: 'base64', media_type: frontType, data: frontBase64 } },
          { type: 'text', text: 'Back of check (endorsement side):' },
          { type: 'image', source: { type: 'base64', media_type: backType, data: backBase64 } },
          {
            type: 'text',
            text: `Extract information from these check images and return a JSON object with:
- payee: Name the check is written to
- payer: Name on the check (account holder)
- amount: Numeric amount (e.g., 1250.00) — use the written amount if numeric is unclear
- amountText: Written amount in words
- date: Date on check (ISO format if possible)
- routingNumber: 9-digit routing number from MICR line (bottom of check)
- accountNumber: Account number from MICR line
- checkNumber: Check number
- memo: Memo line text if any
- endorsed: Boolean — is the back endorsed with a signature

Return only the JSON object, no markdown. Use null for any fields you cannot read.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

// ─── Parse a lease document ────────────────────────────────────────────────────
async function parseLease(filePath) {
  // For image-based leases, use vision. For PDFs, read as text if possible.
  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

  let contentBlock;
  if (isImage) {
    const base64 = imageToBase64(filePath);
    const mediaType = getMediaType(filePath);
    contentBlock = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Extract lease terms from this document image.' },
    ];
  } else {
    // For PDF/doc, read as binary and send as base64 (only works for image PDFs)
    // In production you'd use a PDF-to-text library like pdf-parse
    const base64 = fs.readFileSync(filePath).toString('base64');
    contentBlock = [
      {
        type: 'text',
        text: `I have a lease document (base64 encoded, first 1000 chars): ${base64.substring(0, 1000)}...\n\nPlease extract what you can from the file name and context. For a full PDF parse, integrate pdf-parse library.`,
      },
    ];
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          ...contentBlock,
          {
            type: 'text',
            text: `Extract the following from this lease document and return as JSON:
- tenantNames: Array of tenant names
- landlordName: Landlord/property manager name
- propertyAddress: Full address of the rental unit
- unitNumber: Unit/apartment number
- startDate: Lease start date (ISO format)
- endDate: Lease end date (ISO format)
- rentAmount: Monthly rent amount (number)
- depositAmount: Security deposit amount (number)
- rentDueDay: Day of month rent is due (integer 1-28, e.g. 1 for "due on the 1st")
- lateFee: Late fee amount if specified (number)
- lateFeeGraceDays: Grace period in days before late fee applies (integer)
- petPolicy: Pet policy summary
- utilitiesIncluded: Array of utilities included in rent
- keyTerms: Array of important terms/clauses (max 5)

Return only the JSON object, no markdown. Use null for fields not found.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

// ─── Research property acquisition price and current market value ─────────────
async function researchPropertyValue(address, city, state, zip) {
  const fullAddress = `${address}, ${city}, ${state} ${zip}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `You are a real estate research assistant. Research the current market value and, if available, last sale price for this property: ${fullAddress}

Please search for:
1. Zillow Zestimate or estimate for this address
2. Redfin estimate for this address
3. County assessor / tax assessed value
4. Recent comparable sales (comps) in the neighborhood
5. Any public records showing last sale price and date

After searching, return a JSON object with:
- estimatedValue: Your best estimate of current market value (number in USD, null if cannot determine)
- estimatedValueLow: Low end of value range
- estimatedValueHigh: High end of value range
- confidence: "HIGH", "MEDIUM", or "LOW" based on data quality
- lastSalePrice: Last recorded sale price if found (number, null if not found)
- lastSaleDate: Date of last sale in ISO format (null if not found)
- sources: Array of objects with { source: "Zillow/Redfin/County Assessor/etc", value: number, url: string or null }
- pricePerSqft: Neighborhood average price per sqft if found
- marketTrend: "APPRECIATING", "STABLE", or "DECLINING" based on recent data
- summary: 2-3 sentence plain English summary of findings and confidence level
- searchedAt: Current date/time in ISO format

Return only the JSON object, no markdown.`,
      },
    ],
  });

  // Extract the final text response (after tool use)
  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No response from property research');

  let text = textBlock.text.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  // Extract JSON object if there's preamble text before it
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    text = text.substring(jsonStart, jsonEnd + 1);
  }
  return JSON.parse(text);
}

module.exports = { classifyMaintenancePhoto, readCheck, parseLease, researchPropertyValue };
