import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Building2, Download, ChevronDown, ChevronUp, Upload, X, Save } from "lucide-react";
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
      toast.loading("Subiendo archivo...", { id: `upload-${suministroId}` });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setInformesSubidos(prev => ({
        ...prev,
        [suministroId]: {
          file: file,
          fileUrl: file_url,
          fileName: file.name
        }
      }));
      
      toast.success("Archivo subido. Haz clic en Guardar.", { id: `upload-${suministroId}` });
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al subir archivo", { id: `upload-${suministroId}` });
    }
  };

  const handleGuardarInforme = async (cliente, suministroId) => {
    const informeSubido = informesSubidos[suministroId];
    
    if (!informeSubido) {
      toast.error("Selecciona un archivo Excel");
      return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));

    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          return {
            ...s,
            informe_potencias: {
              nombre: informeSubido.fileName,
              url: informeSubido.fileUrl,
              fecha_subida: new Date().toISOString(),
              subido_por_email: user.email
            }
          };
        }
        return s;
      });

      // Solo considerar suministros NO cerrados
      const suministrosActivos = nuevosSuministros.filter(s => !s.cerrado);
      
      const todosConPotencias = suministrosActivos.every(s => s.informe_potencias);
      const nuevoEstado = todosConPotencias ? "Pendiente informe comparativo" : "Pendiente informe potencias";

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: {
          suministros: nuevosSuministros,
          estado: nuevoEstado
        }
      });

      await queryClient.invalidateQueries(['clientes']);
      
      toast.success("Informe de potencias guardado");

      setInformesSubidos(prev => {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      });

      // Enviar email a Nicolás si todos tienen informe de potencias
      if (todosConPotencias) {
        try {
          await base44.integrations.Core.SendEmail({
            to: "nicolas@voltisenergia.com",
            subject: `✅ Informes de potencias listos para ${cliente.nombre_negocio}`,
            body: `Hola Nicolás,\n\nTodos los informes de potencias de "${cliente.nombre_negocio}" ya están listos.\n\nPuedes verlos en: ${window.location.origin}${createPageUrl("InformesPorPresentar")}\n\nSaludos,\nSistema Voltis`
          });
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al guardar el informe");
    } finally {
      setGuardando(prev => ({ ...prev, [suministroId]: false }));
    }
  };

  const handleEliminarInforme = async (cliente, suministroId) => {
    if (!window.confirm("¿Eliminar el informe de potencias de este suministro?")) {
      return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));

    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          const { informe_potencias, ...suministroLimpio } = s;
          return suministroLimpio;
        }
        return s;
      });

      const suministrosActivos = nuevosSuministros.filter(s => !s.cerrado);
      const todosConFacturas = suministrosActivos.every(s => s.facturas && s.facturas.length > 0);
      const nuevoEstado = todosConFacturas ? "Pendiente informe potencias" : "Facturas presentadas";

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: {
          suministros: nuevosSuministros,
          estado: nuevoEstado
        }
      });

      await queryClient.invalidateQueries(['clientes']);
      
      toast.success("Informe eliminado");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el informe");
    } finally {
      setGuardando(prev => ({ ...prev, [suministroId]: false }));
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
      console.error('Error al descargar:', error);
      window.open(url, '_blank');
    }
  };

  // Mostrar clientes en estado "Pendiente informe potencias"
  const clientesPendientes = clientes.filter(c => {
    if (!c.suministros || c.suministros.length === 0) return false;
    if (c.estado === "Ignorado con mucho éxito") return false;

    const suministrosActivos = c.suministros.filter(s => !s.cerrado);
    if (suministrosActivos.length === 0) return false;

    // Mostrar si está en "Pendiente informe potencias" O tiene suministros sin informe de potencias
    if (c.estado === "Pendiente informe potencias") return true;

    const tieneAlgunSuministroSinPotencias = suministrosActivos.some(s => !s.informe_potencias);
    return tieneAlgunSuministroSinPotencias;
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

      {clientesPendientes.length === 0 ? (
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
          {clientesPendientes.map((cliente) => {
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
                        {cliente.suministros?.filter(s => !s.cerrado).map((suministro) => {
                          const informeSubido = informesSubidos[suministro.id];
                          const estaGuardando = guardando[suministro.id];

                          return (
                            <Card key={suministro.id} className="bg-gray-50">
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-3">
                                        <h4 className="font-semibold text-[#004D9D]">{suministro.nombre}</h4>
                                        <Badge>{suministro.tipo_factura}</Badge>
                                      </div>

                                      <div className="space-y-2">
                                        <p className="text-sm text-gray-600 font-medium">📄 Facturas:</p>
                                        {suministro.facturas?.map((factura, idx) => (
                                          <div key={idx} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            <span className="flex-1 truncate">{factura.nombre}</span>
                                            <button
                                              onClick={() => handleDescargarArchivo(factura.url, factura.nombre)}
                                              className="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                              <Download className="w-4 h-4" />
                                              Descargar
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {suministro.informe_potencias ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-green-700 font-semibold">✓ Informe de potencias subido</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEliminarInforme(cliente, suministro.id)}
                                          disabled={guardando[suministro.id]}
                                          className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-7"
                                        >
                                          <X className="w-3 h-3 mr-1" />
                                          Eliminar
                                        </Button>
                                      </div>
                                      <div className="flex items-center justify-between bg-white p-2 rounded border">
                                        <span className="text-sm text-green-600">{suministro.informe_potencias.nombre}</span>
                                        <a
                                          href={suministro.informe_potencias.url}
                                          download={suministro.informe_potencias.nombre}
                                          className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                        >
                                          <Download className="w-4 h-4" />
                                          Descargar
                                        </a>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                      <p className="text-sm font-semibold text-purple-900 mb-3">📤 Subir informe de potencias (Excel)</p>
                                      
                                      {informeSubido ? (
                                        <div className="space-y-3">
                                          <div className="bg-white border border-green-300 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-green-600" />
                                                <p className="text-sm text-gray-600">{informeSubido.fileName}</p>
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setInformesSubidos(prev => {
                                                  const newState = { ...prev };
                                                  delete newState[suministro.id];
                                                  return newState;
                                                })}
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                              >
                                                <X className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          </div>

                                          <Button
                                            size="sm"
                                            onClick={() => handleGuardarInforme(cliente, suministro.id)}
                                            disabled={estaGuardando}
                                            className="w-full bg-green-600 hover:bg-green-700"
                                          >
                                            {estaGuardando ? (
                                              <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                                Guardando...
                                              </>
                                            ) : (
                                              <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Guardar Informe
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      ) : (
                                        <>
                                          <input
                                            type="file"
                                            id={`upload-${suministro.id}`}
                                            className="hidden"
                                            accept=".xlsx,.xls"
                                            onChange={(e) => {
                                              const file = e.target.files[0];
                                              if (file) {
                                                handleSeleccionarInforme(suministro.id, file);
                                              }
                                              e.target.value = "";
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() => document.getElementById(`upload-${suministro.id}`).click()}
                                            className="bg-purple-600 hover:bg-purple-700"
                                          >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Seleccionar Excel
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
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