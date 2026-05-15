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
          content: `You are extracting data from a Mazda window sticker. Here is the text content:\n\n${pdfText}\n\nReturn ONLY a valid JSON object with NO markdown, NO backticks, NO explanation. Extract exactly these fields:

{
  "year": number,
  "model": "e.g. CX-50 Hybrid",
  "trim": "e.g. 2.5 Hybrid Preferred",
  "level": "entry OR mid OR top OR other",
  "vin": "VIN number",
  "engine": "engine description",
  "horsepower": "e.g. 219 Combined Net HP",
  "transmission": "e.g. e-CVT",
  "drivetrain": "e.g. Electric AWD",
  "mpg_city": number,
  "mpg_hwy": number,
  "towing": "e.g. 1,500 lbs",
  "exterior_color": "color name",
  "interior_color": "color and material",
  "package_name": "package name or empty string",
  "package_features": ["feature1", "feature2"],
  "features": {
    "Safety & Security": ["feature1", "feature2"],
    "Interior": ["feature1", "feature2"],
    "Exterior": ["feature1", "feature2"],
    "Engine & Mechanical": ["feature1", "feature2"]
  }
}

For "level": entry=base/preferred/sport, mid=premium/select/touring, top=premium plus/signature/carbon edition/grand touring.
Extract ALL standard features listed. Do not omit any.`
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
