export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { modelName, trims } = req.body;
    if (!modelName || !trims || !trims.length) {
      return res.status(400).json({ error: 'modelName and trims are required' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are analyzing Mazda ${modelName} trim levels to create a customer-facing comparison table for a dealership website.

Here are the trim levels and their standard features:
${JSON.stringify(trims, null, 2)}

Return ONLY a valid JSON array with NO markdown, NO backticks, NO explanation.

The array should contain 10-16 rows showing the most meaningful differences that car buyers actually care about when choosing a trim level.

EXCLUDE these types of features — they are standard on all Mazdas and customers don't use them to make decisions:
- Basic safety: airbags, safety belts, ABS, stability control, traction control
- Standard connectivity: Bluetooth, USB ports, AM/FM radio
- Basic convenience: push button start, keyless entry, power windows
- Legal/regulatory items: tire pressure monitoring
- Warranty items

INCLUDE features that genuinely differ between trims and that buyers use to make upgrade decisions:
- Seat materials and heating/cooling/memory (leather, ventilated, heated, memory)
- Audio upgrades (Bose, premium speakers, SiriusXM)
- Sunroof/moonroof
- Advanced safety tech (adaptive lighting, parking sensors, traffic sign recognition)
- Wheel/tire upgrades (size, alloy type)
- Driver assistance upgrades (adaptive cruise, lane centering)
- Power/convenience upgrades (power liftgate, folding mirrors, rear wiper)
- Display/tech upgrades (larger screens, heads-up display, navigation)

Return format:
[
  {
    "feature": "Feature name in plain customer-friendly language",
    "trims": ["exact trim name from input that HAS this feature"]
  }
]

"trims" must use the EXACT trim names from the input. Only list trims that actually have the feature based on the feature lists provided. Be accurate — do not assume a higher trim has a feature unless it appears in its feature list.`
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
