import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Building2, MapPin, FileText, Download, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
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

  // Rechazar automáticamente clientes pendientes de firma con más de 30 días
  useEffect(() => {
    const verificarAutoRechazo = async () => {
      if (!clientes || clientes.length === 0) return;

      const ahora = new Date();
      const clientesARechazar = clientes.filter(c => {
        if (c.estado !== "Pendiente de firma") return false;
        if (!c.fecha_cambio_pendiente_firma) return false;

        const fechaCambio = new Date(c.fecha_cambio_pendiente_firma);
        const diasTranscurridos = Math.floor((ahora - fechaCambio) / (1000 * 60 * 60 * 24));
        
        return diasTranscurridos >= 30;
      });

      if (clientesARechazar.length > 0) {
        for (const cliente of clientesARechazar) {
          try {
            await base44.entities.Cliente.update(cliente.id, { 
              estado: "Rechazado",
              anotaciones: (cliente.anotaciones || '') + `\n[Auto-rechazado: ${ahora.toLocaleDateString('es-ES')} - Más de 30 días en Pendiente de firma]`
            });
          } catch (error) {
            console.error(`Error al rechazar cliente ${cliente.id}:`, error);
          }
        }
        
        queryClient.invalidateQueries(['clientes']);
        toast.info(`${clientesARechazar.length} cliente(s) auto-rechazado(s) por inactividad`);
      }
    };

    verificarAutoRechazo();
  }, [clientes?.length, queryClient]);

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ clienteId, nuevoEstado, cliente }) => {
      const updateData = { estado: nuevoEstado };
      
      if (nuevoEstado === "Pendiente de firma") {
        updateData.fecha_cambio_pendiente_firma = new Date().toISOString().split('T')[0];
      }
      
      if (nuevoEstado === "Pendiente de aprobación") {
        const fechaCierre = new Date().toISOString().split('T')[0];
        const mesComision = fechaCierre.substring(0, 7);
        updateData.fecha_cierre = fechaCierre;
        updateData.mes_comision = mesComision;
        updateData.aprobado_admin = false;
      }
      
      await base44.entities.Cliente.update(clienteId, updateData);
      
      if (nuevoEstado === "Pendiente de aprobación") {
        await base44.integrations.Core.SendEmail({
          to: "admin@voltis.com",
          subject: `🎉 Nuevo cierre para verificar: ${cliente.nombre_negocio}`,
          body: `El comercial ${cliente.propietario_iniciales} ha marcado como "Firmado con éxito" al cliente "${cliente.nombre_negocio}".\n\nComisión total: ${cliente.comision}€\n\nPor favor, verifica y aprueba este cierre en: ${window.location.origin}${createPageUrl("CierresVerificados")}`
        });
      }
      
      return { clienteId, updateData };
    },
    onSuccess: ({ clienteId, updateData }) => {
      // Actualizar el caché inmediatamente
      queryClient.setQueryData(['clientes'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(c => 
          c.id === clienteId ? { ...c, ...updateData } : c
        );
      });
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

  // Helper unificado: obtener archivos descargables (ACEPTA CUALQUIER NOMBRE)
  const getArchivosValidos = (suministro) => {
    if (!suministro || !suministro.informe_final) return [];

    const informe = suministro.informe_final;

    // Formato nuevo: { informe_final: { archivos: [...] } }
    if (Array.isArray(informe.archivos)) {
      return informe.archivos
        .filter((a) => a && a.url && a.url.trim() !== "" && a.url !== "null")
        .map((a, idx) => ({
          url: a.url,
          nombre: a.nombre || `Informe ${idx + 1}`,
        }));
    }

    // Formato legacy: { informe_final: { url: "..." } }
    if (informe.url && informe.url.trim() !== "" && informe.url !== "null") {
      return [
        {
          url: informe.url,
          nombre: informe.nombre || "Informe Final",
        },
      ];
    }

    // Caso extremo: informe_final es string directo
    if (typeof informe === "string" && informe.trim() !== "" && informe !== "null") {
      return [{ url: informe, nombre: "Informe Final" }];
    }

    return [];
  };

  // FUNCIÓN CRÍTICA: Validar si un suministro tiene informe válido
  const tieneInformeValido = (suministro) => {
    const archivos = getArchivosValidos(suministro);
    return archivos.length > 0;
  };

  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  const misClientesReady = clientes.filter(c => {
    const estadosReady = c.estado === "Informe listo" || 
                         c.estado === "Pendiente de firma" ||
                         c.estado === "Pendiente de aprobación";
    
    if (isAdmin) {
      return estadosReady;
    } else {
      return estadosReady && c.propietario_email === user.email;
    }
  });

  const tipoFacturaOrder = { "6.1": 1, "3.0": 2, "2.0": 3 };
  const estadoOrder = { 
    "Pendiente de aprobación": 0,
    "Informe listo": 1, 
    "Pendiente de firma": 2 
  };
  
  const clientesOrdenados = [...misClientesReady].sort((a, b) => {
    const estadoA = estadoOrder[a.estado];
    const estadoB = estadoOrder[b.estado];
    if (estadoA !== estadoB) return estadoA - estadoB;

    const orderA = tipoFacturaOrder[getTipoMaximo(a)] || 999;
    const orderB = tipoFacturaOrder[getTipoMaximo(b)] || 999;
    return orderA - orderB;
  });

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
              {isAdmin ? 'Todos los clientes listos para presentar y cerrar' : 'Tus clientes listos para presentar y cerrar'}
            </p>
          </div>
        </div>
      </div>

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
        zonasOrdenadas.map(zonaNombre => {
          const zona = zonas.find(z => z.nombre === zonaNombre);
          const otrosComerciales = zona ? clientes.filter(c => 
            c.zona_id === zona.id && 
            c.propietario_email !== user.email &&
            (c.estado === "Informe listo" || 
             c.estado === "Pendiente de firma" || 
             c.estado === "Facturas presentadas")
          ) : [];

          const porComercial = otrosComerciales.reduce((acc, c) => {
            const iniciales = c.propietario_iniciales || 'n/s';
            if (!acc[iniciales]) {
              acc[iniciales] = { informeListo: 0, facturasPresentadas: 0, pendienteFirma: 0 };
            }
            if (c.estado === "Informe listo") acc[iniciales].informeListo++;
            if (c.estado === "Facturas presentadas") acc[iniciales].facturasPresentadas++;
            if (c.estado === "Pendiente de firma") acc[iniciales].pendienteFirma++;
            return acc;
          }, {});

          return (
            <div key={zonaNombre} className="mb-8">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <MapPin className="w-6 h-6 text-[#004D9D]" />
                <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
                <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>

                {Object.keys(porComercial).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(porComercial).map(([iniciales, counts]) => (
                      <Badge key={iniciales} className="bg-orange-100 text-orange-700 border border-orange-300">
                        👤 {iniciales} tiene {
                          [
                            counts.informeListo > 0 && `${counts.informeListo} informe${counts.informeListo > 1 ? 's' : ''} listo${counts.informeListo > 1 ? 's' : ''}`,
                            counts.pendienteFirma > 0 && `${counts.pendienteFirma} pendiente${counts.pendienteFirma > 1 ? 's' : ''} de firma`,
                            counts.facturasPresentadas > 0 && `${counts.facturasPresentadas} factura${counts.facturasPresentadas > 1 ? 's' : ''} presentada${counts.facturasPresentadas > 1 ? 's' : ''}`
                          ].filter(Boolean).join(' y ')
                        }
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {clientesPorZona[zonaNombre].map(cliente => {
                  const esMio = cliente.propietario_email === user.email;
                  const puedoActualizar = esMio || isAdmin;
                  const tipoMax = getTipoMaximo(cliente);
                  const isPendienteFirma = cliente.estado === "Pendiente de firma";
                  const isPendienteAprobacion = cliente.estado === "Pendiente de aprobación";
                  
                  const borderColor = isPendienteAprobacion ? "border-emerald-500" : 
                                     isPendienteFirma ? "border-orange-500" : "border-green-500";
                  const bgColor = isPendienteAprobacion ? "bg-emerald-50" : 
                                 isPendienteFirma ? "bg-orange-50" : "bg-green-50";

                  return (
                    <Card 
                      key={cliente.id}
                      className={`hover:shadow-lg transition-all duration-300 border-l-4 ${borderColor}`}
                    >
                      <CardContent className="p-4 md:p-6">
                        {/* Header del cliente */}
                        <div 
                          className="cursor-pointer mb-4"
                          onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-5 h-5 text-[#004D9D]" />
                            <h3 className="font-bold text-[#004D9D] text-base md:text-lg hover:underline">
                              {cliente.nombre_negocio}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xs text-gray-600 font-medium">{cliente.propietario_iniciales || 'n/s'}</span>
                            
                            {isPendienteAprobacion ? (
                              <Badge className="bg-emerald-600 text-white text-xs">
                                ✅ Firmado
                              </Badge>
                            ) : isPendienteFirma ? (
                              <Badge className="bg-orange-600 text-white text-xs">
                                ⏳ Pend. firma
                              </Badge>
                            ) : (
                              <Badge className="bg-green-600 text-white text-xs">
                                ✓ Listo
                              </Badge>
                            )}
                            
                            {tipoMax && (
                              <Badge className={`${tipoColors[tipoMax]} text-xs`}>
                                {tipoMax}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {cliente.suministros?.length || 0} sum.
                            </Badge>
                            {cliente.comision && (
                              <Badge className="bg-yellow-600 text-white text-xs">
                                <DollarSign className="w-3 h-3 mr-1" />
                                {cliente.comision}€
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Suministros e Informes */}
                        {cliente.suministros && cliente.suministros.filter(s => !s.cerrado).length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className={`w-4 h-4 ${
                                isPendienteAprobacion ? "text-emerald-600" :
                                isPendienteFirma ? "text-orange-600" : "text-green-600"
                              }`} />
                              <p className={`text-xs md:text-sm font-semibold ${
                                isPendienteAprobacion ? "text-emerald-700" :
                                isPendienteFirma ? "text-orange-700" : "text-green-700"
                              }`}>
                                Informes:
                              </p>
                            </div>
                            
                            {cliente.suministros.filter(s => !s.cerrado).map(suministro => {
                              const archivosValidos = getArchivosValidos(suministro);
                              const informeValido = archivosValidos.length > 0;
                              
                              return (
                                <div key={suministro.id} className={`${bgColor} border ${
                                  isPendienteAprobacion ? "border-emerald-200" :
                                  isPendienteFirma ? "border-orange-200" : "border-green-200"
                                } rounded-lg p-3`}>
                                  {/* Info del suministro */}
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge className={`${tipoColors[suministro.tipo_factura]} text-xs`}>
                                      {suministro.tipo_factura}
                                    </Badge>
                                    <span className="text-xs md:text-sm font-medium text-gray-700">{suministro.nombre}</span>
                                    {suministro.comision && (
                                      <Badge className={`text-xs ${
                                        isPendienteAprobacion ? "bg-emerald-100 text-emerald-700" :
                                        isPendienteFirma ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                                      }`}>
                                        {suministro.comision}€
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Botones de descarga */}
                                  {informeValido ? (
                                    <div className="flex flex-col gap-2">
                                      {archivosValidos.map((archivo, idx) => (
                                        <a
                                          key={idx}
                                          href={archivo.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          download
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            size="sm"
                                            className={`w-full text-xs ${
                                              isPendienteAprobacion ? "bg-emerald-600 hover:bg-emerald-700" :
                                              isPendienteFirma ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"
                                            }`}
                                          >
                                            <Download className="w-3 h-3 mr-1" />
                                            {archivo.nombre}
                                          </Button>
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                                      Sin informe
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Cambiar estado */}
                        {puedoActualizar && (
                          <div className="mt-4 pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs md:text-sm font-semibold text-gray-600 mb-2">Cambiar estado:</p>
                            <Select
                              value={cliente.estado}
                              onValueChange={(value) => handleCambiarEstado(cliente, value)}
                              disabled={isPendienteAprobacion && !isAdmin}
                            >
                              <SelectTrigger className="w-full">
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
                              <p className="text-xs text-orange-600 mt-2">
                                💡 Esperando firma del cliente
                              </p>
                            )}
                            
                            {isPendienteAprobacion && (
                              <p className="text-xs text-emerald-600 mt-2">
                                ⏳ Esperando aprobación del admin
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}