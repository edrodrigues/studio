'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createComposioClient } from '@/lib/composio-client';

// ============================================================
// INPUT / OUTPUT SCHEMAS
// ============================================================

const AIEnrichContractInputSchema = z.object({
  userId: z.string().describe('User ID for Composio session'),
  documentId: z.string().describe('ID of the copied template document to enrich'),
  templateId: z.string().describe('Original template ID (for reference)'),
  placeholders: z
    .array(z.string())
    .describe('List of placeholder names to fill (e.g. ["NOME_DO_REITOR", "VALOR_TOTAL"])'),
  entityData: z
    .record(z.string(), z.any())
    .describe('Extracted entity data from documents (key-value pairs)'),
  context: z
    .string()
    .optional()
    .describe('Free-text context about the contract (project description, etc.)'),
  contractType: z
    .string()
    .optional()
    .describe('Contract type (e.g. "TED", "Contrato de Prestação de Serviços")'),
});

export type AIEnrichContractInput = z.infer<typeof AIEnrichContractInputSchema>;

const SubstitutionSchema = z.object({
  placeholder: z.string().describe('The placeholder name'),
  value: z.string().describe('The AI-inferred value to substitute'),
  source: z.enum(['entity', 'context', 'inferred', 'not_found']).describe('Where the value came from'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
});

const AIEnrichContractOutputSchema = z.object({
  success: z.boolean(),
  documentLink: z.string().describe('URL of the enriched document'),
  substitutions: z
    .array(SubstitutionSchema)
    .describe('List of substitutions applied or attempted'),
  unfilled: z
    .array(z.string())
    .describe('Placeholders that could not be filled (marked with [DADO NÃO ENCONTRADO])'),
  error: z.string().optional(),
});

export type AIEnrichContractOutput = z.infer<typeof AIEnrichContractOutputSchema>;

// ============================================================
// PROMPT
// ============================================================

const enrichContractPrompt = ai.definePrompt({
  name: 'enrichContractPrompt',
  model: 'googleai/gemini-3-flash-preview',
  input: {
    schema: z.object({
      placeholdersList: z.string(),
      entitiesJson: z.string(),
      context: z.string(),
      contractType: z.string(),
    }),
  },
  output: {
    format: 'json',
    schema: z.object({
      substitutions: z.array(
        z.object({
          placeholder: z.string(),
          value: z.string(),
          confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        })
      ),
      reasoning: z.string().optional(),
    }),
  },
  prompt: `Você é um especialista em contratos administrativos brasileiros.

## TAREFA
Given a list of contract placeholders and extracted entity data, infer the correct value for each placeholder from the available data.

## PLACEHOLDERS TO FILL
{{placeholdersList}}

## AVAILABLE ENTITY DATA (from uploaded documents)
{{entitiesJson}}

## CONTRACT CONTEXT
{{context}}

## CONTRACT TYPE
{{contractType}}

## REGRAS DE PREENCHIMENTO

1. **USE ENTITY DATA FIRST**: If an entity key matches or is similar to a placeholder, use that value directly.
2. **INFERR FROM CONTEXT**: If no exact match exists, infer the value from the context description.
3. **LEGAL PRESERVATION**: Do NOT modify legal clauses or boilerplate text — only fill placeholder values.
4. **FORMAT VALUES**: Format dates as they appear in documents, currency values with proper symbols (R$).
5. **WHEN DATA IS MISSING**: If you cannot infer a value, use the marker exactly: [DADO NÃO ENCONTRADO]
6. **CONFIDENCE**: Assign HIGH if you found exact/exact-match evidence, MEDIUM if you inferred from context, LOW if uncertain.

## SINÔNIMOS COMUNS
- "NOME DO PROJETO" ↔ "OBJETO DO CONTRATO" ↔ "DESCRIÇÃO DO OBJETO"
- "VALOR TOTAL" ↔ "MONTANTE" ↔ "VALOR DO CONTRATO"
- "DATA DE INÍCIO" ↔ "DATA DE ASSINATURA" ↔ "DATA DE VIGÊNCIA"
- "REITOR" ↔ "ORDENADOR DE DESPESAS" ↔ "AUTORIDADE COMPETENTE"
- "CPF" ↔ "CNPJ" ↔ "DOCUMENTO DE IDENTIFICAÇÃO"

## OUTPUT FORMAT
Return a JSON object with:
- "substitutions": array of { "placeholder": string, "value": string, "confidence": "HIGH"|"MEDIUM"|"LOW" }
- "reasoning": brief explanation of your filling strategy

Return ONLY valid JSON.`,
});

// ============================================================
// MAIN FUNCTION
// ============================================================

export async function aiEnrichContract(
  input: AIEnrichContractInput
): Promise<AIEnrichContractOutput> {
  return enrichContractFlow(input);
}

// ============================================================
// FLOW
// ============================================================

async function enrichContractFlow(
  input: AIEnrichContractInput
): Promise<AIEnrichContractOutput> {
  const { userId, documentId, placeholders, entityData, context, contractType } = input;

  // Step 1: Call Gemini to infer substitutions
  let substitutionsResult: {
    substitutions: Array<{ placeholder: string; value: string; confidence?: string }>;
    reasoning?: string;
  };

  try {
    const placeholdersList = placeholders.map((p) => `  - ${p}`).join('\n');
    const entitiesJson = JSON.stringify(entityData, null, 2);

    const llmResponse = await enrichContractPrompt({
      placeholdersList,
      entitiesJson,
      context: context || 'Não fornecido',
      contractType: contractType || 'Não especificado',
    });

    const output = llmResponse.output;

    if (!output || !Array.isArray(output.substitutions)) {
      throw new Error('Resposta inválida do modelo de IA');
    }

    substitutionsResult = output as typeof substitutionsResult;
  } catch (error: any) {
    console.error('[ai-enrich-contract] Gemini inference failed:', error);
    return {
      success: false,
      documentLink: `https://docs.google.com/document/d/${documentId}/edit`,
      substitutions: [],
      unfilled: placeholders,
      error: `Erro na inferência de IA: ${error.message}`,
    };
  }

  // Step 2: Build substitution map with source tracking
  const substitutionMap: Record<
    string,
    { value: string; source: 'entity' | 'context' | 'inferred' | 'not_found'; confidence?: string }
  > = {};

  for (const placeholder of placeholders) {
    substitutionMap[placeholder] = {
      value: '[DADO NÃO ENCONTRADO]',
      source: 'not_found',
    };
  }

  for (const sub of substitutionsResult.substitutions) {
    const cleanKey = sub.placeholder.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase();

    // Find the best matching placeholder
    const matchingPlaceholder = placeholders.find(
      (p) =>
        p.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase() === cleanKey ||
        p === cleanKey ||
        cleanKey.includes(p.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase()) ||
        p.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase().includes(cleanKey)
    );

    const targetKey = matchingPlaceholder || cleanKey;

    if (targetKey && targetKey in substitutionMap) {
      const isFromEntity = Object.keys(entityData).some(
        (k) =>
          k.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase() === cleanKey ||
          cleanKey.includes(k.replace(/[<>{}[\]]/g, ' ').trim().toUpperCase())
      );

      substitutionMap[targetKey] = {
        value: sub.value,
        source: isFromEntity ? 'entity' : 'context',
        confidence: sub.confidence,
      };
    }
  }

  // Step 3: Build batch update requests
  const batchRequests = buildReplacementRequests(substitutionMap);

  // Step 4: Apply substitutions via Composio
  try {
    const client = await createComposioClient(userId);

    if (batchRequests.length > 0) {
      await client.batchUpdateDocument(documentId, batchRequests);
    }

    const filled = Object.entries(substitutionMap)
      .filter(([, v]) => v.value !== '[DADO NÃO ENCONTRADO]')
      .map(([k, v]) => ({
        placeholder: k,
        value: v.value,
        source: v.source as 'entity' | 'context' | 'inferred' | 'not_found',
        confidence: v.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
      }));

    const unfilled = Object.entries(substitutionMap)
      .filter(([, v]) => v.value === '[DADO NÃO ENCONTRADO]')
      .map(([k]) => k);

    return {
      success: true,
      documentLink: `https://docs.google.com/document/d/${documentId}/edit`,
      substitutions: filled,
      unfilled,
    };
  } catch (error: any) {
    console.error('[ai-enrich-contract] Composio batch update failed:', error);

    // Fallback: return what we would have applied without applying
    const filled = Object.entries(substitutionMap)
      .filter(([, v]) => v.value !== '[DADO NÃO ENCONTRADO]')
      .map(([k, v]) => ({
        placeholder: k,
        value: v.value,
        source: v.source as 'entity' | 'context' | 'inferred' | 'not_found',
        confidence: v.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
      }));

    const unfilled = Object.entries(substitutionMap)
      .filter(([, v]) => v.value === '[DADO NÃO ENCONTRADO]')
      .map(([k]) => k);

    return {
      success: false,
      documentLink: `https://docs.google.com/document/d/${documentId}/edit`,
      substitutions: filled,
      unfilled,
      error: `Erro ao aplicar substituições: ${error.message}`,
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

function buildReplacementRequests(
  substitutionMap: Record<
    string,
    { value: string; source: string; confidence?: string }
  >
): any[] {
  const requests: any[] = [];

  for (const [placeholderKey, { value }] of Object.entries(substitutionMap)) {
    const trimmedReplacement = value.trim();
    if (!trimmedReplacement || trimmedReplacement === '[DADO NÃO ENCONTRADO]') {
      continue;
    }

    // Generate all possible placeholder variants
    const generatedMatches = [
      `<<${placeholderKey}>>`,
      `{{${placeholderKey}}}`,
      `[[${placeholderKey}]]`,
      `<${placeholderKey}>`,
      placeholderKey,
      placeholderKey.replace(/[ _]/g, ''),
    ];

    const uniqueMatches = Array.from(
      new Set(generatedMatches.map((m) => m.trim()).filter(Boolean))
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
