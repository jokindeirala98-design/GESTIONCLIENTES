import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Calendar, FileText, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ActivarPlanDialog from "./ActivarPlanDialog";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

const TIPO_LABEL = { ahorro_25: "25% del ahorro", suscripcion_anual: "Suscripción anual" };
const FRECUENCIA_LABEL = { adelantado: "Pago adelantado", trimestral: "Trimestral" };

export default function PlanPagoSection({ cliente, canEdit }) {
  const [showDialog, setShowDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: planes = [] } = useQuery({
    queryKey: ["planes_pago", cliente.id],
    queryFn: () => base44.entities.PlanPago.filter({ cliente_id: cliente.id }),
  });

  const planActivo = planes.find((p) => p.estado === "activo");
  const planesHistorial = planes.filter((p) => p.estado !== "activo");

  const { data: cuotas = [] } = useQuery({
    queryKey: ["cuotas_pago", planActivo?.id],
    queryFn: () => base44.entities.CuotaPago.filter({ plan_pago_id: planActivo.id, estado: "pendiente" }),
    enabled: !!planActivo,
  });

  const proximaCuota = cuotas.sort((a, b) => a.fecha_vencimiento?.localeCompare(b.fecha_vencimiento))[0];

  const handleEliminarPlanHistorial = async (plan) => {
    const todasCuotas = await base44.entities.CuotaPago.filter({ plan_pago_id: plan.id });
    await Promise.all(todasCuotas.map(c => base44.entities.CuotaPago.delete(c.id)));
    await base44.entities.PlanPago.delete(plan.id);
    queryClient.invalidateQueries({ queryKey: ["planes_pago", cliente.id] });
    queryClient.invalidateQueries({ queryKey: ["planes_pago"] });
    queryClient.invalidateQueries({ queryKey: ["cuotas_pago"] });
    toast.success("Plan eliminado del historial");
  };

  const handleVerEnSuscripciones = () => {
    window.location.href = createPageUrl(`Suscripciones?cliente_id=${cliente.id}`);
  };

  const handleGenerarFactura = () => {
    toast.info("La generación de facturas estará disponible cuando se añadan las plantillas.");
  };

  const handleEliminarPlan = async () => {
    if (!planActivo) return;
    setDeleting(true);
    // Eliminar todas las cuotas del plan
    const todasCuotas = await base44.entities.CuotaPago.filter({ plan_pago_id: planActivo.id });
    await Promise.all(todasCuotas.map(c => base44.entities.CuotaPago.delete(c.id)));
    // Eliminar el plan
    await base44.entities.PlanPago.delete(planActivo.id);
    queryClient.invalidateQueries({ queryKey: ["planes_pago", cliente.id] });
    queryClient.invalidateQueries({ queryKey: ["planes_pago"] });
    queryClient.invalidateQueries({ queryKey: ["cuotas_pago"] });
    setConfirmDelete(false);
    setDeleting(false);
    toast.success("Plan de pago eliminado correctamente");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#004D9D]" />
          <h3 className="font-semibold text-gray-800">Plan de Pago</h3>
        </div>
        {canEdit && !planActivo && (
          <Button
            size="sm"
            onClick={() => setShowDialog(true)}
            className="bg-[#004D9D] hover:bg-[#003d7a] gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Activar plan
          </Button>
        )}
        {planActivo && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleVerEnSuscripciones}
              className="gap-1.5 text-xs border-gray-200 text-gray-600"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en Suscripciones
            </Button>
            {canEdit && !confirmDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </Button>
            )}
            {canEdit && confirmDelete && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-500 font-medium">¿Seguro?</span>
                <Button
                  size="sm"
                  onClick={handleEliminarPlan}
                  disabled={deleting}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white h-7 px-2"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs h-7 px-2"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {!planActivo ? (
        <div className="text-center py-8 text-gray-400">
          <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin plan de pago activo</p>
          {canEdit && (
            <p className="text-xs mt-1 text-gray-300">Haz clic en "Activar plan" para comenzar</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Info del plan */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Tipo de plan</p>
              <p className="text-sm font-semibold text-gray-800">{TIPO_LABEL[planActivo.tipo_plan]}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Frecuencia</p>
              <p className="text-sm font-semibold text-gray-800">{FRECUENCIA_LABEL[planActivo.frecuencia_pago]}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Importe cuota</p>
              <p className="text-sm font-bold text-[#004D9D]">{planActivo.importe_cuota?.toFixed(2)} €</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Activación</p>
              <p className="text-sm text-gray-700">
                {planActivo.fecha_activacion
                  ? format(new Date(planActivo.fecha_activacion), "dd MMM yyyy", { locale: es })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Próximo pago */}
          {proximaCuota && (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-[10px] text-blue-400 uppercase tracking-wide font-medium">Próximo pago</p>
                  <p className="text-sm font-semibold text-blue-700">
                    {format(new Date(proximaCuota.fecha_vencimiento), "dd MMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-700">{proximaCuota.importe?.toFixed(2)} €</span>
            </div>
          )}

          {/* Contrato */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <FileText className="w-3.5 h-3.5" />
              <span>
                {planActivo.contrato_url
                  ? <a href={planActivo.contrato_url} target="_blank" rel="noreferrer" className="text-[#004D9D] underline">Ver contrato</a>
                  : "Contrato pendiente (se añadirá cuando haya plantilla)"}
              </span>
            </div>
            {canEdit && proximaCuota && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerarFactura}
                className="text-xs gap-1 border-gray-200 text-gray-500"
              >
                <FileText className="w-3 h-3" />
                Generar factura
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Historial de planes finalizados/cancelados */}
      {planesHistorial.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Historial de planes</p>
          <div className="space-y-2">
            {planesHistorial.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700">{TIPO_LABEL[plan.tipo_plan]} · {FRECUENCIA_LABEL[plan.frecuencia_pago]}</p>
                  <p className="text-xs text-gray-400">
                    {plan.importe_total?.toFixed(2)} € · Activado {plan.fecha_activacion ? format(new Date(plan.fecha_activacion), "dd MMM yyyy", { locale: es }) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${plan.estado === "finalizado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {plan.estado}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleEliminarPlanHistorial(plan)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      title="Eliminar del historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActivarPlanDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        cliente={cliente}
      />
    </div>
  );
}