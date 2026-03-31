import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Building2, Download, ChevronDown, ChevronUp, Upload, X, Save, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function InformesPotencias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [clienteExpandido, setClienteExpandido] = useState(null);
  const [informesSubidos, setInformesSubidos] = useState({});
  const [plantillasSubidas, setPlantillasSubidas] = useState({});
  const [guardando, setGuardando] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.email !== 'jose@voltisenergia.com') {
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

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateClienteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
    },
  });

  const handleSeleccionarInforme = async (suministroId, file) => {
    if (!file) return;
    try {
      toast.loading("Subiendo informe...", { id: `upload-${suministroId}` });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setInformesSubidos(prev => ({
        ...prev,
        [suministroId]: { file, fileUrl: file_url, fileName: file.name }
      }));
      toast.success("Informe subido.", { id: `upload-${suministroId}` });
    } catch (error) {
      toast.error("Error al subir archivo", { id: `upload-${suministroId}` });
    }
  };

  const handleSeleccionarPlantilla = async (suministroId, file) => {
    if (!file) return;
    try {
      toast.loading("Subiendo plantilla...", { id: `plantilla-${suministroId}` });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPlantillasSubidas(prev => ({
        ...prev,
        [suministroId]: { fileUrl: file_url, fileName: file.name }
      }));
      toast.success("Plantilla subida.", { id: `plantilla-${suministroId}` });
    } catch (error) {
      toast.error("Error al subir la plantilla", { id: `plantilla-${suministroId}` });
    }
  };

  // Guardar informe de potencias (y plantilla si la hay) en un solo paso
  const handleGuardarTodo = async (cliente, suministroId) => {
    const informeSubido = informesSubidos[suministroId];
    const plantilla = plantillasSubidas[suministroId];
    const suministro = cliente.suministros.find(s => s.id === suministroId);

    if (!informeSubido && !suministro?.informe_potencias) {
      toast.error("Selecciona el informe de potencias primero");
      return;
    }

    // Alerta si no hay plantilla económica
    const tienePlantilla = !!(suministro?.plantilla_economica || plantilla);
    if (!tienePlantilla) {
      const continuar = window.confirm("⚠️ JOSELITO CABEZA CHORLITO, ¿HAS SUBIDO LA PLANTILLA ECONÓMICA?\n\nPulsa Aceptar para guardar sin plantilla.\nPulsa Cancelar para volver y subir la plantilla primero.");
      if (!continuar) return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));
    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id !== suministroId) return s;
        const updated = { ...s };
        if (informeSubido) {
          updated.informe_potencias = {
            nombre: informeSubido.fileName,
            url: informeSubido.fileUrl,
            fecha_subida: new Date().toISOString(),
            subido_por_email: user.email
          };
        }
        if (plantilla) {
          updated.plantilla_economica = {
            nombre: plantilla.fileName,
            url: plantilla.fileUrl,
            fecha_subida: new Date().toISOString(),
            subido_por_email: user.email
          };
        }
        return updated;
      });

      const suministrosActivos = nuevosSuministros.filter(s => !s.cerrado);
      const todosTratados = suministrosActivos.every(s => s.informe_potencias || s.potencias_ignorado);
      const nuevoEstado = todosTratados ? "Pendiente informe comparativo" : "Pendiente informe potencias";

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: { suministros: nuevosSuministros, estado: nuevoEstado }
      });
      await queryClient.invalidateQueries(['clientes']);

      toast.success("Guardado correctamente");
      setInformesSubidos(prev => { const s = { ...prev }; delete s[suministroId]; return s; });
      setPlantillasSubidas(prev => { const s = { ...prev }; delete s[suministroId]; return s; });

      if (todosTratados) {
        try {
          await base44.integrations.Core.SendEmail({
            to: "nicolas@voltisenergia.com",
            subject: `✅ Informes de potencias listos para ${cliente.nombre_negocio}`,
            body: `Hola Nicolás,\n\nTodos los informes de potencias de "${cliente.nombre_negocio}" ya están listos.\n\nPuedes verlos en: ${window.location.origin}${createPageUrl("InformesPorPresentar")}\n\nSaludos,\nSistema Voltis`
          });
        } catch (e) { console.error("Email error:", e); }
      }
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setGuardando(prev => ({ ...prev, [suministroId]: false }));
    }
  };

  const handleEliminarPlantilla = async (cliente, suministroId) => {
    if (!window.confirm("¿Eliminar la plantilla de estudio económico?")) return;
    setGuardando(prev => ({ ...prev, [`plantilla_${suministroId}`]: true }));
    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) { const { plantilla_economica, ...resto } = s; return resto; }
        return s;
      });
      await updateClienteMutation.mutateAsync({ id: cliente.id, data: { suministros: nuevosSuministros } });
      await queryClient.invalidateQueries(['clientes']);
      toast.success("Plantilla eliminada");
    } catch (error) {
      toast.error("Error al eliminar la plantilla");
    } finally {
      setGuardando(prev => ({ ...prev, [`plantilla_${suministroId}`]: false }));
    }
  };

  const handleDescargarArchivo = async (url, nombre) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nombre || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  const handleIgnorarSuministro = async (cliente, suministroId) => {
    const nuevosSuministros = cliente.suministros.map(s =>
      s.id === suministroId ? { ...s, potencias_ignorado: true } : s
    );
    await updateClienteMutation.mutateAsync({
      id: cliente.id,
      data: { suministros: nuevosSuministros }
    });
    await queryClient.invalidateQueries(['clientes']);
    toast.success("Informe de potencias omitido");
  };

  const TIPO_ORDEN_IP = { "6.2": 8, "6.1": 7, "3.0": 6, "2.0": 5, "RL6": 4, "RL5": 3, "RL4": 2, "RL3": 2, "RL2": 1, "RL1": 1 };
  const getTipoMaximoIP = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    return cliente.suministros.reduce((max, s) => {
      const actual = TIPO_ORDEN_IP[s.tipo_factura] || 0;
      const maxActual = TIPO_ORDEN_IP[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, cliente.suministros[0]?.tipo_factura || "2.0");
  };

  const clientesPendientes = clientes.filter(c => {
    if (["Informe listo", "Pendiente de firma", "Pendiente de aprobación", "Firmado con éxito", "Rechazado", "Ignorado con mucho éxito"].includes(c.estado)) return false;
    if (!c.suministros || c.suministros.length === 0) return false;

    const suministrosActivos = c.suministros.filter(s => !s.cerrado);
    return suministrosActivos.some(s =>
      s.facturas && s.facturas.length > 0 && !s.informe_potencias && !s.potencias_ignorado
    );
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const clientesPendientesOrdenados = [...clientesPendientes].sort((a, b) => {
    const orderA = TIPO_ORDEN_IP[getTipoMaximoIP(a)] || 0;
    const orderB = TIPO_ORDEN_IP[getTipoMaximoIP(b)] || 0;
    return orderB - orderA;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8" />
          Informes de Potencias
        </h1>
        <p className="text-[#666666]">
          Clientes pendientes de informe de potencias (Excel)
        </p>
      </div>

      {clientesPendientesOrdenados.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay informes pendientes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clientesPendientesOrdenados.map((cliente) => {
            const zona = zonas.find(z => z.id === cliente.zona_id);
            const isExpanded = clienteExpandido === cliente.id;
            
            return (
              <Card key={cliente.id} className="border-l-4 border-[#004D9D]">
                <Collapsible
                  open={isExpanded}
                  onOpenChange={() => setClienteExpandido(isExpanded ? null : cliente.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Building2 className="w-6 h-6 text-[#004D9D]" />
                          <div>
                            <CardTitle className="text-[#004D9D]">{cliente.nombre_negocio}</CardTitle>
                            <div className="flex items-center gap-3 mt-2">
                              {zona && <span className="text-sm text-gray-600">{zona.nombre}</span>}
                              <span className="text-sm text-gray-600">• {cliente.propietario_iniciales || 'n/s'}</span>
                              <Badge variant="outline">
                                {cliente.suministros?.length || 0} suministro(s)
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {cliente.suministros?.filter(s => !s.cerrado && s.facturas && s.facturas.length > 0 && !s.informe_potencias && !s.potencias_ignorado).map((suministro) => {
                          const informeSubido = informesSubidos[suministro.id];
                          const plantillaSubida = plantillasSubidas[suministro.id];
                          const estaGuardando = guardando[suministro.id];

                          return (
                            <Card key={suministro.id} className="bg-gray-50">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-[#004D9D]">{suministro.nombre}</h4>
                                  <Badge>{suministro.tipo_factura}</Badge>
                                </div>

                                {/* Facturas */}
                                <div>
                                  <p className="text-sm text-gray-600 font-medium mb-1">📄 Facturas:</p>
                                  {suministro.facturas?.map((factura, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm bg-white p-2 rounded border mb-1">
                                      <FileText className="w-4 h-4 text-blue-600" />
                                      <span className="flex-1 truncate">{factura.nombre}</span>
                                      <button onClick={() => handleDescargarArchivo(factura.url, factura.nombre)} className="text-blue-600 hover:underline flex items-center gap-1">
                                        <Download className="w-4 h-4" /> Descargar
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* 1. Informe de potencias */}
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                  <p className="text-sm font-semibold text-purple-900 mb-2">⚡ 1. Informe de Potencias (Excel/PDF)</p>
                                  {informeSubido ? (
                                    <div className="flex items-center justify-between bg-white border border-green-300 rounded p-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-700 truncate">{informeSubido.fileName}</span>
                                      </div>
                                      <Button size="sm" variant="ghost" onClick={() => setInformesSubidos(prev => { const s={...prev}; delete s[suministro.id]; return s; })} className="h-6 w-6 p-0 text-red-500">
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <input type="file" id={`upload-${suministro.id}`} className="hidden" accept=".xlsx,.xls,.zip,.pdf" onChange={(e) => { if (e.target.files[0]) handleSeleccionarInforme(suministro.id, e.target.files[0]); e.target.value=""; }} />
                                      <Button size="sm" onClick={() => document.getElementById(`upload-${suministro.id}`).click()} className="bg-purple-600 hover:bg-purple-700">
                                        <Upload className="w-4 h-4 mr-2" /> Seleccionar Excel / PDF
                                      </Button>
                                    </>
                                  )}
                                </div>

                                {/* 2. Plantilla económica */}
                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                  <p className="text-sm font-semibold text-orange-800 mb-2">📊 2. Plantilla Estudio Económico (Excel)</p>
                                  {suministro.plantilla_economica ? (
                                    <div className="flex items-center justify-between bg-white border border-orange-300 rounded p-2">
                                      <span className="text-sm text-orange-700 truncate flex-1">{suministro.plantilla_economica.nombre}</span>
                                      <div className="flex items-center gap-2">
                                        <a href={suministro.plantilla_economica.url} download={suministro.plantilla_economica.nombre} className="text-orange-600">
                                          <Download className="w-4 h-4" />
                                        </a>
                                        <Button size="sm" variant="ghost" onClick={() => handleEliminarPlantilla(cliente, suministro.id)} className="h-6 w-6 p-0 text-red-500">
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : plantillaSubida ? (
                                    <div className="flex items-center justify-between bg-white border border-green-300 rounded p-2">
                                      <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-700 truncate">{plantillaSubida.fileName}</span>
                                      </div>
                                      <Button size="sm" variant="ghost" onClick={() => setPlantillasSubidas(prev => { const s={...prev}; delete s[suministro.id]; return s; })} className="h-6 w-6 p-0 text-red-500">
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <input type="file" id={`plantilla-${suministro.id}`} className="hidden" accept=".xlsx,.xls" onChange={(e) => { if (e.target.files[0]) handleSeleccionarPlantilla(suministro.id, e.target.files[0]); e.target.value=""; }} />
                                      <Button size="sm" onClick={() => document.getElementById(`plantilla-${suministro.id}`).click()} className="bg-orange-600 hover:bg-orange-700 text-white">
                                        <Upload className="w-4 h-4 mr-2" /> Seleccionar Excel
                                      </Button>
                                    </>
                                  )}
                                </div>

                                {/* Botón único guardar + ignorar */}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleGuardarTodo(cliente, suministro.id)}
                                    disabled={estaGuardando || !informeSubido}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    {estaGuardando ? (
                                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Guardando...</>
                                    ) : (
                                      <><Save className="w-4 h-4 mr-2" /> Guardar todo</>
                                    )}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleIgnorarSuministro(cliente, suministro.id)} disabled={estaGuardando} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                                    <Ban className="w-3 h-3 mr-1" /> Ignorar potencias
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}