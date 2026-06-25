import { z } from "zod";

export const registroSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().trim().email("E-mail invalido").toLowerCase(),
  senha: z
    .string()
    .min(6, "Senha deve ter pelo menos 6 caracteres")
    .max(72, "Senha muito longa"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail invalido").toLowerCase(),
  senha: z.string().min(1, "Informe a senha"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token obrigatorio"),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
