import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    try {
      const response = await axios.get(
        `https://api.tts.quest/v3/voicevox/synthesis?text=${encodeURIComponent(text)}&speaker=21`,
        {
          responseType: 'arraybuffer',
        }
      );

      res.setHeader('Content-Type', 'audio/wav');
      res.status(200).send(response.data);
    } catch (error) {
      console.error('Error with VOICEVOX API:', error);
      res.status(500).json({ error: 'Error generating speech' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
