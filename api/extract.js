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

Rules:
- "level" is an integer representing this trim's position in the lineup for THIS model only. Use 1 for the base/entry trim, 2 for the next step up, 3 for the next, and so on. Do not assume level based on name alone — read the sticker carefully to determine where this trim sits.
- "horsepower" and "towing_capacity" are integers only. towing_capacity in lbs (e.g. 1500 not "1,500 lbs").
- "mpg_city" and "mpg_hwy" are integers.
- "year" is a string.
- "features" must contain ONLY the standard features listed on THIS sticker for THIS specific trim. Do NOT add features from other trim levels. Do NOT add features you assume the vehicle has. Only what is explicitly listed on this sticker.
- Extract ALL features listed. Do not omit any. Categorize each as: Safety & Security, Interior, Exterior, or Engine & Mechanical.
- "packages" must contain ALL optional packages listed under the "Packages:" section of the sticker. Each package has a name and its listed features. Extract all of them exactly as listed.
- "colors" should always be an empty array — colors are managed separately.
- If a field is unknown, use null for numbers and empty string for text.`
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
