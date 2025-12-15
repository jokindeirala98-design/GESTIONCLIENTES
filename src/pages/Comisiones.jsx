import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Building2, FileText, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import GenerarFacturaDialog from "../components/comisiones/GenerarFacturaDialog.jsx";

export default function Comisiones() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));
  const [showFacturaDialog, setShowFacturaDialog] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') {
        navigate(createPageUrl("ComisionesAdmin"));
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [navigate]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!user,
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas'],
    queryFn: () => base44.entities.Factura.list('-created_date'),
    enabled: !!user,
  });

  const deleteFacturaMutation = useMutation({
    mutationFn: (id) => base44.entities.Factura.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['facturas']);
      toast.success("Factura eliminada");
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Obtener todos los suministros cerrados del usuario
  const misClientesCerrados = clientes.filter(
    c => c.propietario_email === user.email && c.aprobado_admin === true
  );

  // Extraer todos los suministros cerrados con su información
  const suministrosCerrados = misClientesCerrados.flatMap(cliente => 
    (cliente.suministros || [])
      .filter(s => s.cerrado && s.comision)
      .map(s => ({
        ...s,
        clienteNombre: cliente.nombre_negocio,
        clienteId: cliente.id
      }))
  );

  const suministrosDelMes = suministrosCerrados.filter(
    s => s.mes_comision_suministro === mesSeleccionado
  );

  const totalMes = suministrosDelMes.reduce((sum, s) => sum + (s.comision || 0), 0);

  const mesesDisponibles = [...new Set(suministrosCerrados.map(s => s.mes_comision_suministro))]
    .filter(Boolean)
    .sort()
    .reverse();

  const cambiarMes = (direccion) => {
    const currentIndex = mesesDisponibles.indexOf(mesSeleccionado);
    if (direccion === 'prev' && currentIndex < mesesDisponibles.length - 1) {
      setMesSeleccionado(mesesDisponibles[currentIndex + 1]);
    } else if (direccion === 'next' && currentIndex > 0) {
      setMesSeleccionado(mesesDisponibles[currentIndex - 1]);
    }
  };

  const formatearMes = (mesStr) => {
    if (!mesStr) return "";
    const [year, month] = mesStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy', { locale: es });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <DollarSign className="w-8 h-8" />
          Comisiones
        </h1>
        <p className="text-[#666666]">
          Gestiona tus comisiones mensuales
        </p>
      </div>

      <Card className="border-none shadow-lg mb-6 bg-gradient-to-r from-green-500 to-green-600">
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-white/90 text-sm mb-2">Total del Mes Actual</p>
            <p className="text-5xl font-bold text-white mb-1">
              €{totalMes.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-2 text-white/90 text-sm mt-3">
              <TrendingUp className="w-4 h-4" />
              <span>{suministrosDelMes.length} suministro(s) cerrado(s)</span>
            </div>
            {(user.email === "jokin@voltisenergia.com" || user.email === "jose@voltisenergia.com") && totalMes > 0 && (
              <Button
                onClick={() => setShowFacturaDialog(true)}
                className="mt-4 bg-white text-green-600 hover:bg-gray-100"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar Factura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md mb-6">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="text-[#004D9D]">
            {formatearMes(mesSeleccionado)}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('prev')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === mesesDisponibles.length - 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('next')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {suministrosDelMes.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-[#666666]">
                No hay comisiones en este mes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suministrosDelMes.map(suministro => (
                <div 
                  key={`${suministro.clienteId}-${suministro.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#004D9D]">
                        {suministro.clienteNombre}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {suministro.nombre}
                      </p>
                      {suministro.fecha_cierre_suministro && (
                        <p className="text-xs text-[#666666]">
                          Cerrado: {format(new Date(suministro.fecha_cierre_suministro), "d 'de' MMMM", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      €{suministro.comision.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="mt-6 pt-6 border-t-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-[#666666]">
                    Total del mes
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    €{totalMes.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {mesesDisponibles.length > 0 && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D]">Historial Mensual</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {mesesDisponibles.map(mes => {
                const suministrosMes = suministrosCerrados.filter(s => s.mes_comision_suministro === mes);
                const totalMesHist = suministrosMes.reduce((sum, s) => sum + (s.comision || 0), 0);
                
                return (
                  <button
                    key={mes}
                    onClick={() => setMesSeleccionado(mes)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                      mes === mesSeleccionado 
                        ? 'bg-[#004D9D] text-white' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">
                      {formatearMes(mes)}
                    </span>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${mes === mesSeleccionado ? 'text-white' : 'text-green-600'}`}>
                        €{totalMesHist.toFixed(2)}
                      </p>
                      <p className={`text-xs ${mes === mesSeleccionado ? 'text-white/80' : 'text-[#666666]'}`}>
                        {suministrosMes.length} suministro(s)
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección de Facturas Generadas */}
      {(user.email === "jokin@voltisenergia.com" || user.email === "jose@voltisenergia.com") && (
        <Card className="border-none shadow-md mt-6">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Mis Facturas Generadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {(() => {
              const misFacturas = facturas.filter(f => f.comercial_email === user.email);

              if (misFacturas.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No has generado facturas aún</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {misFacturas.map(factura => (
                    <Card key={factura.id} className={`${
                      factura.estado === "pendiente_revision" ? "border-orange-300 bg-orange-50" : ""
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-[#004D9D]">#{factura.numero_factura}</p>
                              <p className="text-xs text-[#666666]">Factura</p>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">
                                {format(new Date(factura.fecha_creacion), "d 'de' MMMM, yyyy", { locale: es })}
                              </p>
                              <p className="text-sm text-[#666666]">
                                Mes: {format(new Date(factura.mes_comision + '-01'), 'MMMM yyyy', { locale: es })}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={
                                  factura.estado === "pendiente_revision" 
                                    ? "bg-orange-500 text-white"
                                    : "bg-green-500 text-white"
                                }>
                                  {factura.estado === "pendiente_revision" ? "Pendiente revisión" : "Revisada"}
                                </Badge>
                                <span className="text-lg font-bold text-green-600">
                                  €{factura.importe_total.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(factura.pdf_url, '_blank')}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Descargar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (window.confirm("¿Eliminar esta factura?")) {
                                  deleteFacturaMutation.mutate(factura.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <GenerarFacturaDialog
        open={showFacturaDialog}
        onClose={() => setShowFacturaDialog(false)}
        mesSeleccionado={mesSeleccionado}
        totalMes={totalMes}
        user={user}
      />
    </div>
  );
}