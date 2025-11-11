import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function InformesPorPresentar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [clienteExpandido, setClienteExpandido] = useState(null);
  const [comisionesPorSuministro, setComisionesPorSuministro] = useState({});

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

  const { data: clientes = [], isLoading } = useQuery({
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

  const handleSubirInforme = async (cliente, suministroId, file) => {
    try {
      // Obtener comisión del estado local
      const comision = comisionesPorSuministro[suministroId];
      
      if (!comision || isNaN(parseFloat(comision))) {
        toast.error("Introduce una comisión válida para este suministro");
        return;
      }

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          return {
            ...s,
            informe_final: {
              nombre: file.name,
              url: file_url,
              fecha_subida: new Date().toISOString(),
              subido_por_email: user.email
            },
            comision: parseFloat(comision)
          };
        }
        return s;
      });

      // Verificar si todos los suministros tienen informe
      const todosConInforme = nuevosSuministros.every(s => s.informe_final && s.informe_final.url);
      
      // Calcular comisión total del cliente
      const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);
      
      const nuevoEstado = todosConInforme ? "Informe listo" : "Facturas presentadas";

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: {
          suministros: nuevosSuministros,
          estado: nuevoEstado,
          comision: comisionTotal
        }
      });

      toast.success("Informe subido correctamente");

      // Limpiar comisión del estado local
      setComisionesPorSuministro(prev => {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      });

      // Enviar email al comercial si todos tienen informe
      if (todosConInforme) {
        await base44.integrations.Core.SendEmail({
          to: cliente.propietario_email,
          subject: `✅ Todos los informes listos para ${cliente.nombre_negocio}`,
          body: `Hola,\n\nTodos los informes finales de "${cliente.nombre_negocio}" ya están listos y disponibles en la plataforma.\n\nComisión total: ${comisionTotal}€\n\nPuedes verlos en: ${window.location.origin}${createPageUrl(`DetalleCliente?id=${cliente.id}`)}\n\nSaludos,\nVoltis Energía`
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al subir el informe");
    }
  };

  const handleComisionChange = (suministroId, value) => {
    setComisionesPorSuministro(prev => ({
      ...prev,
      [suministroId]: value
    }));
  };

  if (!user) return null;

  const clientesFacturasPresent = clientes.filter(
    c => c.estado === "Facturas presentadas" && c.suministros && c.suministros.length > 0
  );

  console.log("Clientes con Facturas presentadas:", clientesFacturasPresent.length, clientesFacturasPresent);

  // Calcular conteos por tipo de factura (máximo)
  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  const conteo = {
    "6.1": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "6.1").length,
    "3.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "3.0").length,
    "2.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "2.0").length,
  };

  const tipoFacturaOrder = { "6.1": 1, "3.0": 2, "2.0": 3 };
  const clientesOrdenados = [...clientesFacturasPresent].sort((a, b) => {
    const orderA = tipoFacturaOrder[getTipoMaximo(a)] || 999;
    const orderB = tipoFacturaOrder[getTipoMaximo(b)] || 999;
    return orderA - orderB;
  });

  const tipoFacturaColors = {
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white"
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8" />
          Informes por Presentar
        </h1>
        <p className="text-[#666666]">
          Clientes con facturas listas para subir informe final por suministro
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-l-4 border-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Prioridad 6.1</p>
                <p className="text-3xl font-bold text-red-600">{conteo["6.1"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Prioridad 3.0</p>
                <p className="text-3xl font-bold text-orange-600">{conteo["3.0"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Prioridad 2.0</p>
                <p className="text-3xl font-bold text-blue-600">{conteo["2.0"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clientesOrdenados.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay informes pendientes
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando tengan estado "Facturas presentadas"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clientesOrdenados.map(cliente => {
            const zona = zonas.find(z => z.id === cliente.zona_id);
            const tipoMax = getTipoMaximo(cliente);
            const isExpanded = clienteExpandido === cliente.id;
            
            return (
              <Card 
                key={cliente.id}
                className="border-l-4 border-[#004D9D]"
              >
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
                              <span className="text-sm text-gray-600">• {cliente.propietario_iniciales}</span>
                              <Badge className={tipoFacturaColors[tipoMax]}>
                                Max: {tipoMax}
                              </Badge>
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
                        {cliente.suministros?.map((suministro) => (
                          <Card key={suministro.id} className="bg-gray-50">
                            <CardContent className="p-4">
                              <div className="flex flex-col gap-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                      <h4 className="font-semibold text-[#004D9D]">{suministro.nombre}</h4>
                                      <Badge className={tipoFacturaColors[suministro.tipo_factura]}>
                                        {suministro.tipo_factura}
                                      </Badge>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-sm text-gray-600 font-medium">📄 Facturas:</p>
                                      {suministro.facturas?.map((factura, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                                          <FileText className="w-4 h-4 text-blue-600" />
                                          <span className="flex-1 truncate">{factura.nombre}</span>
                                          <a
                                            href={factura.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                          >
                                            <Download className="w-4 h-4" />
                                            Descargar
                                          </a>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {suministro.informe_final ? (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-700 font-semibold mb-2">✓ Informe subido</p>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-green-600">{suministro.informe_final.nombre}</span>
                                      <a
                                        href={suministro.informe_final.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                      >
                                        <Download className="w-4 h-4" />
                                        Descargar
                                      </a>
                                    </div>
                                    {suministro.comision && (
                                      <p className="text-sm text-green-700 mt-2">
                                        💰 Comisión: <strong>{suministro.comision}€</strong>
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                    <p className="text-sm font-semibold text-purple-900 mb-3">📤 Subir informe para este suministro</p>
                                    
                                    <div className="mb-3">
                                      <Label htmlFor={`comision-${suministro.id}`} className="text-sm font-medium text-gray-700">
                                        Comisión (€) *
                                      </Label>
                                      <Input
                                        id={`comision-${suministro.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Ej: 150.00"
                                        value={comisionesPorSuministro[suministro.id] || ""}
                                        onChange={(e) => handleComisionChange(suministro.id, e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>

                                    <input
                                      type="file"
                                      id={`upload-${suministro.id}`}
                                      className="hidden"
                                      accept=".pdf"
                                      onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                          handleSubirInforme(cliente, suministro.id, file);
                                        }
                                        e.target.value = "";
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => document.getElementById(`upload-${suministro.id}`).click()}
                                      className="w-full bg-purple-600 hover:bg-purple-700"
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      Seleccionar PDF del Informe
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
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