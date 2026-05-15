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
  "year": "e.g. 2025",
  "trims": [
    {
      "name": "e.g. 2.5 Hybrid Preferred",
      "level": 1,
      "engine": "e.g. 2.5L 4-cylinder Hybrid",
      "horsepower": 219,
      "transmission": "e.g. e-CVT",
      "drivetrain": "e.g. i-ACTIV AWD",
      "mpg_city": 43,
      "mpg_hwy": 41,
      "towing_capacity": 1500,
      "features": [
        { "category": "Safety & Security", "text": "feature name" },
        { "category": "Interior", "text": "feature name" },
        { "category": "Exterior", "text": "feature name" },
        { "category": "Engine & Mechanical", "text": "feature name" }
      ]
    }
  ],
  "colors": [
    { "name": "e.g. Soul Red Crystal Metallic", "type": "exterior", "hex_code": "#8B1A1A" },
    { "name": "e.g. Black Leatherette", "type": "interior", "hex_code": "#111111" }
  ]
}

Rules:
- "level" is an integer: 1 for base/sport/preferred, 2 for select/touring/premium, 3 for premium plus/signature/grand touring/carbon edition
- "horsepower" and "towing_capacity" are integers, not strings. towing_capacity in lbs as integer (e.g. 1500 not "1,500 lbs")
- "mpg_city" and "mpg_hwy" are integers
- "year" is a string
- Extract ALL standard features listed on the sticker. Do not omit any.
- Include both exterior and interior colors found on the sticker
- hex_code is your best approximation for the color — it does not need to be exact
- If a field is unknown, use null for numbers and empty string for text`
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
