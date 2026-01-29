
import 'dotenv/config';
import path from 'path';
import { getPlaybookAssistance } from '../src/ai/flows/get-playbook-assistance';

async function main() {
    try {
        console.log('Testing Playbook Gemini flow...');
        const result = await getPlaybookAssistance({
            query: 'O que é o Playbook?',
            history: [],
        });
        console.log('Success! Result:', result);
    } catch (error: any) {
        console.error('Error during diagnostic:', error);
    }
}

main();
