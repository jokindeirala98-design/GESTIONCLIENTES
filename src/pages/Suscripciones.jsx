import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import TarjetaCliente from "@/components/suscripciones/TarjetaCliente";
import { createPageUrl } from "@/utils";
import { CreditCard, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Suscripciones() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  // Leer si venimos desde una tarea con ?cliente_id=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const clienteIdDestacado = urlParams.get("cliente_id");

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: planes = [], isLoading: loadingPlanes } = useQuery({
    queryKey: ["planes_pago"],
    queryFn: () => base44.entities.PlanPago.filter({ estado: "activo" }),
    enabled: !!user
  });

  const { data: cuotas = [], isLoading: loadingCuotas } = useQuery({
    queryKey: ["cuotas_pago"],
    queryFn: () => base44.entities.CuotaPago.filter({ estado: "pendiente" }),
    enabled: !!user
  });

  const isAdmin = user?.role === "admin";

  // Filtrar por comercial si no es admin
  const planesFiltrados = isAdmin
    ? planes
    : planes.filter((p) => p.comercial_email === user?.email);

  // Construir mapa cuota por plan
  const cuotaPorPlan = {};
  cuotas.forEach((c) => {
    if (!cuotaPorPlan[c.plan_pago_id] || c.fecha_vencimiento < cuotaPorPlan[c.plan_pago_id].fecha_vencimiento) {
      cuotaPorPlan[c.plan_pago_id] = c;
    }
  });

  // Separar por frecuencia y ordenar por fecha_proximo_pago
  const planesConCuota = planesFiltrados
    .filter((p) => cuotaPorPlan[p.id])
    .sort((a, b) => {
      const fa = cuotaPorPlan[a.id]?.fecha_vencimiento || a.fecha_proximo_pago || "";
      const fb = cuotaPorPlan[b.id]?.fecha_vencimiento || b.fecha_proximo_pago || "";
      return fa.localeCompare(fb);
    });

  // Si venimos desde tarea, mover el cliente destacado arriba
  const planesOrdenados = clienteIdDestacado
    ? [
        ...planesConCuota.filter((p) => p.cliente_id === clienteIdDestacado),
        ...planesConCuota.filter((p) => p.cliente_id !== clienteIdDestacado)
      ]
    : planesConCuota;

  const planesTrimestrales = planesOrdenados.filter((p) => p.frecuencia_pago === "trimestral");
  const planesAdelantados = planesOrdenados.filter((p) => p.frecuencia_pago === "adelantado");

  const marcarPagadoMutation = useMutation({
    mutationFn: (cuota) => base44.functions.invoke("marcarCuotaPagada", { cuota_id: cuota.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planes_pago"] });
      queryClient.invalidateQueries({ queryKey: ["cuotas_pago"] });
      toast.success("Cuota marcada como pagada");
    }
  });

  const handleMarcarPagado = (cuota) => {
    marcarPagadoMutation.mutate(cuota);
  };

  const handleGenerarFactura = (plan, cuota) => {
    // Placeholder: cuando las plantillas estén disponibles, aquí se invocará la función backend
    toast.info("La generación de facturas estará disponible cuando se añadan las plantillas.");
  };

  if (!user || loadingPlanes || loadingCuotas) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-8 h-8 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderLista = (lista, tipo) => {
    if (lista.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay pagos {tipo} pendientes</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {lista.map((plan, idx) => (
          <TarjetaCliente
            key={plan.id}
            plan={plan}
            cuota={cuotaPorPlan[plan.id]}
            onMarcarPagado={handleMarcarPagado}
            onGenerarFactura={handleGenerarFactura}
            destacado={plan.cliente_id === clienteIdDestacado && idx === 0}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#004D9D]">Suscripciones</h1>
          <p className="text-sm text-gray-500 mt-1">Cola de pagos activos ordenada por vencimiento</p>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-[#004D9D]">{planesConCuota.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pendientes</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-700">{planesTrimestrales.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Trimestrales</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-700">{planesAdelantados.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Adelantados</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trimestral">
          <TabsList className="w-full bg-white border border-gray-100 shadow-sm mb-4 rounded-xl p-1">
            <TabsTrigger value="trimestral" className="flex-1 gap-2 data-[state=active]:bg-[#004D9D] data-[state=active]:text-white rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              Trimestral
              {planesTrimestrales.length > 0 && (
                <Badge className="bg-[#004D9D]/20 text-[#004D9D] text-xs ml-1 px-1.5 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {planesTrimestrales.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="adelantado" className="flex-1 gap-2 data-[state=active]:bg-[#004D9D] data-[state=active]:text-white rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Adelantado
              {planesAdelantados.length > 0 && (
                <Badge className="bg-[#004D9D]/20 text-[#004D9D] text-xs ml-1 px-1.5">
                  {planesAdelantados.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trimestral">
            {renderLista(planesTrimestrales, "trimestrales")}
          </TabsContent>
          <TabsContent value="adelantado">
            {renderLista(planesAdelantados, "adelantados")}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}