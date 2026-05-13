'use server';

/**
 * AI Review Contract Flow
 *
 * Reviews generated contracts using Gemini and provides structured improvement suggestions.
 * Does NOT auto-apply edits — returns suggestions only.
 *
 * Flow: 1) Read document content via Composio, 2) Gemini reviews, 3) Return suggestions
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { createComposioClient } from '@/lib/composio-client';
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';

// ============================================================
// INPUT / OUTPUT SCHEMAS
// ============================================================

const AIReviewContractInputSchema = z.object({
  userId: z.string().describe('User ID for Composio session'),
  documentId: z.string().describe('ID of the generated contract document to review'),
  documentName: z.string().optional().describe('Name of the document for context'),
  context: z
    .string()
    .optional()
    .describe('Additional context about the contract (project description, client info, etc.)'),
  reviewFocus: z
    .enum(['all', 'legal', 'completeness', 'consistency'])
    .optional()
    .default('all')
    .describe('What aspect to focus the review on'),
  contractType: z
    .string()
    .optional()
    .describe('Contract type (e.g. "TED", "Contrato de Prestação de Serviços")'),
});

export type AIReviewContractInput = z.infer<typeof AIReviewContractInputSchema>;

const ReviewEditSuggestionSchema = z.object({
  section: z
    .string()
    .describe('The section or paragraph where the edit should be applied'),
  originalText: z
    .string()
    .describe('The original text to be replaced'),
  suggestedText: z
    .string()
    .describe('The suggested replacement text'),
  reason: z
    .string()
    .describe('Why this change is recommended'),
  severity: z
    .enum(['critical', 'suggestion', 'optional'])
    .optional()
    .describe('How important this change is'),
  confidence: z
    .enum(['HIGH', 'MEDIUM', 'LOW'])
    .optional()
    .describe('AI confidence in this suggestion'),
});

const AIReviewContractOutputSchema = z.object({
  success: z.boolean(),
  documentId: z.string(),
  summary: z
    .string()
    .describe('Brief summary of review findings (2-3 sentences)'),
  overallQuality: z
    .enum(['good', 'needs_work', 'requires_revision'])
    .describe('Overall quality'),
  suggestions: z
    .array(ReviewEditSuggestionSchema)
    .describe('List of edit suggestions with before/after text'),
  reviewedAt: z.string().describe('ISO timestamp of when the review was performed'),
  error: z.string().optional(),
  requestId: z.string().optional().describe('Request ID for debugging'),
});

export type AIReviewContractOutput = z.infer<typeof AIReviewContractOutputSchema>;
export type ReviewEditSuggestion = z.infer<typeof ReviewEditSuggestionSchema>;

// ============================================================
// PROMPT
// ============================================================

const reviewContractPrompt = ai.definePrompt({
  name: 'reviewContractPrompt',
  model: 'googleai/gemini-3-flash-preview',
  input: {
    schema: z.object({
      documentContent: z.string(),
      documentName: z.string(),
      context: z.string(),
      reviewFocus: z.string(),
      contractType: z.string(),
    }),
  },
  output: {
    format: 'json',
    schema: z.object({
      summary: z.string().describe('Brief summary of review findings (2-3 sentences)'),
      overallQuality: z.enum(['good', 'needs_work', 'requires_revision']).describe('Overall quality'),
      suggestions: z.array(
        z.object({
          section: z.string().describe('Section or paragraph for the edit'),
          originalText: z.string().describe('Original text to replace'),
          suggestedText: z.string().describe('Replacement text'),
          reason: z.string().describe('Why this change is recommended'),
          severity: z.enum(['critical', 'suggestion', 'optional']).optional(),
          confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        })
      ),
    }),
  },
  prompt: `Você é um especialista em revisão de contratos administrativos brasileiros.

## TAREFA
Revise o contrato abaixo e identifique sugestões de melhoria.

## DOCUMENTO PARA REVISÃO
{{{documentContent}}}

## NOME DO DOCUMENTO
{{documentName}}

## TIPO DE CONTRATO
{{contractType}}

## CONTEXTO ADICIONAL
{{context}}

## FOCO DA REVISÃO
{{reviewFocus}}

## DIRETRIZES DE REVISÃO

1. **LEGAL CORRECTNESS**: Verifique se cláusulas legais estão corretas e completas
   - Cláusulas obrigatória: objeto, prazo, valor, partes, signatures
   - Conformidade com lei 14.133/21 (Nova Lei de Licitações) se aplicável

2. **COMPLETENESS**: Verifique se todos os campos/palavras-chave estão preenchidos
   - Nomes de partes, CNPJ/CPF, endereços
   - Datas, valores, prazos

3. **CONSISTENCY**: Verifique consistência interna
   - Valores numéricos por extenso vs numérico
   - Datas de início/fim vs prazo
   - Partes listadas vs assinaturas

4. **CLARITY**: Verifique se a linguagem é clara e滴水不漏

5. **FORMAT**: Verifique formatação e estrutura

## REGRAS DE SUGESTÃO

- **critical**: Problema legal sério ou dado faltante que pode invalidar o contrato
- **suggestion**: Melhoria recomendada para clareza ou conformidade
- **optional**: Polish ou formatação

- Seja conservatism — só sugira mudanças se realmente necessárias
- Preserve o estilo legal original
- Sugira texto concreto, não vague orientações

## OUTPUT FORMAT
Retorne um JSON com:
- "summary": Resumo breve dos achados (2-3 frases)
- "overallQuality": "good" | "needs_work" | "requires_revision"
- "suggestions": Array de { section, originalText, suggestedText, reason, severity?, confidence? }

Retorne SOMENTE JSON válido.`,
});

// ============================================================
// MAIN FUNCTION
// ============================================================

export async function aiReviewContract(
  input: AIReviewContractInput
): Promise<AIReviewContractOutput> {
  return reviewContractFlow(input);
}

// ============================================================
// FLOW
// ============================================================

async function reviewContractFlow(
  input: AIReviewContractInput
): Promise<AIReviewContractOutput> {
  const requestId = generateRequestId();
  const { userId, documentId, documentName, context, reviewFocus, contractType } = input;

  debugLog(requestId, 'ai-review-contract', 'Starting review flow', {
    userId,
    documentId,
    documentName,
    reviewFocus,
    contractType,
    contextProvided: !!context,
  });

  // Step 1: Fetch document content via Composio
  let documentContent: string;
  try {
    const client = await createComposioClient(userId);
    documentContent = await client.getDocumentContent(documentId);
    debugLog(requestId, 'ai-review-contract', 'Document content fetched', {
      documentId,
      contentLength: documentContent.length,
    });
  } catch (error: any) {
    debugError(requestId, 'ai-review-contract', 'Failed to fetch document content', error, {
      userId,
      documentId,
    });
    return {
      success: false,
      documentId,
      summary: '',
      overallQuality: 'requires_revision',
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      error: `Erro ao acessar documento: ${error.message}`,
      requestId,
    };
  }

  if (!documentContent || documentContent.trim().length === 0) {
    debugError(requestId, 'ai-review-contract', 'Document is empty', new Error('EMPTY_DOCUMENT'), {
      documentId,
    });
    return {
      success: true,
      documentId,
      summary: 'Documento está vazio.',
      overallQuality: 'requires_revision',
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      requestId,
    };
  }

  // Step 2: Call Gemini to review
  try {
    const reviewFocusMap: Record<string, string> = {
      all: 'Revisão geral completa — legal, completude, consistência e clareza',
      legal: 'Foco em conformidade legal e correção de cláusulas',
      completeness: 'Foco em dados faltantes e campos não preenchidos',
      consistency: 'Foco em consistência interna do documento',
    };

    debugLog(requestId, 'ai-review-contract', 'Calling Gemini for review', {
      documentId,
      reviewFocus: reviewFocusMap[reviewFocus] || reviewFocusMap.all,
      contractType,
      contentLength: documentContent.length,
    });

    const llmResponse = await reviewContractPrompt({
      documentContent: documentContent.slice(0, 30000), // limit to first 30k chars
      documentName: documentName || 'Documento sem nome',
      context: context || 'Não fornecido',
      reviewFocus: reviewFocusMap[reviewFocus] || reviewFocusMap.all,
      contractType: contractType || 'Não especificado',
    });

    const output = llmResponse.output;

    if (!output || typeof output.summary !== 'string') {
      debugError(requestId, 'ai-review-contract', 'Invalid Gemini response', new Error('INVALID_LLM_RESPONSE'), {
        outputType: typeof output,
        hasSummary: !!output?.summary,
      });
      throw new Error('Resposta inválida do modelo de IA');
    }

    debugLog(requestId, 'ai-review-contract', 'Gemini review completed', {
      documentId,
      summary: output.summary.substring(0, 200),
      overallQuality: output.overallQuality,
      suggestionCount: (output.suggestions || []).length,
    });

    return {
      success: true,
      documentId,
      summary: output.summary,
      overallQuality: output.overallQuality,
      suggestions: (output.suggestions || []).map((s: any) => ({
        section: s.section || 'Documento geral',
        originalText: s.originalText || '',
        suggestedText: s.suggestedText || '',
        reason: s.reason || '',
        severity: s.severity,
        confidence: s.confidence,
      })),
      reviewedAt: new Date().toISOString(),
      requestId,
    };
  } catch (error: any) {
    debugError(requestId, 'ai-review-contract', 'Gemini review failed', error, {
      documentId,
      reviewFocus,
      contractType,
    });
    return {
      success: false,
      documentId,
      summary: '',
      overallQuality: 'requires_revision',
      suggestions: [],
      reviewedAt: new Date().toISOString(),
      error: `Erro na revisão de IA: ${error.message}`,
      requestId,
    };
  }
}
