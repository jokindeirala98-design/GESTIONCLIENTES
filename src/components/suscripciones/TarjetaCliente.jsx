import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const TIPO_PLAN_LABEL = {
  ahorro_25: "25% del ahorro",
  suscripcion_anual: "Suscripción anual"
};

const FRECUENCIA_LABEL = {
  adelantado: "Adelantado",
  trimestral: "Trimestral"
};

export default function TarjetaCliente({ plan, cuota, onMarcarPagado, onGenerarFactura, destacado }) {
  const diasRestantes = cuota ? differenceInDays(new Date(cuota.fecha_vencimiento), new Date()) : null;
  const urgente = diasRestantes !== null && diasRestantes <= 2;

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 p-5 ${
      destacado ? "border-[#004D9D] shadow-md ring-1 ring-[#004D9D]/20" : "border-gray-100 shadow-sm hover:shadow-md"
    }`}>
      <div className="flex items-start justify-between gap-4">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {destacado && (
              <span className="w-2 h-2 rounded-full bg-[#004D9D] animate-pulse flex-shrink-0" />
            )}
            <h3 className="font-semibold text-gray-900 truncate text-sm">{plan.cliente_nombre}</h3>
            {plan.frecuencia_pago === "trimestral" && cuota?.numero_cuota && (
              <span className="flex-shrink-0 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5">
                {cuota.numero_cuota}/4
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs text-gray-500 font-normal">
              {TIPO_PLAN_LABEL[plan.tipo_plan]}
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-500 font-normal">
              {FRECUENCIA_LABEL[plan.frecuencia_pago]}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
            <div>
              <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Cuota</span>
              <span className="text-gray-800 font-semibold text-sm">{plan.importe_cuota?.toFixed(2)} €</span>
            </div>
            <div>
              <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Activación</span>
              <span className="text-gray-700">
                {plan.fecha_activacion ? format(new Date(plan.fecha_activacion), "dd MMM yyyy", { locale: es }) : "—"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Próximo pago</span>
              <span className={`font-medium ${urgente ? "text-red-500" : "text-gray-700"}`}>
                {plan.fecha_proximo_pago
                  ? format(new Date(plan.fecha_proximo_pago), "dd MMM yyyy", { locale: es })
                  : "—"}
                {diasRestantes !== null && diasRestantes >= 0 && (
                  <span className={`ml-2 text-xs ${urgente ? "text-red-400" : "text-gray-400"}`}>
                    ({diasRestantes === 0 ? "hoy" : `en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`})
                  </span>
                )}
                {diasRestantes !== null && diasRestantes < 0 && (
                  <span className="ml-2 text-xs text-red-500">(vencido hace {Math.abs(diasRestantes)} días)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGenerarFactura(plan, cuota)}
            className="text-xs gap-1.5 border-gray-200 text-gray-600 hover:text-[#004D9D] hover:border-[#004D9D]"
          >
            <FileText className="w-3.5 h-3.5" />
            Factura
          </Button>
          <Button
            size="sm"
            onClick={() => onMarcarPagado(cuota)}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Pagado
          </Button>
        </div>
      </div>
    </div>
  );
}