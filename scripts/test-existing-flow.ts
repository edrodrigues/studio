
import 'dotenv/config';
import path from 'path';
import { getAssistanceFromGemini } from '../src/ai/flows/get-assistance-from-gemini';

async function main() {
    try {
        console.log('Testing existing Gemini flow...');
        const result = await getAssistanceFromGemini({
            query: 'Oi',
            contractContent: 'Contrato de teste',
        });
        console.log('Success! Result:', result);
    } catch (error: any) {
        console.error('Error during diagnostic:', error);
    }
}

main();
