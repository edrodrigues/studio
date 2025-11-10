import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      // Removed apiVersion to use the default stable version
    }),
  ],
  model: 'gemini-pro',
});
