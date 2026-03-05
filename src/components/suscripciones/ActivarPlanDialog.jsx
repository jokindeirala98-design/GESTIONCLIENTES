import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ActivarPlanDialog({ open, onClose, cliente, clientes = [] }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState(cliente?.id || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    tipo_plan: "",
    frecuencia_pago: "",
    importe_total: "",
    fecha_activacion: new Date().toISOString().split("T")[0],
    descuento_adelantado: false,
    notas: ""
  });

  // Si viene con cliente fijo, usar ese; si no, permitir buscar
  const clienteFijo = !!cliente;
  const clienteEfectivo = clienteFijo
    ? cliente
    : clientes.find(c => c.id === clienteSeleccionadoId);

  const clientesFiltrados = clientes.filter(c =>
    c.nombre_negocio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteEfectivo) {
      toast.error("Selecciona un cliente");
      return;
    }
    setLoading(true);

    await base44.functions.invoke("activarPlanPago", {
      cliente_id: clienteEfectivo.id,
      cliente_nombre: clienteEfectivo.nombre_negocio,
      comercial_email: clienteEfectivo.propietario_email,
      tipo_plan: form.tipo_plan,
      frecuencia_pago: form.frecuencia_pago,
      importe_total: parseFloat(form.importe_total),
      fecha_activacion: form.fecha_activacion,
      descuento_adelantado: form.descuento_adelantado,
      notas: form.notas
    });

    queryClient.invalidateQueries({ queryKey: ["planes_pago"] });
    queryClient.invalidateQueries({ queryKey: ["cuotas_pago"] });
    toast.success("Plan activado correctamente");
    setLoading(false);
    setForm({ tipo_plan: "", frecuencia_pago: "", importe_total: "", fecha_activacion: new Date().toISOString().split("T")[0], descuento_adelantado: false, notas: "" });
    setClienteSeleccionadoId("");
    setSearchTerm("");
    onClose();
  };

  const mostrarDescuento = form.tipo_plan === "suscripcion_anual" && form.frecuencia_pago === "adelantado";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Activar Plan de Pago</DialogTitle>
          {clienteFijo && <p className="text-sm text-gray-500">{cliente?.nombre_negocio}</p>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Selector de cliente (solo si no viene con cliente fijo) */}
          {!clienteFijo && (
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              {clienteSeleccionadoId && clienteEfectivo ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-blue-800 flex-1">{clienteEfectivo.nombre_negocio}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-blue-500 hover:text-blue-700"
                    onClick={() => { setClienteSeleccionadoId(""); setSearchTerm(""); }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <div>
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <div className="mt-1 max-h-48 overflow-y-auto border rounded-lg bg-white shadow-sm">
                      {clientesFiltrados.slice(0, 10).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                          onClick={() => { setClienteSeleccionadoId(c.id); setSearchTerm(""); }}
                        >
                          <span className="font-medium">{c.nombre_negocio}</span>
                          {c.nombre_cliente && <span className="text-gray-400 text-xs ml-2">{c.nombre_cliente}</span>}
                        </button>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <p className="px-3 py-4 text-center text-gray-400 text-sm">Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Tipo de plan</Label>
            <Select value={form.tipo_plan} onValueChange={(v) => setForm({ ...form, tipo_plan: v })} required>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ahorro_25">25% del ahorro</SelectItem>
                <SelectItem value="suscripcion_anual">Suscripción anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Frecuencia de pago</Label>
            <Select value={form.frecuencia_pago} onValueChange={(v) => setForm({ ...form, frecuencia_pago: v })} required>
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
              disabled={loading || !form.tipo_plan || !form.frecuencia_pago || !form.importe_total || (!clienteFijo && !clienteSeleccionadoId)}
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