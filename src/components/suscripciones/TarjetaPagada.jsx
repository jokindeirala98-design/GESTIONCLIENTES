import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TIPO_PLAN_LABEL = {
  ahorro_25: "25% del ahorro",
  suscripcion_anual: "Suscripción anual"
};

const FRECUENCIA_LABEL = {
  adelantado: "Adelantado",
  trimestral: "Trimestral"
};

export default function TarjetaPagada({ plan, cuota }) {
  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 opacity-90">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-800 truncate text-sm">{plan.cliente_nombre}</h3>
            {plan.frecuencia_pago === "trimestral" && cuota?.numero_cuota && (
              <span className="flex-shrink-0 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                Pagado {cuota.numero_cuota}/4
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
              <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Importe</span>
              <span className="text-emerald-700 font-semibold text-sm">{cuota.importe?.toFixed(2)} €</span>
            </div>
            <div>
              <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Fecha de pago</span>
              <span className="text-gray-700">
                {cuota.fecha_pago_real
                  ? format(new Date(cuota.fecha_pago_real), "dd MMM yyyy", { locale: es })
                  : "—"}
              </span>
            </div>
            {plan.frecuencia_pago === "trimestral" && plan.fecha_proximo_pago && (
              <div className="col-span-2">
                <span className="block text-gray-400 uppercase tracking-wide text-[10px] font-medium">Próxima cuota</span>
                <span className="text-gray-600">
                  {format(new Date(plan.fecha_proximo_pago), "dd MMM yyyy", { locale: es })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pagado
          </span>
        </div>
      </div>
    </div>
  );
}