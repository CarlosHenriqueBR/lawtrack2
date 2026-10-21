import { z } from "zod";
import type { CSSProperties } from "react";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const captureAppearanceSchema = z.object({
  title: z.string().max(160).default("Continue para o pagamento"),
  subtitle: z.string().max(240).default(""),
  description: z.string().max(600).default("Informe seu e-mail para validar o acesso. O checkout seguro da Digistore24 será carregado em seguida."),
  emailLabel: z.string().min(1).max(80).default("E-mail"),
  placeholder: z.string().max(120).default("voce@exemplo.com"),
  buttonText: z.string().min(1).max(100).default("Continuar para pagamento"),
  background: color.default("#ffffff"),
  surface: color.default("#ffffff"),
  text: color.default("#303030"),
  secondaryText: color.default("#86807b"),
  button: color.default("#db2d39"),
  buttonTextColor: color.default("#ffffff"),
  inputBackground: color.default("#ffffff"),
  border: color.default("#c8c8c8"),
  layout: z.enum(["plain", "panel"]).default("plain"),
  alignment: z.enum(["center", "left"]).default("center"),
  titleFont: z.enum(["serif", "mono", "sans"]).default("serif"),
  radius: z.number().int().min(0).max(8).default(4),
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