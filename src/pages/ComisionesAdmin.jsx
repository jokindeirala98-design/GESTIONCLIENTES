import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Building2, User, Calendar, FileText, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

export default function ComisionesAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [comercialSeleccionado, setComercialSeleccionado] = useState("todos");
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("Dashboard"));
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [navigate]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas'],
    queryFn: () => base44.entities.Factura.list('-created_date'),
  });

  const marcarFacturaRevisadaMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Factura.update(id, { estado: "revisada" }),
    onSuccess: () => {
      queryClient.invalidateQueries(['facturas']);
      toast.success("Factura marcada como revisada");
    },
  });

  const deleteFacturaMutation = useMutation({
    mutationFn: async (factura) => {
      // Solo eliminar la factura - los suministros se recalcularán automáticamente
      await base44.entities.Factura.delete(factura.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['facturas']);
      toast.success("Factura eliminada y comisiones restauradas");
    },
  });

  if (!user) return null;

  // Filtrar comerciales (no admins)
  const comerciales = usuarios.filter(u => u.role === 'user');

  // Obtener todos los suministros cerrados y aprobados
  const clientesCerrados = clientes.filter(c => c.aprobado_admin === true);

  // Extraer todos los suministros cerrados con información del comercial
  const suministrosCerrados = clientesCerrados.flatMap(cliente => 
    (cliente.suministros || [])
      .filter(s => s.cerrado && s.comision)
      .map(s => ({
        ...s,
        clienteNombre: cliente.nombre_negocio,
        clienteId: cliente.id,
        comercialEmail: cliente.propietario_email,
        comercialIniciales: cliente.propietario_iniciales
      }))
  );

  // Filtrar por comercial si está seleccionado
  const suministrosFiltrados = comercialSeleccionado === "todos"
    ? suministrosCerrados
    : suministrosCerrados.filter(s => s.comercialEmail === comercialSeleccionado);

  // Filtros por mes y año
  const suministrosDelMes = suministrosFiltrados.filter(
    s => s.mes_comision_suministro === mesSeleccionado
  );

  const suministrosDelAño = suministrosFiltrados.filter(s => {
    const año = s.mes_comision_suministro?.split('-')[0];
    return año === añoSeleccionado;
  });

  const totalMes = suministrosDelMes.reduce((sum, s) => sum + (s.comision || 0), 0);
  const totalAño = suministrosDelAño.reduce((sum, s) => sum + (s.comision || 0), 0);

  // Meses y años disponibles
  const mesesDisponibles = [...new Set(suministrosFiltrados.map(s => s.mes_comision_suministro))]
    .filter(Boolean)
    .sort()
    .reverse();

  const añosDisponibles = [...new Set(suministrosCerrados.map(s => s.mes_comision_suministro?.split('-')[0]))]
    .filter(Boolean)
    .sort()
    .reverse();

  // Cálculos por comercial para la vista de resumen
  const datosPorComercial = comerciales.map(comercial => {
    const suministrosComercial = suministrosCerrados.filter(
      s => s.comercialEmail === comercial.email
    );
    
    const suministrosComercialMes = suministrosComercial.filter(
      s => s.mes_comision_suministro === mesSeleccionado
    );
    
    const suministrosComercialAño = suministrosComercial.filter(s => {
      const año = s.mes_comision_suministro?.split('-')[0];
      return año === añoSeleccionado;
    });

    return {
      email: comercial.email,
      nombre: comercial.full_name,
      iniciales: comercial.iniciales || comercial.full_name?.substring(0, 3).toUpperCase(),
      totalMes: suministrosComercialMes.reduce((sum, s) => sum + (s.comision || 0), 0),
      totalAño: suministrosComercialAño.reduce((sum, s) => sum + (s.comision || 0), 0),
      cantidadMes: suministrosComercialMes.length,
      cantidadAño: suministrosComercialAño.length,
    };
  }).filter(c => c.totalAño > 0 || c.totalMes > 0); // Solo mostrar comerciales con comisiones

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

  // Agrupar suministros por mes para el histórico anual
  const suministrosPorMesAño = {};
  suministrosDelAño.forEach(s => {
    const mes = s.mes_comision_suministro;
    if (!suministrosPorMesAño[mes]) {
      suministrosPorMesAño[mes] = [];
    }
    suministrosPorMesAño[mes].push(s);
  });

  const mesesDelAño = Object.keys(suministrosPorMesAño).sort().reverse();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <DollarSign className="w-8 h-8" />
          Comisiones - Panel Admin
        </h1>
        <p className="text-[#666666]">
          Gestión de comisiones de todos los comerciales
        </p>
      </div>

      {/* Filtro de comercial */}
      <Card className="border-none shadow-md mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <User className="w-5 h-5 text-[#004D9D]" />
            <Select value={comercialSeleccionado} onValueChange={setComercialSeleccionado}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los comerciales</SelectItem>
                {comerciales.map(comercial => (
                  <SelectItem key={comercial.email} value={comercial.email}>
                    {comercial.full_name} ({comercial.iniciales || 'n/s'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vista de resumen por comerciales */}
      {comercialSeleccionado === "todos" && (
        <Card className="border-none shadow-md mb-6">
          <CardHeader>
            <CardTitle className="text-[#004D9D]">Resumen por Comercial</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4">
              {datosPorComercial.map(comercial => {
                const facturasPendientes = facturas.filter(f => 
                  f.comercial_email === comercial.email && f.estado === "pendiente_revision"
                );
                
                return (
                  <Card 
                    key={comercial.email}
                    className="cursor-pointer hover:shadow-lg transition-shadow border-2"
                    onClick={() => setComercialSeleccionado(comercial.email)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                          <span className="text-white font-bold">{comercial.iniciales}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-[#004D9D]">{comercial.nombre}</p>
                          <p className="text-xs text-[#666666]">Comercial</p>
                        </div>
                        {facturasPendientes.length > 0 && (
                          <Badge className="bg-orange-500 text-white">
                            {facturasPendientes.length} factura(s)
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-[#666666] mb-1">Este mes</p>
                          <p className="text-lg font-bold text-green-600">€{comercial.totalMes.toFixed(2)}</p>
                          <p className="text-xs text-[#666666]">{comercial.cantidadMes} suministros</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-[#666666] mb-1">{añoSeleccionado}</p>
                          <p className="text-lg font-bold text-blue-600">€{comercial.totalAño.toFixed(2)}</p>
                          <p className="text-xs text-[#666666]">{comercial.cantidadAño} suministros</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs para vista mensual y anual */}
      <Tabs defaultValue="mensual" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="mensual">Vista Mensual</TabsTrigger>
          <TabsTrigger value="anual">Vista Anual</TabsTrigger>
        </TabsList>

        {/* Vista Mensual */}
        <TabsContent value="mensual">
          <Card className="border-none shadow-lg mb-6 bg-gradient-to-r from-green-500 to-green-600">
            <CardContent className="p-8">
              <div className="text-center">
                <p className="text-white/90 text-sm mb-2">
                  {comercialSeleccionado === "todos" ? "Total de Todos los Comerciales" : "Total del Comercial"}
                </p>
                <p className="text-5xl font-bold text-white mb-1">
                  €{totalMes.toFixed(2)}
                </p>
                <div className="flex items-center justify-center gap-2 text-white/90 text-sm mt-3">
                  <TrendingUp className="w-4 h-4" />
                  <span>{suministrosDelMes.length} suministro(s) cerrado(s)</span>
                </div>
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
                  {suministrosDelMes.map(suministro => {
                    // Verificar si este suministro está en alguna factura
                    const estaFacturado = facturas.some(f => 
                      f.suministros_incluidos?.some(s => 
                        s.cliente_id === suministro.clienteId && s.suministro_id === suministro.id
                      )
                    );

                    return (
                      <div 
                        key={`${suministro.clienteId}-${suministro.id}`}
                        className={`flex items-center justify-between p-4 rounded-lg hover:bg-gray-100 transition-colors ${
                          estaFacturado ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-[#004D9D]">
                                {suministro.clienteNombre}
                              </p>
                              {estaFacturado && (
                                <Badge className="bg-green-600 text-white text-xs">
                                  ✓ Pagado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#666666]">
                              {suministro.nombre}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {suministro.comercialIniciales}
                              </Badge>
                              {suministro.fecha_cierre_suministro && (
                                <span className="text-xs text-[#666666]">
                                  Cerrado: {format(new Date(suministro.fecha_cierre_suministro), "d 'de' MMMM", { locale: es })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${estaFacturado ? 'text-green-700' : 'text-green-600'}`}>
                            €{suministro.comision.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

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
                    const suministrosMes = suministrosFiltrados.filter(s => s.mes_comision_suministro === mes);
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
        </TabsContent>

        {/* Vista Anual */}
        <TabsContent value="anual">
          <Card className="border-none shadow-md mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-[#004D9D]" />
                <Select value={añoSeleccionado} onValueChange={setAñoSeleccionado}>
                  <SelectTrigger className="w-full md:w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {añosDisponibles.map(año => (
                      <SelectItem key={año} value={año}>
                        Año {año}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg mb-6 bg-gradient-to-r from-blue-500 to-blue-600">
            <CardContent className="p-8">
              <div className="text-center">
                <p className="text-white/90 text-sm mb-2">
                  Total Anual {añoSeleccionado}
                </p>
                <p className="text-5xl font-bold text-white mb-1">
                  €{totalAño.toFixed(2)}
                </p>
                <div className="flex items-center justify-center gap-2 text-white/90 text-sm mt-3">
                  <TrendingUp className="w-4 h-4" />
                  <span>{suministrosDelAño.length} suministro(s) cerrado(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {mesesDelAño.length === 0 ? (
            <Card className="border-none shadow-md">
              <CardContent className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-[#666666]">
                  No hay comisiones en este año
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-md">
              <CardHeader className="border-b">
                <CardTitle className="text-[#004D9D]">Desglose Mensual - {añoSeleccionado}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {mesesDelAño.map(mes => {
                    const suministrosMes = suministrosPorMesAño[mes];
                    const totalMesDet = suministrosMes.reduce((sum, s) => sum + (s.comision || 0), 0);

                    return (
                      <div key={mes} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 p-4 flex items-center justify-between">
                          <h3 className="font-bold text-[#004D9D]">
                            {formatearMes(mes)}
                          </h3>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              €{totalMesDet.toFixed(2)}
                            </p>
                            <p className="text-xs text-[#666666]">
                              {suministrosMes.length} suministro(s)
                            </p>
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          {suministrosMes.map(suministro => {
                            // Verificar si este suministro está en alguna factura
                            const estaFacturado = facturas.some(f => 
                              f.suministros_incluidos?.some(s => 
                                s.cliente_id === suministro.clienteId && s.suministro_id === suministro.id
                              )
                            );

                            return (
                              <div 
                                key={`${suministro.clienteId}-${suministro.id}`}
                                className={`flex items-center justify-between p-3 rounded-lg ${
                                  estaFacturado ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {suministro.comercialIniciales}
                                  </Badge>
                                  <span className="text-sm font-medium text-[#004D9D]">
                                    {suministro.clienteNombre} - {suministro.nombre}
                                  </span>
                                  {estaFacturado && (
                                    <Badge className="bg-green-600 text-white text-xs">
                                      ✓ Pagado
                                    </Badge>
                                  )}
                                </div>
                                <span className={`text-sm font-bold ${estaFacturado ? 'text-green-700' : 'text-green-600'}`}>
                                  €{suministro.comision.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sección de Facturas - Solo cuando hay un comercial seleccionado */}
      {comercialSeleccionado !== "todos" && (
        <Card className="border-none shadow-md mt-6">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Facturas Generadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {(() => {
              const facturasComercial = facturas.filter(f => f.comercial_email === comercialSeleccionado);

              if (facturasComercial.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay facturas generadas por este comercial</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {facturasComercial.map(factura => (
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
                            {factura.estado === "pendiente_revision" && (
                              <Button
                                size="sm"
                                onClick={() => marcarFacturaRevisadaMutation.mutate({ id: factura.id })}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Revisada
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (window.confirm("¿Eliminar esta factura? Las comisiones se restaurarán.")) {
                                  deleteFacturaMutation.mutate(factura);
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
    </div>
  );
}