export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { pdfText } = req.body;
    if (!pdfText) return res.status(400).json({ error: 'No PDF text provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are extracting data from a Mazda window sticker. Here is the text:\n\n${pdfText}\n\nReturn ONLY a valid JSON object with NO markdown, NO backticks, NO explanation. Use exactly this structure:

{
  "name": "e.g. CX-50 Hybrid",
  "year": "e.g. 2026",
  "trims": [
    {
      "name": "e.g. 2.5 Hybrid Preferred",
      "level": 1,
      "engine": "e.g. 2.5L 4-Cylinder Hybrid Engine",
      "horsepower": 219,
      "transmission": "e.g. e-CVT",
      "drivetrain": "e.g. Electric All-Wheel Drive",
      "mpg_city": 39,
      "mpg_hwy": 37,
      "towing_capacity": 1500,
      "features": [
        { "category": "Safety & Security", "text": "feature name" },
        { "category": "Interior", "text": "feature name" },
        { "category": "Exterior", "text": "feature name" },
        { "category": "Engine & Mechanical", "text": "feature name" }
      ],
      "packages": [
        {
          "name": "e.g. Preferred Package",
          "features": ["Feature 1", "Feature 2", "Feature 3"]
        }
      ]
    }
  ],
  "colors": []
}

RULES:

1. LEVEL: Integer representing this trim's position in the lineup for THIS model only. 1 = base/entry trim, 2 = next step up, etc. Read the sticker carefully.

2. NUMBERS: horsepower and towing_capacity are integers only. towing_capacity in lbs as integer (e.g. 1500). mpg_city and mpg_hwy are integers. year is a string.

3. FEATURES: Extract ONLY the standard features listed on THIS sticker for THIS specific trim. Do NOT add features from other trim levels. Categorize each as: Safety & Security, Interior, Exterior, or Engine & Mechanical.

4. NORMALIZE FEATURE WORDING — always use these exact standard terms regardless of how the sticker words it:
   - Seat materials: use exactly "Cloth Seats", "Leatherette Seats", "Leather-Trimmed Seats", or "Full Leather Seats"
   - Heated seats: use exactly "Heated Front Seats", "Heated Rear Seats"
   - Ventilated seats: use exactly "Ventilated Front Seats"
   - Memory seat: use exactly "Driver Seat Memory"
   - Power seats: use exactly "Power Driver Seat" or "Power Passenger Seat"
   - Wheels: use exactly "17-Inch Alloy Wheels", "18-Inch Alloy Wheels", or "19-Inch Alloy Wheels"
   - Audio: use exactly "Bose Audio System" if Bose is mentioned
   - Moonroof: use exactly "Power Panoramic Moonroof" or "Power Moonroof"
   - Liftgate: use exactly "Power Rear Liftgate"
   - Wireless charging: use exactly "Wireless Phone Charger"
   - Heated steering: use exactly "Heated Steering Wheel"
   - All other features: use clean plain English, title case

5. PACKAGES: Extract ALL optional packages listed under a "Packages:" section. Each has a name and listed features. If NO packages section exists on this sticker, create one package called "[Trim Name] Highlights" and populate it with the 6 most impressive customer-facing standard features from this trim — things that would make a customer say "wow, this comes standard." Choose features like wireless Apple CarPlay, Bose audio, heated seats, moonroof, parking sensors, advanced safety tech — not basic things like power windows or seatbelts.

6. colors should always be an empty array.

7. If a field is unknown use null for numbers and empty string for text.`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Claude API error: ' + err });
    }

    const data = await response.json();
    const text = data.content.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(clean));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
