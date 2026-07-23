import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata = { title: "Design System" };

export default function DesignSystemPage() {
  // Solo disponible en desarrollo — nunca expuesto en producción.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <div className="min-h-screen bg-bg">
      <Showcase />
    </div>
  );
}
