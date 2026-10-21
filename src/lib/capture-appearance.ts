import { z } from "zod";
import type { CSSProperties } from "react";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const captureAppearanceSchema = z.object({
  title: z.string().max(160).default("🎯 Confirme seu email"),
  subtitle: z.string().max(240).default("Informe seu email para continuar com sua compra."),
  description: z.string().max(600).default(""),
  footer: z.string().max(240).default("🔒 Seus dados serão usados para confirmar sua compra."),
  hideLabel: z.boolean().default(true),
  emailLabel: z.string().min(1).max(80).default("E-mail"),
  placeholder: z.string().max(120).default("Seu melhor email"),
  buttonText: z.string().min(1).max(100).default("Continuar →"),
  background: color.default("#ffffff"),
  surface: color.default("#ffffff"),
  text: color.default("#111111"),
  secondaryText: color.default("#929297"),
  button: color.default("#ff0054"),
  buttonTextColor: color.default("#ffffff"),
  inputBackground: color.default("#ffffff"),
  border: color.default("#ff0054"),
  layout: z.enum(["plain", "panel", "reference"]).default("reference"),
  alignment: z.enum(["center", "left"]).default("center"),
  titleFont: z.enum(["serif", "mono", "sans"]).default("sans"),
  radius: z.number().int().min(0).max(32).default(16),
  width: z.number().int().min(360).max(640).default(576),
});
export type CaptureAppearance = z.infer<typeof captureAppearanceSchema>;
export const defaultCaptureAppearance = captureAppearanceSchema.parse({});
export function resolveCaptureAppearance(value: unknown): CaptureAppearance {
  const parsed = captureAppearanceSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { ...defaultCaptureAppearance };
}
export function captureAppearanceVariables(value: CaptureAppearance): CSSProperties {
  return {
    "--capture-background": value.background,
    "--capture-surface": value.surface,
    "--capture-text": value.text,
    "--capture-secondary": value.secondaryText,
    "--capture-button": value.button,
    "--capture-button-text": value.buttonTextColor,
    "--capture-input": value.inputBackground,
    "--capture-border": value.border,
    "--capture-radius": `${value.radius}px`,
    "--capture-width": `${value.width}px`,
  } as CSSProperties;
}