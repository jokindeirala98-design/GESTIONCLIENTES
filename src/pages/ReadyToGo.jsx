import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Building2, MapPin, FileText, Download, DollarSign, Clock, StickyNote, Eye, FileCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const { data: documentosCliente = [] } = useQuery({
    queryKey: ['documentosCliente'],
    queryFn: () => base44.entities.DocumentosCliente.list(),
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

  // Helper: obtener documento del cliente
  const getDocumentoCliente = (clienteId) => {
    return documentosCliente.find(d => d.cliente_id === clienteId);
  };

  // Helper: verificar si tiene informe final
  const tieneInformeFinal = (suministro) => {
    if (!suministro.informe_final) return false;
    if (Array.isArray(suministro.informe_final?.archivos)) {
      return suministro.informe_final.archivos.some(a => a?.url && a.url !== "null");
    }
    return suministro.informe_final?.url && suministro.informe_final.url !== "null";
  };

  // SECCIÓN 1: Clientes para visitar CON INFORME FINAL (verde)
  const clientesParaVisitarCompletos = clientes.filter(c => {
    if (c.estado !== "Informe listo") return false;
    if (!isAdmin && c.propietario_email !== user.email) return false;
    
    const suministrosNoLuz20 = c.suministros?.filter(s => s.tipo_factura !== "2.0") || [];
    return suministrosNoLuz20.every(s => tieneInformeFinal(s));
  });

  // SECCIÓN 1B: Clientes para visitar SOLO CON POTENCIAS (amarillo)
  const clientesParaVisitarPotencias = clientes.filter(c => {
    if (c.estado !== "Informe listo") return false;
    if (!isAdmin && c.propietario_email !== user.email) return false;
    
    const suministrosNoLuz20 = c.suministros?.filter(s => s.tipo_factura !== "2.0") || [];
    return suministrosNoLuz20.some(s => (s.informe_potencias?.url || s.potencias_ignorado) && !tieneInformeFinal(s));
  });

  const clientesParaVisitar = [...clientesParaVisitarCompletos, ...clientesParaVisitarPotencias];

  // SECCIÓN 2: Clientes pendientes de estudio (estado "Facturas presentadas" sin informes)
  const clientesPendientesEstudio = clientes.filter(c => {
    if (c.estado !== "Facturas presentadas") return false;
    if (!isAdmin && c.propietario_email !== user.email) return false;
    
    const suministrosNoLuz20 = c.suministros?.filter(s => s.tipo_factura !== "2.0") || [];
    return suministrosNoLuz20.some(s => s.facturas?.length > 0 && !s.informe_potencias?.url);
  });

  // SECCIÓN 3: Contratos CON CONTRATO ADJUNTADO (verde)
  const contratosConArchivo = clientes.filter(c => {
    if (!isAdmin && c.propietario_email !== user.email) return false;
    const doc = getDocumentoCliente(c.id);
    return doc?.iban && c.contrato_original_url;
  });

  // SECCIÓN 3B: Contratos CON IBAN PERO SIN CONTRATO (amarillo)
  const contratosIbanSinArchivo = clientes.filter(c => {
    if (!isAdmin && c.propietario_email !== user.email) return false;
    const doc = getDocumentoCliente(c.id);
    return doc?.iban && !c.contrato_original_url;
  });

  const contractosPendienteFirma = [...contratosConArchivo, ...contratosIbanSinArchivo];

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

  // SECCIÓN 4: Clientes pendientes de firma
  const clientesPendientesFirma = clientes.filter(c => {
    if (c.estado !== "Pendiente de firma") return false;
    if (!isAdmin && c.propietario_email !== user.email) return false;
    return true;
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
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle className="w-8 h-8" />
          Ready to Go
        </h1>
        <p className="text-[#666666]">
          {isAdmin ? 'Gestión de clientes listos para cerrar' : 'Tus clientes en progreso'}
        </p>
      </div>

      <Tabs defaultValue="contratos" className="w-full">
         <TabsList className="grid w-full grid-cols-4 mb-6">
           <TabsTrigger value="contratos" className="flex items-center gap-2">
             <FileCheck className="w-4 h-4" />
             <span className="hidden sm:inline">Contratos</span>
             <span className="sm:hidden">Firmas</span>
             {contractosPendienteFirma.length > 0 && (
               <Badge className="bg-blue-600 text-white ml-1">{contractosPendienteFirma.length}</Badge>
             )}
           </TabsTrigger>
           <TabsTrigger value="visitar" className="flex items-center gap-2">
             <Eye className="w-4 h-4" />
             <span className="hidden sm:inline">Para visitar</span>
             <span className="sm:hidden">Visitar</span>
             {clientesParaVisitar.length > 0 && (
               <Badge className="bg-green-600 text-white ml-1">{clientesParaVisitar.length}</Badge>
             )}
           </TabsTrigger>
           <TabsTrigger value="pendientes-estudio" className="flex items-center gap-2">
             <FileText className="w-4 h-4" />
             <span className="hidden sm:inline">Pendientes estudio</span>
             <span className="sm:hidden">Estudio</span>
             {clientesPendientesEstudio.length > 0 && (
               <Badge className="bg-orange-600 text-white ml-1">{clientesPendientesEstudio.length}</Badge>
             )}
           </TabsTrigger>
           <TabsTrigger value="pendientes-firma" className="flex items-center gap-2">
             <Clock className="w-4 h-4" />
             <span className="hidden sm:inline">Pendientes firma</span>
             <span className="sm:hidden">Firma</span>
             {clientesPendientesFirma.length > 0 && (
               <Badge className="bg-purple-600 text-white ml-1">{clientesPendientesFirma.length}</Badge>
             )}
           </TabsTrigger>
         </TabsList>

        {/* SECCIÓN 0: CONTRATOS PENDIENTES DE FIRMA */}
        <TabsContent value="contratos" className="space-y-4">
          {contractosPendienteFirma.length === 0 ? (
            <Card className="border-none shadow-md">
              <CardContent className="p-12 text-center">
                <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-[#666666] text-lg">No hay contratos pendientes</p>
                <p className="text-gray-400 text-sm mt-2">
                  Los contratos listos para firmar aparecerán aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            <ContratosParaFirmarSection
              clientesConArchivo={contratosConArchivo}
              clientesSinArchivo={contratosIbanSinArchivo}
              zonas={zonas}
              user={user}
              isAdmin={isAdmin}
              navigate={navigate}
              tipoColors={tipoColors}
            />
          )}
        </TabsContent>

        {/* SECCIÓN 1: CLIENTES PARA VISITAR */}
        <TabsContent value="visitar" className="space-y-4">
          {clientesParaVisitar.length === 0 ? (
            <Card className="border-none shadow-md">
              <CardContent className="p-12 text-center">
                <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-[#666666] text-lg">No hay clientes para visitar</p>
                <p className="text-gray-400 text-sm mt-2">
                  Los clientes con estudios listos aparecerán aquí
                </p>
              </CardContent>
            </Card>
          ) : (
            <ClientesParaVisitarSection
              clientesCompletos={clientesParaVisitarCompletos}
              clientesPotencias={clientesParaVisitarPotencias}
              zonas={zonas}
              user={user}
              isAdmin={isAdmin}
              navigate={navigate}
              getArchivosValidos={getArchivosValidos}
              tipoColors={tipoColors}
            />
          )}
        </TabsContent>

        {/* SECCIÓN 2: CLIENTES PENDIENTES DE ESTUDIO */}
         <TabsContent value="pendientes-estudio" className="space-y-4">
           {clientesPendientesEstudio.length === 0 ? (
             <Card className="border-none shadow-md">
               <CardContent className="p-12 text-center">
                 <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                 <p className="text-[#666666] text-lg">No hay clientes pendientes</p>
                 <p className="text-gray-400 text-sm mt-2">
                   Los clientes con facturas pero sin estudios aparecerán aquí
                 </p>
               </CardContent>
             </Card>
           ) : (
             <ClientesPendientesEstudioSection
               clientes={clientesPendientesEstudio}
               zonas={zonas}
               user={user}
               navigate={navigate}
               tipoColors={tipoColors}
             />
           )}
         </TabsContent>

         {/* SECCIÓN 4: CLIENTES PENDIENTES DE FIRMA */}
         <TabsContent value="pendientes-firma" className="space-y-4">
           {clientesPendientesFirma.length === 0 ? (
             <Card className="border-none shadow-md">
               <CardContent className="p-12 text-center">
                 <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                 <p className="text-[#666666] text-lg">No hay clientes pendientes de firma</p>
                 <p className="text-gray-400 text-sm mt-2">
                   Los clientes en estado "Pendiente de firma" aparecerán aquí
                 </p>
               </CardContent>
             </Card>
           ) : (
             <ClientesPendientesFirmaSection
               clientes={clientesPendientesFirma}
               zonas={zonas}
               user={user}
               navigate={navigate}
               tipoColors={tipoColors}
             />
           )}
         </TabsContent>

        </Tabs>
    </div>
  );
}

// COMPONENTE: Clientes para visitar (con y sin informe final)
function ClientesParaVisitarSection({ clientesCompletos, clientesPotencias, zonas, user, isAdmin, navigate, getArchivosValidos, tipoColors }) {
  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  const renderClientesPorSeccion = (clientes, badgeColor, badgeText) => {
    const clientesPorZona = clientes.reduce((acc, cliente) => {
      const zona = zonas.find(z => z.id === cliente.zona_id);
      const zonaNombre = zona?.nombre || "Sin zona";
      if (!acc[zonaNombre]) acc[zonaNombre] = [];
      acc[zonaNombre].push(cliente);
      return acc;
    }, {});

    return (
      <>
        {Object.keys(clientesPorZona).map(zonaNombre => (
          <div key={zonaNombre} className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-[#004D9D]" />
              <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
              <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
            </div>

            {clientesPorZona[zonaNombre].map(cliente => {
              const tipoMax = getTipoMaximo(cliente);
              const bgColor = badgeColor === "green" ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50";
              return (
                <Card
                   key={cliente.id}
                   className={`hover:shadow-lg transition-all duration-300 border-l-4 ${bgColor} cursor-pointer`}
                   onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}&from=readyToGo&tab=visitar`))}
                 >
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-[#004D9D]" />
                        <div>
                          <h3 className="font-bold text-[#004D9D] hover:underline">{cliente.nombre_negocio}</h3>
                          <p className="text-xs text-gray-600">{cliente.propietario_iniciales || 'n/s'}</p>
                        </div>
                      </div>
                      <Badge className={`${badgeColor === "green" ? "bg-green-600" : "bg-amber-600"} text-white`}>
                        {badgeText}
                      </Badge>
                    </div>

                    {tipoMax && (
                      <Badge className={`${tipoColors[tipoMax]} text-xs`}>{tipoMax}</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {clientesCompletos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-green-600 mb-4">✓ Listos con informe final</h3>
          {renderClientesPorSeccion(clientesCompletos, "green", "✓ Listo para visitar")}
        </div>
      )}
      
      {clientesPotencias.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-amber-600 mb-4">⏳ Falta informe final</h3>
          {renderClientesPorSeccion(clientesPotencias, "amber", "⏳ Falta informe final")}
        </div>
      )}

      {clientesCompletos.length === 0 && clientesPotencias.length === 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Eye className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">No hay clientes para visitar</p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes con estudios listos aparecerán aquí
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// COMPONENTE: Clientes pendientes de estudio
function ClientesPendientesEstudioSection({ clientes, zonas, user, navigate, tipoColors }) {
  const clientesPorZona = clientes.reduce((acc, cliente) => {
    const zona = zonas.find(z => z.id === cliente.zona_id);
    const zonaNombre = zona?.nombre || "Sin zona";
    if (!acc[zonaNombre]) acc[zonaNombre] = [];
    acc[zonaNombre].push(cliente);
    return acc;
  }, {});

  return (
    <>
      {Object.keys(clientesPorZona).map(zonaNombre => (
        <div key={zonaNombre} className="space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-[#004D9D]" />
            <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
            <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
          </div>

          {clientesPorZona[zonaNombre].map(cliente => (
            <Card
              key={cliente.id}
              className="hover:shadow-lg transition-all duration-300 border-l-4 border-amber-500 bg-amber-50 cursor-pointer"
              onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}&from=readyToGo&tab=pendientes-estudio`))}
              >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-[#004D9D]" />
                    <div>
                      <h3 className="font-bold text-[#004D9D] hover:underline">{cliente.nombre_negocio}</h3>
                      <p className="text-xs text-gray-600">{cliente.propietario_iniciales || 'n/s'}</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-600 text-white">⏳ Pendiente estudio</Badge>
                </div>

                <div className="space-y-2">
                  {cliente.suministros?.filter(s => s.tipo_factura !== "2.0" && s.facturas?.length > 0).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-white p-2 rounded border border-amber-200">
                      <div className="flex items-center gap-2">
                        <Badge className={tipoColors[s.tipo_factura]}>{s.tipo_factura}</Badge>
                        <span className="text-sm font-medium text-gray-700">{s.nombre}</span>
                      </div>
                      <span className="text-xs text-gray-600">{s.facturas?.length} factura(s)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </>
  );
}

// COMPONENTE: Clientes pendientes de firma
function ClientesPendientesFirmaSection({ clientes, zonas, user, navigate, tipoColors }) {
  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  const clientesPorZona = clientes.reduce((acc, cliente) => {
    const zona = zonas.find(z => z.id === cliente.zona_id);
    const zonaNombre = zona?.nombre || "Sin zona";
    if (!acc[zonaNombre]) acc[zonaNombre] = [];
    acc[zonaNombre].push(cliente);
    return acc;
  }, {});

  return (
    <>
      {Object.keys(clientesPorZona).map(zonaNombre => (
        <div key={zonaNombre} className="space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-[#004D9D]" />
            <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
            <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
          </div>

          {clientesPorZona[zonaNombre].map(cliente => {
            const tipoMax = getTipoMaximo(cliente);
            const diasPendiente = Math.floor((new Date() - new Date(cliente.fecha_cambio_pendiente_firma)) / (1000 * 60 * 60 * 24));
            const diasRestantes = Math.max(0, 30 - diasPendiente);
            
            return (
              <Card
                key={cliente.id}
                className="hover:shadow-lg transition-all duration-300 border-l-4 border-purple-500 bg-purple-50 cursor-pointer"
                onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}&from=readyToGo&tab=pendientes-firma`))}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-[#004D9D]" />
                      <div>
                        <h3 className="font-bold text-[#004D9D] hover:underline">{cliente.nombre_negocio}</h3>
                        <p className="text-xs text-gray-600">{cliente.propietario_iniciales || 'n/s'}</p>
                      </div>
                    </div>
                    <Badge className="bg-purple-600 text-white">⏳ Pendiente de firma</Badge>
                  </div>

                  {tipoMax && (
                    <Badge className={`${tipoColors[tipoMax]} text-xs mr-2`}>{tipoMax}</Badge>
                  )}
                  
                  {diasRestantes <= 5 && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                      ⚠️ {diasRestantes} días para auto-rechazo
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
    </>
  );
}

// COMPONENTE: Contratos para firmar
function ContratosParaFirmarSection({ clientesConArchivo, clientesSinArchivo, zonas, user, isAdmin, navigate, tipoColors }) {
  const queryClient = useQueryClient();

  const uploadContratoFirmadoMutation = useMutation({
    mutationFn: async ({ clienteId, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Cliente.update(clienteId, { contrato_firmado_url: file_url });
      return { clienteId, file_url };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Contrato firmado adjuntado");
    },
  });

  const handleUploadContratoFirmado = (clienteId, event) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadContratoFirmadoMutation.mutate({ clienteId, file });
    }
  };

  const renderContratos = (clientes, tieneArchivo) => {
    const clientesPorZona = clientes.reduce((acc, cliente) => {
      const zona = zonas.find(z => z.id === cliente.zona_id);
      const zonaNombre = zona?.nombre || "Sin zona";
      if (!acc[zonaNombre]) acc[zonaNombre] = [];
      acc[zonaNombre].push(cliente);
      return acc;
    }, {});

    const bgColor = tieneArchivo ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50";
    const badgeClass = tieneArchivo ? "bg-green-600" : "bg-amber-600";
    const badgeText = tieneArchivo ? "✓ Contrato listo" : "⏳ Esperando contrato";

    return (
      <>
        {Object.keys(clientesPorZona).map(zonaNombre => (
          <div key={zonaNombre} className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-[#004D9D]" />
              <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
              <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
            </div>

            {clientesPorZona[zonaNombre].map(cliente => (
              <Card
                key={cliente.id}
                className={`hover:shadow-lg transition-all duration-300 border-l-4 ${bgColor}`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}&from=readyToGo&tab=contratos`))}>
                      <Building2 className="w-5 h-5 text-[#004D9D]" />
                      <div>
                        <h3 className="font-bold text-[#004D9D] hover:underline">{cliente.nombre_negocio}</h3>
                        <p className="text-xs text-gray-600">{cliente.propietario_iniciales || 'n/s'}</p>
                      </div>
                    </div>
                    <Badge className={`${badgeClass} text-white`}>📄 {badgeText}</Badge>
                  </div>

                  {tieneArchivo && cliente.contrato_original_url && (
                    <div className="space-y-2">
                      <a href={cliente.contrato_original_url} download className="block">
                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Descargar contrato
                        </Button>
                      </a>

                      {!cliente.contrato_firmado_url ? (
                        <label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleUploadContratoFirmado(cliente.id, e)}
                            className="hidden"
                            disabled={uploadContratoFirmadoMutation.isPending}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full cursor-pointer"
                            asChild
                            disabled={uploadContratoFirmadoMutation.isPending}
                          >
                            <span>
                              {uploadContratoFirmadoMutation.isPending ? "Subiendo..." : "📤 Adjuntar contrato firmado"}
                            </span>
                          </Button>
                        </label>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          asChild
                        >
                          <a href={cliente.contrato_firmado_url} download>
                            <Download className="w-4 h-4 mr-2" />
                            Descargar contrato firmado
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  {!tieneArchivo && (
                    <p className="text-sm text-amber-700 bg-amber-100 p-2 rounded">
                      ⏳ El administrador aún no ha adjuntado el contrato
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {clientesConArchivo.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-green-600 mb-4">✓ Contratos listos</h3>
          {renderContratos(clientesConArchivo, true)}
        </div>
      )}
      
      {clientesSinArchivo.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-amber-600 mb-4">⏳ Esperando contrato</h3>
          {renderContratos(clientesSinArchivo, false)}
        </div>
      )}
    </div>
  );
}