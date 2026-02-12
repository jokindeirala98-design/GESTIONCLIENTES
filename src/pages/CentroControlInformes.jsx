import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Trash2, Edit, AlertTriangle, TrendingUp, DollarSign, Clock, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { esGas, esLuz20, recalcularRappelComercial, aplicarActualizacionesRappel } from "../components/utils/rappelComisiones";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function CentroControlInformes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [filtroComercial, setFiltroComercial] = useState("todos");
  const [filtroTipoFactura, setFiltroTipoFactura] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busquedaLibre, setBusquedaLibre] = useState("");
  const [vistaKPI, setVistaKPI] = useState("todos"); // "todos", "hoy", "retraso"
  const [editandoInforme, setEditandoInforme] = useState(null);
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [notasAdmin, setNotasAdmin] = useState("");
  const [comisionEditada, setComisionEditada] = useState("");
  const [cambioEstadoCliente, setCambioEstadoCliente] = useState(null);
  const [comisionCierre, setComisionCierre] = useState("");

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
    queryFn: () => base44.entities.Cliente.list('-updated_date'),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Actualizado correctamente");
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const comerciales = usuarios.filter(u => u.role === 'user' || u.role === 'admin');

  // Extraer todos los suministros de todos los clientes
  const suministrosConInforme = clientes
    .flatMap(cliente => 
      (cliente.suministros || [])
        .map(s => ({
          ...s,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre_negocio,
          clienteEstado: cliente.estado,
          comercialEmail: cliente.propietario_email,
          comercialIniciales: cliente.propietario_iniciales,
          comercialNombre: usuarios.find(u => u.email === cliente.propietario_email)?.full_name || cliente.propietario_iniciales,
          fechaSubida: s.informe_final?.fecha_subida || null,
          tieneInforme: (() => {
            if (!s.informe_final) return false;
            const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
              a && a.url && a.url.trim() !== '' && a.url !== 'null'
            );
            const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
            return tieneArchivosValidos || tieneUrlValida;
          })()
        }))
    );

  // Clientes con retraso: estado "Facturas presentadas" hace más de 2 semanas SIN informe
  const clientesConRetraso = clientes.filter(c => {
    if (c.estado !== "Facturas presentadas") return false;
    
    // Buscar la fecha más antigua de facturas subidas
    const fechasFacturas = (c.suministros || [])
      .flatMap(s => s.facturas || [])
      .map(f => f.fecha_subida)
      .filter(Boolean);
    
    if (fechasFacturas.length === 0) return false;
    
    const fechaMasAntigua = new Date(Math.min(...fechasFacturas.map(f => new Date(f).getTime())));
    const diasDesdeFactura = Math.floor((new Date() - fechaMasAntigua) / (1000 * 60 * 60 * 24));
    
    return diasDesdeFactura > 14;
  });

  // Función para parsear búsqueda libre
  const parsearBusqueda = (texto) => {
    const hoy = new Date();
    const textoLower = texto.toLowerCase().trim();
    
    // Detectar "esta semana"
    if (textoLower.includes("esta semana")) {
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
      inicioSemana.setHours(0, 0, 0, 0);
      return { tipo: "fecha", fechaInicio: inicioSemana, fechaFin: hoy };
    }
    
    // Detectar "este mes"
    if (textoLower.includes("este mes")) {
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { tipo: "fecha", fechaInicio: inicioMes, fechaFin: hoy };
    }
    
    // Detectar formato DD/MM
    const matchFecha = texto.match(/(\d{1,2})\/(\d{1,2})/);
    if (matchFecha) {
      const dia = parseInt(matchFecha[1]);
      const mes = parseInt(matchFecha[2]) - 1;
      const fecha = new Date(hoy.getFullYear(), mes, dia);
      return { tipo: "fecha", fechaExacta: fecha };
    }
    
    // Detectar tipo de factura
    if (texto === "2.0" || texto === "3.0" || texto === "6.1") {
      return { tipo: "tipoFactura", valor: texto };
    }
    
    // Por defecto, buscar en nombre de cliente
    return { tipo: "texto", valor: texto };
  };

  // Aplicar filtros
  let suministrosFiltrados = suministrosConInforme.filter(s => {
    if (filtroComercial !== "todos" && s.comercialEmail !== filtroComercial) return false;
    if (filtroTipoFactura !== "todos" && s.tipo_factura !== filtroTipoFactura) return false;
    if (filtroEstado !== "todos" && s.clienteEstado !== filtroEstado) return false;
    
    // Búsqueda libre
    if (busquedaLibre) {
      const busqueda = parsearBusqueda(busquedaLibre);
      
      if (busqueda.tipo === "texto") {
        if (!s.clienteNombre.toLowerCase().includes(busqueda.valor.toLowerCase())) return false;
      } else if (busqueda.tipo === "tipoFactura") {
        if (s.tipo_factura !== busqueda.valor) return false;
      } else if (busqueda.tipo === "fecha") {
        if (!s.fechaSubida) return false;
        const fechaSub = new Date(s.fechaSubida);
        
        if (busqueda.fechaExacta) {
          const mismaFecha = fechaSub.toDateString() === busqueda.fechaExacta.toDateString();
          if (!mismaFecha) return false;
        } else {
          if (fechaSub < busqueda.fechaInicio || fechaSub > busqueda.fechaFin) return false;
        }
      }
    }
    
    return true;
  });

  // Filtrar por vista de KPI
  if (vistaKPI === "hoy") {
    const hoy = new Date().toDateString();
    suministrosFiltrados = suministrosFiltrados.filter(s => 
      s.fechaSubida && new Date(s.fechaSubida).toDateString() === hoy
    );
  }

  // KPIs
  const informesHoy = suministrosConInforme.filter(s => 
    s.tieneInforme && s.fechaSubida && new Date(s.fechaSubida).toDateString() === new Date().toDateString()
  ).length;
  
  const totalConInforme = suministrosConInforme.filter(s => s.tieneInforme).length;

  const handleEliminarInforme = async (suministro) => {
    if (!window.confirm(`¿Eliminar el informe de "${suministro.clienteNombre} - ${suministro.nombre}"?\n\nEl cliente volverá a "Facturas presentadas".`)) {
      return;
    }

    const cliente = clientes.find(c => c.id === suministro.clienteId);
    if (!cliente) return;

    const nuevosSuministros = cliente.suministros.map(s => {
      if (s.id === suministro.id) {
        const { informe_final, comision, ...suministroLimpio } = s;
        return suministroLimpio;
      }
      return s;
    });

    // Recalcular estado
    const suministrosActivos = nuevosSuministros.filter(s => !s.cerrado);
    
    const todosConInforme = suministrosActivos.every(s => {
      if (!s.informe_final) return false;
      const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
        a && a.url && a.url.trim() !== '' && a.url !== 'null'
      );
      const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
      return tieneArchivosValidos || tieneUrlValida;
    });

    const todosConFacturas = suministrosActivos.every(s => 
      s.facturas && s.facturas.length > 0
    );

    const nuevoEstado = todosConInforme ? "Informe listo" : 
                        todosConFacturas ? "Facturas presentadas" : 
                        cliente.estado;

    const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);

    await updateMutation.mutateAsync({
      id: cliente.id,
      data: {
        suministros: nuevosSuministros,
        estado: nuevoEstado,
        comision: comisionTotal
      }
    });
  };

  const handleAbrirEdicion = (suministro) => {
    setEditandoInforme(suministro);
    setNotasAdmin(suministro.informe_final?.notas_admin || "");
    setComisionEditada(suministro.comision?.toString() || "");
    setArchivoNuevo(null);
  };

  const handleGuardarEdicion = async () => {
    if (!editandoInforme) return;

    const cliente = clientes.find(c => c.id === editandoInforme.clienteId);
    if (!cliente) return;

    let archivosActualizados = editandoInforme.informe_final?.archivos || [];

    // Si hay un archivo nuevo para sustituir, reemplazar todos los archivos
    if (archivoNuevo) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: archivoNuevo });
      archivosActualizados = [{
        nombre: archivoNuevo.name,
        url: file_url
      }];
    }

    const nuevosSuministros = cliente.suministros.map(s => {
      if (s.id === editandoInforme.id) {
        return {
          ...s,
          informe_final: {
            ...s.informe_final,
            archivos: archivosActualizados,
            notas_admin: notasAdmin,
            fecha_subida: new Date().toISOString()
          },
          comision: parseFloat(comisionEditada) || s.comision
        };
      }
      return s;
    });

    const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);

    await updateMutation.mutateAsync({
      id: cliente.id,
      data: {
        suministros: nuevosSuministros,
        comision: comisionTotal
      }
    });

    setEditandoInforme(null);
    setArchivoNuevo(null);
  };

  const handleCambiarEstado = (suministro, nuevoEstado) => {
    setCambioEstadoCliente({ suministro, nuevoEstado });
    setComisionCierre("");
  };

  const handleConfirmarCambioEstado = async () => {
    if (!cambioEstadoCliente) return;

    const { suministro, nuevoEstado } = cambioEstadoCliente;
    const cliente = clientes.find(c => c.id === suministro.clienteId);
    if (!cliente) return;

    let updateData = { estado: nuevoEstado };

    // Si cambia a "Firmado con éxito", procesar cierre
    if (nuevoEstado === "Firmado con éxito") {
      const comision = parseFloat(comisionCierre);
      if (!comision || comision <= 0) {
        toast.error("Introduce una comisión válida");
        return;
      }

      const fechaCierre = new Date().toISOString().split('T')[0];
      const mesComision = fechaCierre.substring(0, 7);

      // Marcar todos los suministros NO cerrados como cerrados
      const suministrosActualizados = (cliente.suministros || []).map(s => {
        if (s.cerrado) return s;
        return {
          ...s,
          cerrado: true,
          fecha_cierre_suministro: fechaCierre,
          mes_comision_suministro: mesComision,
          comision: s.id === suministro.id ? comision : (s.comision || 0)
        };
      });

      // Recalcular rappel
      try {
        const todosClientes = await base44.entities.Cliente.list();
        const clientesConActualizacion = todosClientes.map(c => 
          c.id === cliente.id ? { ...cliente, suministros: suministrosActualizados } : c
        );
        
        const { actualizacionesPorCliente } = recalcularRappelComercial(
          clientesConActualizacion,
          cliente.propietario_email,
          mesComision
        );

        if (actualizacionesPorCliente[cliente.id]) {
          const clienteConRappel = aplicarActualizacionesRappel(
            { ...cliente, suministros: suministrosActualizados },
            actualizacionesPorCliente[cliente.id]
          );
          updateData.suministros = clienteConRappel.suministros;
          updateData.comision = clienteConRappel.comision;
        } else {
          updateData.suministros = suministrosActualizados;
          updateData.comision = suministrosActualizados.reduce((sum, s) => sum + (s.comision || 0), 0);
        }

        // Actualizar otros clientes si necesitan recalcular rappel
        for (const [otroClienteId, actualizacionesSuministros] of Object.entries(actualizacionesPorCliente)) {
          if (otroClienteId !== cliente.id) {
            const otroCliente = todosClientes.find(c => c.id === otroClienteId);
            if (otroCliente) {
              const clienteActualizado = aplicarActualizacionesRappel(otroCliente, actualizacionesSuministros);
              await base44.entities.Cliente.update(otroClienteId, {
                suministros: clienteActualizado.suministros,
                comision: clienteActualizado.comision
              });
            }
          }
        }
      } catch (error) {
        console.error("Error al recalcular rappel:", error);
        updateData.suministros = suministrosActualizados;
        updateData.comision = suministrosActualizados.reduce((sum, s) => sum + (s.comision || 0), 0);
      }

      updateData.fecha_cierre = fechaCierre;
      updateData.mes_comision = mesComision;
      updateData.aprobado_admin = true;

      // Notificar a contabilidad
      try {
        await base44.integrations.Core.SendEmail({
          to: "iranzu@voltisenergia.com",
          subject: `Cierre verificado - ${cliente.nombre_negocio}`,
          body: `${cliente.nombre_negocio} ha sido cerrado con éxito desde el Centro de Control y está listo para contabilidad.`
        });
      } catch (error) {
        console.error("Error enviando notificación:", error);
      }
    }

    await updateMutation.mutateAsync({
      id: cliente.id,
      data: updateData
    });

    setCambioEstadoCliente(null);
    toast.success(`Estado cambiado a ${nuevoEstado}`);
  };

  const estadoColors = {
    "Primer contacto": "bg-gray-500",
    "Esperando facturas": "bg-orange-500",
    "Facturas presentadas": "bg-blue-500",
    "Informe listo": "bg-green-500",
    "Pendiente de firma": "bg-purple-500",
    "Pendiente de aprobación": "bg-yellow-600",
    "Firmado con éxito": "bg-green-700",
    "Rechazado": "bg-red-500",
    "Ignorado con mucho éxito": "bg-gray-600",
  };

  const tipoFacturaColors = {
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white"
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8" />
          Centro de Control de Informes
        </h1>
        <p className="text-[#666666]">
          Gestión centralizada de todos los informes subidos
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card 
          className={`border-2 transition-all cursor-pointer ${vistaKPI === 'todos' ? 'border-blue-500 bg-blue-100' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}
          onClick={() => setVistaKPI('todos')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 mb-1">Suministros Totales</p>
                <p className="text-3xl font-bold text-blue-600">{suministrosConInforme.length}</p>
                <p className="text-xs text-blue-600 mt-1">Con informe: {totalConInforme}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-2 transition-all cursor-pointer ${vistaKPI === 'hoy' ? 'border-green-500 bg-green-100' : 'border-green-200 bg-green-50 hover:bg-green-100'}`}
          onClick={() => setVistaKPI('hoy')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Informes de Hoy</p>
                <p className="text-3xl font-bold text-green-600">{informesHoy}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-2 transition-all cursor-pointer ${vistaKPI === 'retraso' ? 'border-red-500 bg-red-100' : 'border-red-200 bg-red-50 hover:bg-red-100'}`}
          onClick={() => {
            setVistaKPI('retraso');
            navigate(createPageUrl("InformesPorPresentar"));
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 mb-1">Con Retraso (&gt;2 semanas)</p>
                <p className="text-3xl font-bold text-red-600">{clientesConRetraso.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <Input
            placeholder="Buscar por cliente, fecha (10/12, esta semana, este mes) o tipo de factura (2.0, 3.0, 6.1)..."
            value={busquedaLibre}
            onChange={(e) => setBusquedaLibre(e.target.value)}
            className="text-base"
          />
          {busquedaLibre && (
            <p className="text-xs text-gray-500 mt-2">
              💡 Ejemplos: "Panadería", "10/12", "23/11", "esta semana", "este mes", "2.0", "3.0", "6.1"
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Informes */}
      <Card>
        <CardContent className="p-0">
          {suministrosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-[#666666]">No hay informes con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Cliente / Suministro
                      </div>
                    </TableHead>
                    <TableHead>
                      <Select value={filtroComercial} onValueChange={setFiltroComercial}>
                        <SelectTrigger className="h-8 border-0 focus:ring-0">
                          <SelectValue placeholder="Comercial" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {comerciales.map(c => (
                            <SelectItem key={c.email} value={c.email}>
                              {c.iniciales}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>
                      <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                        <SelectTrigger className="h-8 border-0 focus:ring-0">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="Primer contacto">Primer contacto</SelectItem>
                          <SelectItem value="Esperando facturas">Esperando facturas</SelectItem>
                          <SelectItem value="Facturas presentadas">Facturas presentadas</SelectItem>
                          <SelectItem value="Informe listo">Informe listo</SelectItem>
                          <SelectItem value="Pendiente de firma">Pendiente de firma</SelectItem>
                          <SelectItem value="Pendiente de aprobación">Pendiente de aprobación</SelectItem>
                          <SelectItem value="Firmado con éxito">Firmado con éxito</SelectItem>
                          <SelectItem value="Rechazado">Rechazado</SelectItem>
                          <SelectItem value="Ignorado con mucho éxito">Ignorado con mucho éxito</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>
                      <Select value={filtroTipoFactura} onValueChange={setFiltroTipoFactura}>
                        <SelectTrigger className="h-8 border-0 focus:ring-0">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="6.1">6.1</SelectItem>
                          <SelectItem value="3.0">3.0</SelectItem>
                          <SelectItem value="2.0">2.0</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Fecha Subida</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suministrosFiltrados.map(suministro => {
                    const diasDesdeSubida = suministro.fechaSubida 
                      ? Math.floor((new Date() - new Date(suministro.fechaSubida)) / (1000 * 60 * 60 * 24))
                      : null;

                    return (
                      <TableRow key={`${suministro.clienteId}-${suministro.id}`}>
                        <TableCell>
                          <div>
                           <p className="font-semibold text-[#004D9D]">{suministro.clienteNombre}</p>
                           <p className="text-sm text-gray-600">{suministro.nombre}</p>
                           {!suministro.tieneInforme && (
                             <p className="text-xs text-orange-600 mt-1">⚠️ Sin informe</p>
                           )}
                           {suministro.informe_final?.notas_admin && (
                             <p className="text-xs text-blue-600 mt-1">📝 Tiene notas</p>
                           )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {suministro.comercialIniciales}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className={`${estadoColors[suministro.clienteEstado] || 'bg-gray-500'} text-white px-2.5 py-0.5 text-xs font-semibold rounded-md inline-flex items-center gap-1 hover:opacity-80 transition-opacity`}>
                                {suministro.clienteEstado}
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-gray-600 mb-2 px-2">Cambiar estado</p>
                                {[
                                  { value: "Primer contacto", label: "Primer contacto" },
                                  { value: "Esperando facturas", label: "Esperando facturas" },
                                  { value: "Facturas presentadas", label: "Facturas presentadas (Informes por presentar)" },
                                  { value: "Informe listo", label: "Informe listo" },
                                  { value: "Pendiente de firma", label: "Pendiente de firma" },
                                  { value: "Pendiente de aprobación", label: "Pendiente de aprobación" },
                                  { value: "Firmado con éxito", label: "Firmado con éxito" },
                                  { value: "Rechazado", label: "Rechazado" },
                                  { value: "Ignorado con mucho éxito", label: "Ignorado con mucho éxito" }
                                ].map(({ value, label }) => (
                                  <button
                                    key={value}
                                    onClick={() => {
                                      if (window.confirm(`¿Cambiar el estado de "${suministro.clienteNombre}" a "${value}"?`)) {
                                        handleCambiarEstado(suministro, value);
                                      }
                                    }}
                                    className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 transition-colors ${
                                      suministro.clienteEstado === value ? 'bg-blue-50 font-semibold text-blue-700' : ''
                                    }`}
                                    disabled={suministro.clienteEstado === value}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Badge className={tipoFacturaColors[suministro.tipo_factura]}>
                            {suministro.tipo_factura}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-green-600">
                            €{suministro.comision?.toFixed(2) || "0.00"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {suministro.fechaSubida ? (
                            <span className="text-sm">
                              {format(new Date(suministro.fechaSubida), "dd/MM/yyyy", { locale: es })}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {diasDesdeSubida !== null && (
                            <Badge variant={diasDesdeSubida > 30 ? "destructive" : "secondary"}>
                              {diasDesdeSubida}d
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(createPageUrl("DetalleCliente") + `?id=${suministro.clienteId}`)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            {suministro.tieneInforme && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAbrirEdicion(suministro)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEliminarInforme(suministro)}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para confirmar cierre con comisión */}
      <Dialog open={!!cambioEstadoCliente} onOpenChange={() => setCambioEstadoCliente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              Cambiar a {cambioEstadoCliente?.nuevoEstado}
            </DialogTitle>
          </DialogHeader>

          {cambioEstadoCliente?.nuevoEstado === "Firmado con éxito" ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Al marcar como "Firmado con éxito", todos los suministros abiertos se cerrarán y la comisión se contabilizará.
              </p>
              <div>
                <label className="text-sm font-medium mb-2 block">Comisión Total (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={comisionCierre}
                  onChange={(e) => setComisionCierre(e.target.value)}
                  placeholder="Ej: 150.00"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              ¿Confirmar cambio de estado para "{cambioEstadoCliente?.suministro?.clienteNombre}"?
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCambioEstadoCliente(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmarCambioEstado} className="bg-[#004D9D]">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edición */}
      <Dialog open={!!editandoInforme} onOpenChange={() => setEditandoInforme(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              Editar Informe - {editandoInforme?.clienteNombre}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Suministro: {editandoInforme?.nombre}
              </label>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Comisión (€)
              </label>
              {(esGas(editandoInforme?.nombre) || esLuz20(editandoInforme?.nombre, editandoInforme?.tipo_factura)) ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    ℹ️ Comisión automática por rappel - Se calcula al firmar el cliente
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Puedes editarla manualmente si es necesario
                  </p>
                  <Input
                    type="number"
                    step="0.01"
                    value={comisionEditada}
                    onChange={(e) => setComisionEditada(e.target.value)}
                    placeholder="0.00"
                    className="mt-2"
                  />
                </div>
              ) : (
                <Input
                  type="number"
                  step="0.01"
                  value={comisionEditada}
                  onChange={(e) => setComisionEditada(e.target.value)}
                  placeholder="0.00"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Notas para el comercial
              </label>
              <Textarea
                value={notasAdmin}
                onChange={(e) => setNotasAdmin(e.target.value)}
                placeholder="Añade notas opcionales que verá el comercial..."
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Informe actual
              </label>
              {editandoInforme?.informe_final?.archivos && editandoInforme.informe_final.archivos.length > 0 ? (
                <div className="space-y-3">
                  {editandoInforme.informe_final.archivos.map((archivo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium">{archivo.nombre}</span>
                      </div>
                      <a href={archivo.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline">
                          Ver PDF
                        </Button>
                      </a>
                    </div>
                  ))}
                  
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Sustituir informe
                    </label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setArchivoNuevo(e.target.files?.[0] || null)}
                    />
                    {archivoNuevo && (
                      <p className="text-sm text-orange-600 mt-2">
                        ⚠️ Al guardar, el informe actual será reemplazado por: {archivoNuevo.name}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay informe adjuntado</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoInforme(null)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarEdicion} className="bg-[#004D9D]">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}