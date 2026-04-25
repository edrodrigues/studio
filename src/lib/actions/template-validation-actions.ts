"use server";

import { z } from "zod";

import { validateTemplateLinksForPersistence } from "@/lib/template-link-validation.server";

const validateTemplateLinksSchema = z.object({
  userId: z.string().min(1, "Usuário não autenticado."),
  googleDocLink: z.string().optional(),
  projectDocLink: z.string().optional(),
});

export async function handleValidateTemplateLinksForSave(input: {
  userId: string;
  googleDocLink?: string;
  projectDocLink?: string;
}) {
  const validatedInput = validateTemplateLinksSchema.safeParse(input);

  if (!validatedInput.success) {
    return {
      success: false,
      canSave: false,
      validations: {},
      blockingErrors: validatedInput.error.errors.map((error) => error.message),
      warnings: [],
    };
  }

  try {
    const result = await validateTemplateLinksForPersistence(
      validatedInput.data.userId,
      validatedInput.data
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      canSave: false,
      validations: {},
      blockingErrors: [
        error instanceof Error
          ? error.message
          : "Não foi possível validar os links do template agora.",
      ],
      warnings: [],
    };
  }
}
