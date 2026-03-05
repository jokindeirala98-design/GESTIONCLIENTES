import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TarjetaCliente from "@/components/suscripciones/TarjetaCliente";
import TarjetaPagada from "@/components/suscripciones/TarjetaPagada";
import ActivarPlanDialog from "@/components/suscripciones/ActivarPlanDialog";
import { CreditCard, Clock, CheckCircle2, Plus, History } from "lucide-react";
import { toast } from "sonner";

export default function Suscripciones() {
  const [user, setUser] = useState(null);
  const [showActivarDialog, setShowActivarDialog] = useState(false);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const clienteIdDestacado = urlParams.get("cliente_id");

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: planes = [], isLoading: loadingPlanes } = useQuery({
    queryKey: ["planes_pago"],
    queryFn: () => base44.entities.PlanPago.list(),
    enabled: !!user
  });

  const { data: cuotas = [], isLoading: loadingCuotas } = useQuery({
    queryKey: ["cuotas_pago"],
    queryFn: () => base44.entities.CuotaPago.list(),
    enabled: !!user
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!user
  });

  const isAdmin = user?.role === "admin";

  // Filtrar por comercial si no es admin
  const planesFiltrados = isAdmin
    ? planes
    : planes.filter((p) => p.comercial_email === user?.email);

  // Planes activos con su próxima cuota pendiente
  const planesActivos = planesFiltrados.filter(p => p.estado === "activo");
  const planesFinalizados = planesFiltrados.filter(p => p.estado === "finalizado");

  // Cuotas pendientes: la más próxima por plan
  const cuotasPendientes = cuotas.filter(c => c.estado === "pendiente");
  const cuotasPagadas = cuotas.filter(c => c.estado === "pagado");

  const cuotaPorPlan = {};
  cuotasPendientes.forEach((c) => {
    if (!cuotaPorPlan[c.plan_pago_id] || c.fecha_vencimiento < cuotaPorPlan[c.plan_pago_id].fecha_vencimiento) {
      cuotaPorPlan[c.plan_pago_id] = c;
    }
  });

  // Planes activos que tienen cuota pendiente
  const planesConCuota = planesActivos
    .filter((p) => cuotaPorPlan[p.id])
    .sort((a, b) => {
      const fa = cuotaPorPlan[a.id]?.fecha_vencimiento || "";
      const fb = cuotaPorPlan[b.id]?.fecha_vencimiento || "";
      return fa.localeCompare(fb);
    });

  const planesOrdenados = clienteIdDestacado
    ? [
        ...planesConCuota.filter((p) => p.cliente_id === clienteIdDestacado),
        ...planesConCuota.filter((p) => p.cliente_id !== clienteIdDestacado)
      ]
    : planesConCuota;

  const planesTrimestrales = planesOrdenados.filter((p) => p.frecuencia_pago === "trimestral");
  const planesAdelantados = planesOrdenados.filter((p) => p.frecuencia_pago === "adelantado");

  // Historial: cuotas pagadas agrupadas
  const cuotasPagadasOrdenadas = cuotasPagadas
    .filter(c => {
      const plan = planesFiltrados.find(p => p.id === c.plan_pago_id);
      return !!plan;
    })
    .sort((a, b) => (b.fecha_pago_real || "").localeCompare(a.fecha_pago_real || ""));

  // Planes finalizados (adelantados pagados) que también muestran en pagados
  const planesFinalizadosFiltrados = planesFinalizados.sort((a, b) =>
    (b.fecha_proximo_pago || "").localeCompare(a.fecha_proximo_pago || "")
  );

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
    toast.info("La generación de facturas estará disponible cuando se añadan las plantillas.");
  };

  if (!user || loadingPlanes || loadingCuotas) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-8 h-8 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPagados = cuotasPagadasOrdenadas.length + planesFinalizadosFiltrados.filter(p => !cuotasPagadas.find(c => c.plan_pago_id === p.id)).length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#004D9D]">Suscripciones</h1>
            <p className="text-sm text-gray-500 mt-1">Cola de pagos ordenada por vencimiento</p>
          </div>
          <Button
            onClick={() => setShowActivarDialog(true)}
            className="bg-[#004D9D] hover:bg-[#003d7a] gap-2"
          >
            <Plus className="w-4 h-4" />
            Activar plan
          </Button>
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
            <p className="text-2xl font-bold text-emerald-600">{cuotasPagadasOrdenadas.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pagados</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="trimestral">
          <TabsList className="w-full bg-white border border-gray-100 shadow-sm mb-4 rounded-xl p-1">
            <TabsTrigger value="trimestral" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-[#004D9D] data-[state=active]:text-white rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              Trimestral
              {planesTrimestrales.length > 0 && (
                <Badge className="bg-[#004D9D]/20 text-[#004D9D] text-xs px-1.5 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {planesTrimestrales.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="adelantado" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-[#004D9D] data-[state=active]:text-white rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Adelantado
              {planesAdelantados.length > 0 && (
                <Badge className="bg-[#004D9D]/20 text-[#004D9D] text-xs px-1.5">
                  {planesAdelantados.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagados" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg">
              <History className="w-3.5 h-3.5" />
              Pagados
              {cuotasPagadasOrdenadas.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 text-xs px-1.5">
                  {cuotasPagadasOrdenadas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trimestral">
            {planesTrimestrales.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay pagos trimestrales pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {planesTrimestrales.map((plan, idx) => (
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
            )}
          </TabsContent>

          <TabsContent value="adelantado">
            {planesAdelantados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay pagos adelantados pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {planesAdelantados.map((plan, idx) => (
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
            )}
          </TabsContent>

          <TabsContent value="pagados">
            {cuotasPagadasOrdenadas.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay pagos registrados aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cuotasPagadasOrdenadas.map((cuota) => {
                  const plan = planesFiltrados.find(p => p.id === cuota.plan_pago_id);
                  if (!plan) return null;
                  return (
                    <TarjetaPagada key={cuota.id} plan={plan} cuota={cuota} />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ActivarPlanDialog
        open={showActivarDialog}
        onClose={() => setShowActivarDialog(false)}
        clientes={clientes}
      />
    </div>
  );
}