import { config } from 'dotenv';
config();

import '@/ai/flows/generate-contract-from-documents.ts';
import '@/ai/flows/get-assistance-from-gemini.ts';
import '@/ai/flows/extract-template-from-document.ts';
