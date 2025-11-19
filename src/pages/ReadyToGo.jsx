import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Building2, MapPin, FileText, Download, DollarSign, Clock, Filter } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReadyToGo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [soloMisClientes, setSoloMisClientes] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ clienteId, nuevoEstado, cliente }) => {
      const updateData = { estado: nuevoEstado };
      
      // Si es "Pendiente de aprobación", añadir fecha y mes de comisión
      if (nuevoEstado === "Pendiente de aprobación") {
        const fechaCierre = new Date().toISOString().split('T')[0];
        const mesComision = fechaCierre.substring(0, 7);
        updateData.fecha_cierre = fechaCierre;
        updateData.mes_comision = mesComision;
        updateData.aprobado_admin = false;
      }
      
      await base44.entities.Cliente.update(clienteId, updateData);
      
      // Si es "Pendiente de aprobación", notificar a admins
      if (nuevoEstado === "Pendiente de aprobación") {
        await base44.integrations.Core.SendEmail({
          to: "admin@voltis.com",
          subject: `🎉 Nuevo cierre para verificar: ${cliente.nombre_negocio}`,
          body: `El comercial ${cliente.propietario_iniciales} ha marcado como "Firmado con éxito" al cliente "${cliente.nombre_negocio}".\n\nComisión total: ${cliente.comision}€\n\nPor favor, verifica y aprueba este cierre en: ${window.location.origin}${createPageUrl("CierresVerificados")}`
        });
      }
      
      return updateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Estado actualizado");
    },
  });

  const handleCambiarEstado = (cliente, nuevoEstado) => {
    if (nuevoEstado === "Pendiente de aprobación") {
      if (!window.confirm(`¿Confirmas que "${cliente.nombre_negocio}" ha firmado con éxito? Esto enviará el cierre a verificación por los administradores.`)) {
        return;
      }
    }
    
    if (nuevoEstado === "Rechazado") {
      if (!window.confirm(`¿Marcar "${cliente.nombre_negocio}" como rechazado? El cliente desaparecerá de Ready to Go.`)) {
        return;
      }
    }
    
    updateStatusMutation.mutate({ clienteId: cliente.id, nuevoEstado, cliente });
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Clientes con "Informe listo", "Pendiente de firma" O "Pendiente de aprobación"
  const clientesReady = clientes.filter(c => 
    c.estado === "Informe listo" || 
    c.estado === "Pendiente de firma" ||
    c.estado === "Pendiente de aprobación"
  );

  // Filtrar por propietario solo si el toggle está activado
  const misClientesReady = soloMisClientes 
    ? clientesReady.filter(c => c.propietario_email === user.email)
    : clientesReady;

  // Función para obtener el tipo máximo de factura
  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  // ORDENAR POR PRIORIDAD: Pendiente de aprobación primero, luego 6.1 > 3.0 > 2.0, luego por estado
  const tipoFacturaOrder = { "6.1": 1, "3.0": 2, "2.0": 3 };
  const estadoOrder = { 
    "Pendiente de aprobación": 0,
    "Informe listo": 1, 
    "Pendiente de firma": 2 
  };
  
  const clientesOrdenados = [...misClientesReady].sort((a, b) => {
    // Primero ordenar por estado (Pendiente de aprobación primero)
    const estadoA = estadoOrder[a.estado];
    const estadoB = estadoOrder[b.estado];
    if (estadoA !== estadoB) return estadoA - estadoB;

    // Luego por tipo de factura
    const orderA = tipoFacturaOrder[getTipoMaximo(a)] || 999;
    const orderB = tipoFacturaOrder[getTipoMaximo(b)] || 999;
    return orderA - orderB;
  });

  // Agrupar por zona
  const clientesPorZona = clientesOrdenados.reduce((acc, cliente) => {
    const zona = zonas.find(z => z.id === cliente.zona_id);
    const zonaNombre = zona?.nombre || "Sin zona";
    
    if (!acc[zonaNombre]) {
      acc[zonaNombre] = [];
    }
    acc[zonaNombre].push(cliente);
    return acc;
  }, {});

  const zonasOrdenadas = Object.keys(clientesPorZona);

  const tipoColors = {
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white"
  };

  // Contadores por estado
  const informesListos = misClientesReady.filter(c => c.estado === "Informe listo").length;
  const pendientesFirma = misClientesReady.filter(c => c.estado === "Pendiente de firma").length;
  const pendientesAprobacion = misClientesReady.filter(c => c.estado === "Pendiente de aprobación").length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
              <CheckCircle className="w-8 h-8" />
              Ready to Go
            </h1>
            <p className="text-[#666666]">
              Clientes listos para presentar y cerrar - visión completa para planificar rutas
            </p>
          </div>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-[#004D9D]" />
              <div className="flex items-center gap-2">
                <Switch
                  id="solo-mis-clientes"
                  checked={soloMisClientes}
                  onCheckedChange={setSoloMisClientes}
                />
                <Label htmlFor="solo-mis-clientes" className="text-sm font-medium cursor-pointer">
                  Solo mis clientes
                </Label>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Resumen con tres cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-l-4 border-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">📄 Informes listos</p>
                <p className="text-4xl font-bold text-green-600">{informesListos}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">⏳ Pendientes de firma</p>
                <p className="text-4xl font-bold text-orange-600">{pendientesFirma}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-emerald-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">✅ Firmados (pendiente admin)</p>
                <p className="text-4xl font-bold text-emerald-600">{pendientesAprobacion}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clientes por zona */}
      {zonasOrdenadas.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">No hay clientes listos</p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando tengan informes listos para presentar
            </p>
          </CardContent>
        </Card>
      ) : (
        zonasOrdenadas.map(zonaNombre => (
          <div key={zonaNombre} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-6 h-6 text-[#004D9D]" />
              <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
              <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
            </div>

            <div className="space-y-4">
              {clientesPorZona[zonaNombre].map(cliente => {
                const esMio = cliente.propietario_email === user.email;
                const puedoActualizar = esMio || isAdmin;
                const tipoMax = getTipoMaximo(cliente);
                const isPendienteFirma = cliente.estado === "Pendiente de firma";
                const isPendienteAprobacion = cliente.estado === "Pendiente de aprobación";
                const isInformeListo = cliente.estado === "Informe listo";
                
                const borderColor = isPendienteAprobacion ? "border-emerald-500" : 
                                   isPendienteFirma ? "border-orange-500" : "border-green-500";
                const bgColor = isPendienteAprobacion ? "bg-emerald-50" : 
                               isPendienteFirma ? "bg-orange-50" : "bg-green-50";

                return (
                  <Card 
                    key={cliente.id}
                    className={`hover:shadow-lg transition-all duration-300 border-l-4 ${borderColor}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1">
                          <div 
                            className="flex items-start gap-3 mb-3 cursor-pointer"
                            onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                          >
                            <Building2 className="w-6 h-6 text-[#004D9D] flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h3 className="font-bold text-[#004D9D] text-lg mb-1 hover:underline">
                                {cliente.nombre_negocio}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-600">{cliente.propietario_iniciales || 'n/s'}</span>
                                
                                {/* Badge de estado */}
                                {isPendienteAprobacion ? (
                                  <Badge className="bg-emerald-600 text-white">
                                    ✅ Firmado - Pendiente admin
                                  </Badge>
                                ) : isPendienteFirma ? (
                                  <Badge className="bg-orange-600 text-white">
                                    ⏳ Pendiente de firma
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-600 text-white">
                                    ✓ Informe listo
                                  </Badge>
                                )}
                                
                                {tipoMax && (
                                  <Badge className={tipoColors[tipoMax]}>
                                    Max: {tipoMax}
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {cliente.suministros?.length || 0} suministro(s)
                                </Badge>
                                {cliente.comision && (
                                  <Badge className="bg-yellow-600 text-white">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    {cliente.comision}€
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Suministros con informes */}
                          {cliente.suministros && cliente.suministros.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className={`w-4 h-4 ${
                                  isPendienteAprobacion ? "text-emerald-600" :
                                  isPendienteFirma ? "text-orange-600" : "text-green-600"
                                }`} />
                                <p className={`text-sm font-semibold ${
                                  isPendienteAprobacion ? "text-emerald-700" :
                                  isPendienteFirma ? "text-orange-700" : "text-green-700"
                                }`}>
                                  Informes disponibles:
                                </p>
                              </div>
                              {cliente.suministros.map(suministro => (
                                <div key={suministro.id} className={`${bgColor} border ${
                                  isPendienteAprobacion ? "border-emerald-200" :
                                  isPendienteFirma ? "border-orange-200" : "border-green-200"
                                } rounded-lg p-3`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Badge className={tipoColors[suministro.tipo_factura]} variant="outline">
                                        {suministro.tipo_factura}
                                      </Badge>
                                      <span className="text-sm font-medium text-gray-700 truncate">{suministro.nombre}</span>
                                      {suministro.comision && (
                                        <span className={`text-sm font-semibold ${
                                          isPendienteAprobacion ? "text-emerald-600" :
                                          isPendienteFirma ? "text-orange-600" : "text-green-600"
                                        }`}>
                                          ({suministro.comision}€)
                                        </span>
                                      )}
                                    </div>
                                    {suministro.informe_final ? (
                                      suministro.informe_final.archivos && suministro.informe_final.archivos.length > 0 ? (
                                        <div className="flex gap-2">
                                          {suministro.informe_final.archivos.map((archivo, idx) => (
                                            <a
                                              key={idx}
                                              href={archivo.url}
                                              download={archivo.nombre}
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex-shrink-0"
                                            >
                                              <Button
                                                size="sm"
                                                className={
                                                  isPendienteAprobacion ? "bg-emerald-600 hover:bg-emerald-700" :
                                                  isPendienteFirma ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"
                                                }
                                              >
                                                <Download className="w-4 h-4 mr-1" />
                                                {idx === 0 ? "PDF 1" : "PDF 2"}
                                              </Button>
                                            </a>
                                          ))}
                                        </div>
                                      ) : (
                                        <a
                                          href={suministro.informe_final.url}
                                          download={suministro.informe_final.nombre}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            size="sm"
                                            className={
                                              isPendienteAprobacion ? "bg-emerald-600 hover:bg-emerald-700" :
                                              isPendienteFirma ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"
                                            }
                                          >
                                            <Download className="w-4 h-4 mr-1" />
                                            Descargar
                                          </Button>
                                        </a>
                                      )
                                    ) : (
                                      <Badge variant="outline" className="text-red-600 border-red-300 flex-shrink-0">
                                        Sin informe
                                      </Badge>
                                    )}
                                  </div>
                                  {suministro.informe_final && (
                                    suministro.informe_final.archivos && suministro.informe_final.archivos.length > 0 ? (
                                      <div className="text-xs text-gray-500 mt-1 space-y-1">
                                        {suministro.informe_final.archivos.map((archivo, idx) => (
                                          <p key={idx}>📄 {archivo.nombre}</p>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500 mt-1">
                                        📄 {suministro.informe_final.nombre}
                                      </p>
                                    )
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {puedoActualizar && (
                          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-sm font-semibold text-gray-600 mb-1">Cambiar estado:</p>
                            <Select
                              value={cliente.estado}
                              onValueChange={(value) => handleCambiarEstado(cliente, value)}
                              disabled={isPendienteAprobacion && !isAdmin}
                            >
                              <SelectTrigger className="w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Informe listo">✓ Informe listo</SelectItem>
                                <SelectItem value="Pendiente de firma">⏳ Pendiente de firma</SelectItem>
                                <SelectItem value="Pendiente de aprobación">🎉 Firmado con éxito</SelectItem>
                                <SelectItem value="Rechazado">❌ Rechazado</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {isPendienteFirma && (
                              <p className="text-xs text-orange-600 mt-1">
                                💡 Esperando firma del cliente
                              </p>
                            )}
                            
                            {isPendienteAprobacion && (
                              <p className="text-xs text-emerald-600 mt-1">
                                ⏳ Esperando aprobación del admin
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}