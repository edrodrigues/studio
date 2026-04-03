'use server';

import { z } from 'genkit';
import { batchUpdateDocument } from '@/lib/google-docs';

const GenerateContractInDocsInputSchema = z.object({
  accessToken: z.string(),
  documentId: z.string(),
  placeholderValues: z.record(z.string()),
  placeholderMatches: z.record(z.array(z.string())),
  projectId: z.string().optional(),
});

export type GenerateContractInDocsInput = z.infer<typeof GenerateContractInDocsInputSchema>;

const GenerateContractInDocsOutputSchema = z.object({
  success: z.boolean(),
  documentLink: z.string(),
  replacementsApplied: z.number(),
});

export type GenerateContractInDocsOutput = z.infer<typeof GenerateContractInDocsOutputSchema>;

function buildReplacementRequests(
  placeholderValues: Record<string, string>,
  placeholderMatches: Record<string, string[]>
) {
  const requests: any[] = [];

  for (const [placeholderKey, replacement] of Object.entries(placeholderValues)) {
    const trimmedReplacement = replacement.trim();
    if (!trimmedReplacement) {
      continue;
    }

    const exactMatches = placeholderMatches[placeholderKey] || [];
    const generatedMatches = [
      ...exactMatches,
      `<<${placeholderKey}>>`,
      `{{${placeholderKey}}}`,
      `[[${placeholderKey}]]`,
      `<${placeholderKey}>`,
    ];

    const uniqueMatches = Array.from(
      new Set(generatedMatches.map((match) => match.trim()).filter(Boolean))
    );

    for (const match of uniqueMatches) {
      requests.push({
        replaceAllText: {
          replaceText: trimmedReplacement,
          containsText: {
            text: match,
            matchCase: false,
          },
        },
      });
    }
  }

  return requests;
}

export async function generateContractInDocs(
  input: GenerateContractInDocsInput
): Promise<GenerateContractInDocsOutput> {
  try {
    const requests = buildReplacementRequests(input.placeholderValues, input.placeholderMatches);

    if (requests.length > 0) {
      await batchUpdateDocument(input.accessToken, input.documentId, requests);
    }

    return {
      success: true,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      replacementsApplied: requests.length,
    };
  } catch (error: any) {
    console.error('Error in generateContractInDocs:', error);
    throw new Error(error.message || 'Falha no preenchimento determinístico do Google Docs');
  }
}
