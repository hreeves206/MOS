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
- "level" is an integer: 1 for base/sport/preferred, 2 for select/touring/premium, 3 for premium plus/signature/grand touring/carbon edition
- "horsepower" and "towing_capacity" are integers, not strings. towing_capacity in lbs as integer (e.g. 1500 not "1,500 lbs")
- "mpg_city" and "mpg_hwy" are integers
- "year" is a string
- Extract ALL standard features listed on the sticker. Do not omit any.
- Extract ALL packages listed under the "Packages:" section of the sticker. Each package has a name and a list of features beneath it. There may be one or several 
— extract all of them.
- Extract ALL packages listed on the sticker under "Packages:" section. Each package should have a name and its listed features. There may be multiple packages on one sticker — extract all of them.
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
