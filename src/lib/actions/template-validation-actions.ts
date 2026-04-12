"use server";

import { z } from "zod";

import { validateTemplateLinksForPersistence } from "@/lib/template-link-validation.server";

const validateTemplateLinksSchema = z.object({
  accessToken: z.string().min(1, "Conecte sua conta Google para validar os templates."),
  googleDocLink: z.string().optional(),
  projectDocLink: z.string().optional(),
});

export async function handleValidateTemplateLinksForSave(input: {
  accessToken: string;
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
      validatedInput.data.accessToken,
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
