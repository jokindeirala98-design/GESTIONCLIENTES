import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function ActivarPlanDialog({ open, onClose, cliente }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo_plan: "",
    frecuencia_pago: "",
    importe_total: "",
    fecha_activacion: new Date().toISOString().split("T")[0],
    descuento_adelantado: false,
    notas: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    await base44.functions.invoke("activarPlanPago", {
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre_negocio,
      comercial_email: cliente.propietario_email,
      tipo_plan: form.tipo_plan,
      frecuencia_pago: form.frecuencia_pago,
      importe_total: parseFloat(form.importe_total),
      fecha_activacion: form.fecha_activacion,
      descuento_adelantado: form.descuento_adelantado,
      notas: form.notas
    });

    queryClient.invalidateQueries({ queryKey: ["planes_pago"] });
    setLoading(false);
    onClose();
  };

  const mostrarDescuento = form.tipo_plan === "suscripcion_anual" && form.frecuencia_pago === "adelantado";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Activar Plan de Pago</DialogTitle>
          <p className="text-sm text-gray-500">{cliente?.nombre_negocio}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Tipo de plan</Label>
            <Select onValueChange={(v) => setForm({ ...form, tipo_plan: v })} required>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ahorro_25">25% del ahorro</SelectItem>
                <SelectItem value="suscripcion_anual">Suscripción anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Frecuencia de pago</Label>
            <Select onValueChange={(v) => setForm({ ...form, frecuencia_pago: v })} required>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="adelantado">Pago adelantado</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mostrarDescuento && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3">
              <input
                type="checkbox"
                id="descuento"
                checked={form.descuento_adelantado}
                onChange={(e) => setForm({ ...form, descuento_adelantado: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="descuento" className="text-sm text-blue-700 font-medium">
                Aplicar 5% de descuento por pago adelantado
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Importe total (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.importe_total}
              onChange={(e) => setForm({ ...form, importe_total: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de activación</Label>
            <Input
              type="date"
              value={form.fecha_activacion}
              onChange={(e) => setForm({ ...form, fecha_activacion: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Input
              placeholder="Añadir notas..."
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !form.tipo_plan || !form.frecuencia_pago || !form.importe_total}
              className="flex-1 bg-[#004D9D] hover:bg-[#003d7a]"
            >
              {loading ? "Activando..." : "Activar plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}