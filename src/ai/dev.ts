
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-contract-from-documents.ts';
import '@/ai/flows/get-assistance-from-gemini.ts';
import '@/ai/flows/extract-template-from-document.ts';
import '@/ai/flows/get-document-feedback.ts';
import '@/ai/flows/extract-entities-from-documents.ts';
