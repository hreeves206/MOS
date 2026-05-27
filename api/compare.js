export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

const SUPABASE_URL  = 'https://dvznpeelgyebzdublamt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2em5wZWVsZ3llYnpkdWJsYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjEyMjIsImV4cCI6MjA5MzU5NzIyMn0.x4AXUr4PcGkxZUR19T0FhNth1Lo8PsIaeUJxLQiqK9o';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { trims } = req.body;
    if (!trims || !trims.length) {
      return res.status(400).json({ error: 'trims are required' });
    }

    // Load active template rows from Supabase
    const templateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comparison_template?active=eq.true&order=sort_order.asc&select=*`,
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` } }
    );
    const template = await templateRes.json();
    if (!template || !template.length) {
      return res.status(400).json({ error: 'No template rows found' });
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
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `You are checking which Mazda trim levels include specific features for a dealership comparison table.

TRIM LEVELS AND THEIR FEATURES:
${trims.map((t, i) => `Trim ${i + 1}: ${t.name}\nFeatures: ${t.features.join(' | ')}`).join('\n\n')}

TEMPLATE ROWS TO CHECK:
${template.map((row, i) => `${i + 1}. "${row.feature_label}" — look for any of: ${row.search_terms.join(', ')}`).join('\n')}

For each template row, check which trim NUMBERS (1, 2, 3...) include that feature based on their feature list above.
Only mark a trim as having a feature if it is explicitly listed in that trim's features. Do not assume.

Return ONLY a valid JSON array, NO markdown, NO backticks:
[
  {
    "feature": "exact feature_label text",
    "levels": [1, 3]
  }
]

Only include rows where at least one trim has the feature AND at least one trim does NOT (rows that actually differentiate trims). Skip rows where all trims have it or no trims have it.`
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
