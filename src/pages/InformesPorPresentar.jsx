import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, Download, ChevronDown, ChevronUp, CheckCircle2, Upload, X, Save, GripVertical, Search } from "lucide-react";
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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function InformesPorPresentar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [clienteExpandido, setClienteExpandido] = useState(null);
  const [comisionesPorSuministro, setComisionesPorSuministro] = useState({});
  const [informesSubidos, setInformesSubidos] = useState({}); // {suministroId: {files: [{file, fileUrl, fileName}]}}
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("all"); // "all", "6.1", "3.0", "2.0"
  const [ordenManual, setOrdenManual] = useState(() => {
    const saved = localStorage.getItem('informes-orden-manual');
    return saved ? JSON.parse(saved) : [];
  });

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

  const sincronizarEstadosMutation = useMutation({
    mutationFn: async () => {
      const clientesActualizar = [];
      
      clientes.forEach(cliente => {
        if (!cliente.suministros || cliente.suministros.length === 0) return;
        
        const estadosFinales = ["Informe listo", "Pendiente de firma", "Firmado con éxito", "Rechazado"];
        if (estadosFinales.includes(cliente.estado)) return;

        const todosConFacturas = cliente.suministros.every(s => 
          s.facturas && s.facturas.length > 0
        );
        
        const todosConInforme = cliente.suministros.every(s =>
          s.informe_final && 
          (s.informe_final.archivos?.length > 0 || s.informe_final.url)
        );

        if (todosConInforme && cliente.estado !== "Informe listo") {
          clientesActualizar.push({
            id: cliente.id,
            nombre: cliente.nombre_negocio,
            nuevoEstado: "Informe listo"
          });
        } else if (todosConFacturas && !todosConInforme && cliente.estado !== "Facturas presentadas") {
          clientesActualizar.push({
            id: cliente.id,
            nombre: cliente.nombre_negocio,
            nuevoEstado: "Facturas presentadas"
          });
        }
      });

      for (const cliente of clientesActualizar) {
        await base44.entities.Cliente.update(cliente.id, { estado: cliente.nuevoEstado });
      }

      return clientesActualizar;
    },
    onSuccess: (clientesActualizados) => {
      queryClient.invalidateQueries(['clientes']);
      if (clientesActualizados.length > 0) {
        toast.success(`${clientesActualizados.length} cliente(s) sincronizado(s)`);
      } else {
        toast.info("Todos los estados están correctos");
      }
      setSincronizando(false);
    },
    onError: () => {
      toast.error("Error al sincronizar estados");
      setSincronizando(false);
    }
  });

  const handleSincronizarEstados = () => {
    if (window.confirm("¿Sincronizar los estados de todos los clientes según sus facturas e informes?")) {
      setSincronizando(true);
      sincronizarEstadosMutation.mutate();
    }
  };

  const handleSeleccionarInforme = async (suministroId, file) => {
    if (!file) return;
    
    const informesActuales = informesSubidos[suministroId]?.files || [];
    if (informesActuales.length >= 2) {
      toast.error("Máximo 2 archivos por suministro");
      return;
    }
    
    try {
      toast.loading("Subiendo archivo...", { id: `upload-${suministroId}-${informesActuales.length}` });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setInformesSubidos(prev => ({
        ...prev,
        [suministroId]: {
          files: [
            ...(prev[suministroId]?.files || []),
            { file, fileUrl: file_url, fileName: file.name }
          ]
        }
      }));
      
      toast.success("Archivo subido. Añade comisión y guarda.", { id: `upload-${suministroId}-${informesActuales.length}` });
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al subir el archivo", { id: `upload-${suministroId}-${informesActuales.length}` });
    }
  };

  const handleEliminarArchivoIndividual = (suministroId, index) => {
    setInformesSubidos(prev => {
      const files = prev[suministroId]?.files || [];
      const newFiles = files.filter((_, i) => i !== index);
      
      if (newFiles.length === 0) {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      }
      
      return {
        ...prev,
        [suministroId]: { files: newFiles }
      };
    });
    toast.info("Archivo eliminado");
  };

  const handleCancelarInforme = (suministroId) => {
    setInformesSubidos(prev => {
      const newState = { ...prev };
      delete newState[suministroId];
      return newState;
    });
    setComisionesPorSuministro(prev => {
      const newState = { ...prev };
      delete newState[suministroId];
      return newState;
    });
    toast.info("Informes cancelados");
  };

  const handleGuardarCambios = async (cliente, suministroId) => {
    const informeSubido = informesSubidos[suministroId];
    const comision = comisionesPorSuministro[suministroId];
    
    if (!informeSubido || !informeSubido.files || informeSubido.files.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }
    
    if (!comision || isNaN(parseFloat(comision))) {
      toast.error("Introduce una comisión válida");
      return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));

    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          return {
            ...s,
            informe_final: {
              archivos: informeSubido.files.map(f => ({
                nombre: f.fileName,
                url: f.fileUrl
              })),
              fecha_subida: new Date().toISOString(),
              subido_por_email: user.email
            },
            comision: parseFloat(comision)
          };
        }
        return s;
      });

      const todosConInforme = nuevosSuministros.every(s => 
        s.informe_final && 
        (s.informe_final.archivos?.length > 0 || s.informe_final.url)
      );
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

      toast.success("Informe guardado correctamente");

      // Limpiar estado
      setInformesSubidos(prev => {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      });
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
      toast.error("Error al guardar el informe");
    } finally {
      setGuardando(prev => ({ ...prev, [suministroId]: false }));
    }
  };

  const handleComisionChange = (suministroId, value) => {
    setComisionesPorSuministro(prev => ({
      ...prev,
      [suministroId]: value
    }));
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

  let clientesFacturasPresent = clientes.filter(
    c => c.estado === "Facturas presentadas" && c.suministros && c.suministros.length > 0
  );

  // Aplicar filtro de prioridad
  if (filtroPrioridad !== "all") {
    clientesFacturasPresent = clientesFacturasPresent.filter(c => getTipoMaximo(c) === filtroPrioridad);
  }

  const conteo = {
    "6.1": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "6.1").length,
    "3.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "3.0").length,
    "2.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "2.0").length,
  };

  const tipoFacturaOrder = { "6.1": 1, "3.0": 2, "2.0": 3 };
  
  // Orden automático por prioridad
  const clientesOrdenadosAuto = [...clientesFacturasPresent].sort((a, b) => {
    const orderA = tipoFacturaOrder[getTipoMaximo(a)] || 999;
    const orderB = tipoFacturaOrder[getTipoMaximo(b)] || 999;
    return orderA - orderB;
  });

  // Inicializar orden manual si está vacío
  useEffect(() => {
    if (ordenManual.length === 0 && clientesOrdenadosAuto.length > 0) {
      setOrdenManual(clientesOrdenadosAuto.map(c => c.id));
    }
  }, [clientesOrdenadosAuto.length]);

  // Aplicar orden manual
  let clientesOrdenados = ordenManual.length > 0
    ? ordenManual
        .map(id => clientesFacturasPresent.find(c => c.id === id))
        .filter(c => c !== undefined)
    : clientesOrdenadosAuto;

  // Filtrar por búsqueda
  if (searchTerm) {
    clientesOrdenados = clientesOrdenados.filter(cliente =>
      cliente.nombre_negocio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.propietario_iniciales?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zonas.find(z => z.id === cliente.zona_id)?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

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

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(ordenManual);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setOrdenManual(items);
    localStorage.setItem('informes-orden-manual', JSON.stringify(items));
  };

  const tipoFacturaColors = {
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white"
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8" />
            Informes por Presentar
          </h1>
          <p className="text-[#666666]">
            Clientes con facturas listas para subir informe final por suministro
          </p>
        </div>
        <Button
          onClick={handleSincronizarEstados}
          disabled={sincronizando || isLoading}
          variant="outline"
          className="border-[#004D9D] text-[#004D9D] hover:bg-[#004D9D] hover:text-white"
        >
          {sincronizando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Sincronizando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Sincronizar Estados
            </>
          )}
        </Button>
      </div>

      {clientesFacturasPresent.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por cliente, negocio, zona o propietario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card 
          className={`border-l-4 border-red-500 cursor-pointer transition-all ${
            filtroPrioridad === "6.1" ? "ring-2 ring-red-500 shadow-lg" : "hover:shadow-lg"
          }`}
          onClick={() => setFiltroPrioridad(filtroPrioridad === "6.1" ? "all" : "6.1")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">
                  Prioridad 6.1 {filtroPrioridad === "6.1" && "✓"}
                </p>
                <p className="text-3xl font-bold text-red-600">{conteo["6.1"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-l-4 border-orange-500 cursor-pointer transition-all ${
            filtroPrioridad === "3.0" ? "ring-2 ring-orange-500 shadow-lg" : "hover:shadow-lg"
          }`}
          onClick={() => setFiltroPrioridad(filtroPrioridad === "3.0" ? "all" : "3.0")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">
                  Prioridad 3.0 {filtroPrioridad === "3.0" && "✓"}
                </p>
                <p className="text-3xl font-bold text-orange-600">{conteo["3.0"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-l-4 border-blue-500 cursor-pointer transition-all ${
            filtroPrioridad === "2.0" ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-lg"
          }`}
          onClick={() => setFiltroPrioridad(filtroPrioridad === "2.0" ? "all" : "2.0")}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">
                  Prioridad 2.0 {filtroPrioridad === "2.0" && "✓"}
                </p>
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="clientes-list">
            {(provided) => (
              <div 
                className="space-y-4"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {clientesOrdenados.map((cliente, index) => {
            const zona = zonas.find(z => z.id === cliente.zona_id);
            const tipoMax = getTipoMaximo(cliente);
            const isExpanded = clienteExpandido === cliente.id;
            
            return (
              <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                {(provided, snapshot) => (
                  <Card 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`border-l-4 border-[#004D9D] ${
                      snapshot.isDragging ? 'shadow-2xl' : ''
                    }`}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => setClienteExpandido(isExpanded ? null : cliente.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div {...provided.dragHandleProps}>
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing" />
                              </div>
                              <Building2 className="w-6 h-6 text-[#004D9D]" />
                          <div>
                            <CardTitle className="text-[#004D9D]">{cliente.nombre_negocio}</CardTitle>
                            <div className="flex items-center gap-3 mt-2">
                              {zona && <span className="text-sm text-gray-600">{zona.nombre}</span>}
                              <span className="text-sm text-gray-600">• {cliente.propietario_iniciales || 'n/s'}</span>
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
                        {cliente.suministros?.map((suministro) => {
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
                                              download={factura.nombre}
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
                                      <p className="text-sm text-green-700 font-semibold mb-2">✓ Informe(s) subido(s)</p>
                                      <div className="space-y-2">
                                        {suministro.informe_final.archivos ? (
                                          suministro.informe_final.archivos.map((archivo, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                              <span className="text-sm text-green-600 truncate">{archivo.nombre}</span>
                                              <a
                                                href={archivo.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download
                                                className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                              >
                                                <Download className="w-4 h-4" />
                                                Descargar
                                              </a>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm text-green-600">{suministro.informe_final.nombre}</span>
                                            <a
                                              href={suministro.informe_final.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              download
                                              className="text-sm text-green-600 hover:underline flex items-center gap-1"
                                            >
                                              <Download className="w-4 h-4" />
                                              Descargar
                                            </a>
                                          </div>
                                        )}
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
                                      
                                      {informeSubido && informeSubido.files && informeSubido.files.length > 0 ? (
                                        <div className="space-y-3">
                                          {/* Archivos subidos */}
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-semibold text-green-700">
                                                {informeSubido.files.length} archivo(s) subido(s)
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleCancelarInforme(suministro.id)}
                                                className="text-xs text-red-500 hover:text-red-700"
                                              >
                                                Cancelar todo
                                              </Button>
                                            </div>
                                            {informeSubido.files.map((file, idx) => (
                                              <div key={idx} className="bg-white border border-green-300 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                    <p className="text-sm text-gray-600 truncate">{file.fileName}</p>
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEliminarArchivoIndividual(suministro.id, idx)}
                                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Input comisión */}
                                          <div>
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

                                          {/* Botón guardar */}
                                          <Button
                                            size="sm"
                                            onClick={() => handleGuardarCambios(cliente, suministro.id)}
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
                                                Guardar Cambios
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      ) : (
                                        <>
                                          <div
                                            onDragOver={(e) => {
                                              e.preventDefault();
                                              e.currentTarget.classList.add('border-purple-500', 'bg-purple-100');
                                            }}
                                            onDragLeave={(e) => {
                                              e.currentTarget.classList.remove('border-purple-500', 'bg-purple-100');
                                            }}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              e.currentTarget.classList.remove('border-purple-500', 'bg-purple-100');
                                              const files = Array.from(e.dataTransfer.files);
                                              files.forEach(file => {
                                                if (file && file.type === 'application/pdf') {
                                                  handleSeleccionarInforme(suministro.id, file);
                                                } else if (file) {
                                                  toast.error(`${file.name}: Solo se permiten archivos PDF`);
                                                }
                                              });
                                            }}
                                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors"
                                          >
                                            <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                              Arrastra PDFs aquí o haz clic para seleccionar (máx. 2)
                                            </p>
                                            <input
                                              type="file"
                                              id={`upload-${suministro.id}`}
                                              className="hidden"
                                              accept=".pdf"
                                              multiple
                                              onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                files.forEach(file => {
                                                  if (file) {
                                                    handleSeleccionarInforme(suministro.id, file);
                                                  }
                                                });
                                                e.target.value = "";
                                              }}
                                            />
                                            <Button
                                              size="sm"
                                              onClick={() => document.getElementById(`upload-${suministro.id}`).click()}
                                              className="bg-purple-600 hover:bg-purple-700"
                                            >
                                              <Upload className="w-4 h-4 mr-2" />
                                              Seleccionar PDF
                                            </Button>
                                          </div>
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
                )}
              </Draggable>
            );
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  </DragDropContext>
      )}
    </div>
  );
}