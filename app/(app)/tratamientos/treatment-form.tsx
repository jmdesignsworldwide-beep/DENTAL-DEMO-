"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Treatment } from "@/lib/treatments";
import { CATEGORIA, CATEGORIAS_ORDEN, type Categoria } from "./categoria-config";
import { createTreatment, updateTreatment, type TreatmentInput } from "./actions";

export function TreatmentForm({
  open,
  onClose,
  treatment,
}: {
  open: boolean;
  onClose: () => void;
  treatment?: Treatment | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const edit = !!treatment;
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [categoria, setCategoria] = React.useState<Categoria>("preventiva");
  const [duracion, setDuracion] = React.useState(30);
  const [precio, setPrecio] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setNombre(treatment?.nombre ?? "");
      setDescripcion(treatment?.descripcion ?? "");
      setCategoria(treatment?.categoria ?? "preventiva");
      setDuracion(treatment?.duracion_min ?? 30);
      setPrecio(treatment?.precio ?? 0);
    }
  }, [open, treatment]);

  function submit() {
    const input: TreatmentInput = { nombre, descripcion, categoria, duracion_min: duracion, precio };
    start(async () => {
      const res = edit
        ? await updateTreatment(treatment!.id, input)
        : await createTreatment(input);
      if (res.ok) {
        toast.success(edit ? "Tratamiento actualizado" : "Tratamiento creado", nombre);
        onClose();
        router.refresh();
      } else setError(res.error ?? "No se pudo guardar.");
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Editar tratamiento" : "Nuevo tratamiento"}
      description="Define los datos del servicio del catálogo."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label="Nombre" htmlFor="t-nombre" required>
          <Input id="t-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Limpieza dental" />
        </Field>
        <Field label="Descripción" htmlFor="t-desc">
          <Textarea id="t-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción breve del servicio…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Categoría" htmlFor="t-cat" className="sm:col-span-3">
            <Select id="t-cat" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
              {CATEGORIAS_ORDEN.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duración (min)" htmlFor="t-dur">
            <Input id="t-dur" type="number" min={5} max={600} value={duracion} onChange={(e) => setDuracion(Math.max(5, parseInt(e.target.value) || 30))} />
          </Field>
          <Field label="Precio (RD$)" htmlFor="t-precio" className="sm:col-span-2">
            <Input id="t-precio" type="number" min={0} value={precio} onChange={(e) => setPrecio(Math.max(0, parseFloat(e.target.value) || 0))} />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button icon={Save} loading={pending} onClick={submit}>
            {edit ? "Guardar cambios" : "Crear tratamiento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
