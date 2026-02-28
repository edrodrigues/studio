'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getDocumentContent, batchUpdateDocument } from '@/lib/google-docs';

const GenerateContractInDocsInputSchema = z.object({
  accessToken: z.string(),
  documentId: z.string(),
  extractedEntities: z.record(z.any()),
});

export type GenerateContractInDocsInput = z.infer<typeof GenerateContractInDocsInputSchema>;

const GenerateContractInDocsOutputSchema = z.object({
  success: z.boolean(),
  documentLink: z.string(),
  replacementsApplied: z.number(),
});

export type GenerateContractInDocsOutput = z.infer<typeof GenerateContractInDocsOutputSchema>;

/**
 * Prompt to identify text replacements in a document based on extracted entities.
 */
const findReplacementsPrompt = ai.definePrompt({
    name: 'findReplacementsPrompt',
    input: {
        schema: z.object({
            templateContent: z.string(),
            extractedEntities: z.record(z.any()),
        })
    },
    output: {
        schema: z.object({
            replacements: z.array(z.object({
                match: z.string(),
                replacement: z.string(),
            }))
        })
    },
    prompt: `
        Você é um assistente especializado em preenchimento de contratos e documentos jurídicos.
        
        CONTEXTO:
        Você recebeu o conteúdo de texto de um Google Doc que serve como modelo de contrato.
        Você também recebeu um conjunto de entidades extraídas de documentos iniciais (JSON).
        Sua tarefa é identificar quais textos no documento devem ser substituídos pelas informações das entidades.
        
        INSTRUÇÕES:
        1. Procure por placeholders explícitos como {{Nome do Cliente}}, [CPF], [[DATA]], etc.
        2. Identifique termos genéricos entre colchetes ou chaves que correspondem às entidades fornecidas.
        3. Para cada correspondência encontrada, retorne o texto exato a ser procurado ('match') e o valor da entidade correspondente ('replacement').
        
        REGRAS:
        - O 'match' deve ser o texto EXATO que aparece no documento (incluindo chaves, colchetes, etc).
        - O 'replacement' deve ser o valor da entidade, formatado adequadamente (ex: R$ 1.000,00 para moedas, DD/MM/AAAA para datas).
        - Se houver múltiplas ocorrências de um placeholder, o Google Docs API cuidará de todas se usarmos replaceAllText.
        - Seja conservador: só sugira uma substituição se houver alta confiança de que o placeholder corresponde à entidade.
        - Não invente informações. Se uma entidade necessária não estiver presente, ignore o placeholder correspondente.
        
        CONTEÚDO DO DOCUMENTO:
        {{templateContent}}
        
        ENTIDADES EXTRAÍDAS:
        {{json extractedEntities}}
    `
});

/**
 * Flow that orchestrates the Google Doc contract filling process.
 */
const generateContractInDocsFlow = ai.defineFlow(
    {
        name: 'generateContractInDocsFlow',
        inputSchema: GenerateContractInDocsInputSchema,
        outputSchema: GenerateContractInDocsOutputSchema,
    },
    async (input) => {
        // Step 1: Read the document content to provide context to the AI
        // This helps the AI identify actual text patterns and placeholders
        const templateContent = await getDocumentContent(input.accessToken, input.documentId);
        
        // Step 2: Ask AI for replacements
        const { output } = await findReplacementsPrompt({ 
            templateContent, 
            extractedEntities: input.extractedEntities 
        });
        
        if (!output || !output.replacements) {
            throw new Error('AI failed to find any replacements.');
        }
        
        // Step 3: Convert AI replacements to Google Docs batchUpdate requests
        // We use replaceAllText which is the simplest and most robust for placeholder replacement
        const requests = output.replacements.map(r => ({
            replaceAllText: {
                replaceText: r.replacement,
                containsText: {
                    text: r.match,
                    matchCase: false
                }
            }
        }));
        
        // Step 4: Apply updates to the document if any were found
        if (requests.length > 0) {
            await batchUpdateDocument(input.accessToken, input.documentId, requests);
        }
        
        return {
            success: true,
            documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
            replacementsApplied: requests.length,
        };
    }
);

export async function generateContractInDocs(input: GenerateContractInDocsInput): Promise<GenerateContractInDocsOutput> {
    return generateContractInDocsFlow(input);
}
