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

Here are the trim levels sorted from lowest to highest, each assigned a level number:
${trims.map((t, i) => `Level ${i + 1}: ${t.name}\nFeatures: ${t.features.join(', ')}`).join('\n\n')}

Return ONLY a valid JSON array with NO markdown, NO backticks, NO explanation.

The array should contain 10-16 rows showing the most meaningful differences between trim levels that car buyers actually care about.

EXCLUDE these — they are standard on all Mazdas and not useful for comparison:
- Basic safety: airbags, safety belts, ABS, stability control, traction control, tire pressure monitoring
- Standard connectivity: Bluetooth, USB ports, AM/FM radio, Apple CarPlay, Android Auto
- Basic convenience: push button start, keyless entry, power windows, power locks
- Warranty items and legal disclosures

INCLUDE features that genuinely differ and help buyers decide which trim to choose:
- Seat materials and comfort (cloth vs leatherette vs leather, heated, ventilated, memory, power adjustment)
- Audio system upgrades (Bose, premium speakers, SiriusXM)
- Sunroof / moonroof
- Wheel size and type upgrades
- Advanced driver assistance (parking sensors, adaptive cruise, traffic sign recognition, blind spot, rear cross traffic)
- Power liftgate, heated steering wheel, heated rear seats
- Display size upgrades, heads-up display
- Special exterior features (roof rails, exhaust finish, lighting upgrades)

Return format — use level NUMBERS not trim names to avoid matching errors:
[
  {
    "feature": "Feature name in plain customer-friendly language",
    "levels": [1, 2, 3]
  }
]

"levels" is an array of level numbers (1, 2, 3, etc.) that HAVE this feature. Only include levels that actually have the feature based on the feature lists provided. Be accurate.`
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
