import { Camera, ScanLine, FileText, ImagePlus, type LucideIcon } from "lucide-react";
import type { AttachmentTipo } from "@/lib/clinical";

export const ATTACH: Record<
  AttachmentTipo,
  { label: string; icon: LucideIcon; isImage: boolean; color: string }
> = {
  foto_antes: { label: "Foto (antes)", icon: Camera, isImage: true, color: "text-clinical" },
  foto_despues: { label: "Foto (después)", icon: ImagePlus, isImage: true, color: "text-mint" },
  radiografia: { label: "Radiografía", icon: ScanLine, isImage: true, color: "text-violet-500" },
  consentimiento: { label: "Consentimiento", icon: FileText, isImage: false, color: "text-amber" },
};

export const ATTACH_TIPOS: AttachmentTipo[] = [
  "foto_antes",
  "foto_despues",
  "radiografia",
  "consentimiento",
];
