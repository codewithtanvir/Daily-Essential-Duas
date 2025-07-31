const express = require('express');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from the root directory

app.post('/api/get-dua', async (req, res) => {
    const { situation } = req.body;

    if (!situation) {
        return res.status(400).json({ error: 'Situation is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const prompt = `Based on the situation: "${situation}", provide a relevant Islamic dua.
    Your response MUST be a single JSON object with five keys: "arabic", "transliteration", "english_translation", "bengali_translation", and "reference".
    The reference should be from a valid Islamic source (e.g., Quran, Bukhari, Muslim, Tirmidhi, Abu Dawud).`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "arabic": { "type": "STRING" },
                    "transliteration": { "type": "STRING" },
                    "english_translation": { "type": "STRING" },
                    "bengali_translation": { "type": "STRING" },
                    "reference": { "type": "STRING" }
                },
                required: ["arabic", "transliteration", "english_translation", "bengali_translation", "reference"]
            }
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        res.status(500).json({ error: 'Failed to fetch dua from Gemini API' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
