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
          content: `You are extracting data from a Mazda window sticker. Return ONLY valid JSON, NO markdown, NO backticks.

Here is the sticker text:

${pdfText}

Return this exact structure:
{
  "name": "model name e.g. CX-5",
  "year": "e.g. 2026",
  "trims": [
    {
      "name": "trim name e.g. 2.5 S Select AWD",
      "level": 1,
      "engine": "engine description",
      "horsepower": 187,
      "transmission": "e.g. 6-Speed Automatic",
      "drivetrain": "e.g. AWD",
      "mpg_city": 26,
      "mpg_hwy": 31,
      "towing_capacity": 2000,
      "features": [
        {
          "category": "Safety & Security",
          "text": "exact feature text in Title Case",
          "code": "feature_code or null"
        }
      ],
      "packages": [
        {
          "name": "Package name",
          "features": ["Feature 1", "Feature 2"]
        }
      ]
    }
  ],
  "colors": []
}

RULES:

LEVEL: Integer. 1 = base/entry trim for this model, 2 = next step up, etc.

NUMBERS: horsepower and towing_capacity are integers. mpg_city and mpg_hwy are integers. year is a string.

FEATURES: Extract ALL standard features from this sticker. Categorize as: Safety & Security, Interior, Exterior, or Engine & Mechanical. Use clean Title Case text.

FEATURE CODES: For each feature, assign a code from this list if it matches. Use null if no code applies.

DRIVETRAIN CODES (assign based on drivetrain field):
- "drivetrain_fwd" — if Front-Wheel Drive
- "drivetrain_awd" — if All-Wheel Drive, AWD, i-ACTIV AWD, Electric AWD

SEAT MATERIAL CODES (assign to the primary seat material feature):
- "seat_material_cloth" — cloth, fabric seats
- "seat_material_leatherette" — leatherette, synthetic leather, sport leatherette, half leatherette
- "seat_material_leather" — leather-trimmed, genuine leather, full leather, nappa leather

SEAT COMFORT CODES:
- "seats_heated_front" — heated front seats
- "seats_heated_rear" — heated rear seats
- "seats_ventilated_front" — ventilated front seats, cooled front seats
- "seats_memory_driver" — driver seat memory, memory seat
- "seats_power_driver" — power driver seat, 8-way power, 10-way power driver
- "seats_power_passenger" — power passenger seat, 6-way power passenger

STEERING & COMFORT CODES:
- "steering_heated" — heated steering wheel
- "moonroof_panoramic" — panoramic moonroof, power moonroof, sunroof
- "charger_wireless" — wireless phone charger, wireless charging pad
- "liftgate_power" — power rear liftgate, power liftgate
- "mirrors_auto_folding" — auto power folding mirrors, power folding side mirrors

AUDIO & TECH CODES:
- "audio_bose" — Bose audio, Bose speakers
- "audio_siriusxm" — SiriusXM, Sirius XM satellite radio
- "display_active_driving" — active driving display, heads-up display, HUD
- "cameras_360" — 360-degree camera, surround view camera, 360 view

SAFETY CODES:
- "safety_blind_spot" — blind spot monitoring, blind spot information
- "safety_lane_keep" — lane keep assist, lane keeping assist
- "safety_smart_brake" — smart brake support, automatic emergency braking
- "safety_radar_cruise" — radar cruise control, adaptive cruise control with stop & go
- "safety_parking_sensors_front_rear" — front & rear parking sensors, front and rear parking sensors
- "safety_parking_sensors_rear" — rear parking sensors only (not front)

EXTERIOR CODES:
- "lighting_adaptive_front" — adaptive front lighting, AFS
- "roof_rails" — roof rails, roof rack rails

WHEEL SIZE CODES (auto-generate from wheel size on sticker):
- Format: "wheels_NN" where NN is the wheel diameter in inches
- Examples: "wheels_17" for 17-inch, "wheels_19" for 19-inch, "wheels_21" for 21-inch
- Read the wheel size from tire/wheel specs on the sticker

DISPLAY SIZE CODES (auto-generate from display size):
- Format: "display_NN" where NN is screen size in inches (round to nearest whole number)
- Examples: "display_8" for 8.8-inch screen, "display_10" for 10.25-inch screen, "display_12" for 12.3-inch screen

ALSO ADD THE DRIVETRAIN CODE as a feature in the Engine & Mechanical category:
- If AWD: add { "category": "Engine & Mechanical", "text": "All-Wheel Drive (AWD)", "code": "drivetrain_awd" }
- If FWD: add { "category": "Engine & Mechanical", "text": "Front-Wheel Drive (FWD)", "code": "drivetrain_fwd" }

PACKAGES: Extract all packages listed under "Packages:" section. If NO packages section exists, create one package called "[Trim Name] Highlights" with the 6 most impressive customer-facing features (e.g. wireless Apple CarPlay, Bose audio, heated seats, moonroof, parking sensors, advanced safety — NOT basic items like power windows or seatbelts).

colors: always return empty array [].`
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
