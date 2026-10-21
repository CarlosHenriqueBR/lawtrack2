import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureAppearanceVariables, type CaptureAppearance } from "@/lib/capture-appearance";

export function CaptureFormView({ appearance, email = "", onEmailChange, onSubmit, saving = false, error = null, preview = false }: {
  appearance: CaptureAppearance;
  email?: string;
  onEmailChange?: (email: string) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  saving?: boolean;
  error?: string | null;
  preview?: boolean;
}) {
  const id = preview ? "preview-lead-email" : "lead-email";
  return <div className={`capture-stage ${preview ? "capture-preview" : ""}`} style={captureAppearanceVariables(appearance)}>
    <section className={`capture-form capture-${appearance.layout} capture-align-${appearance.alignment}`}>
      <h1 className={`capture-title capture-font-${appearance.titleFont} break-words text-4xl`}>{appearance.title}</h1>
      {appearance.subtitle && <p className="capture-subtitle mt-3 break-words text-lg font-medium">{appearance.subtitle}</p>}
      {appearance.description && <p className="capture-description mt-3 break-words text-sm">{appearance.description}</p>}
      <form className="mx-auto mt-8 w-full max-w-md space-y-4 text-left" onSubmit={preview ? (event) => event.preventDefault() : onSubmit}>
        <label htmlFor={id} className={appearance.hideLabel ? "sr-only" : "block break-words text-sm font-medium"}>{appearance.emailLabel}</label>
        <Input id={id} name="email" type="email" autoComplete={preview ? "off" : "email"} required maxLength={254} value={email}
          onChange={(event) => onEmailChange?.(event.target.value)} disabled={saving} className="capture-input h-11 text-base" placeholder={appearance.placeholder} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving || preview} className="capture-submit min-h-11 h-auto w-full whitespace-normal break-words px-5 py-2 text-sm font-semibold">
          {saving ? "Validando..." : appearance.buttonText}
        </Button>
      </form>
      {appearance.footer && <p className="capture-footer mt-5 break-words text-sm">{appearance.footer}</p>}
    </section>
  </div>;
}