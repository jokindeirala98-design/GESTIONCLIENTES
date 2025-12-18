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
import { FileText, Trash2, Edit, AlertTriangle, TrendingUp, DollarSign, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CentroControlInformes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [filtroComercial, setFiltroComercial] = useState("todos");
  const [filtroTipoFactura, setFiltroTipoFactura] = useState("todos");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [editandoInforme, setEditandoInforme] = useState(null);
  const [archivosNuevos, setArchivosNuevos] = useState([]);
  const [notasAdmin, setNotasAdmin] = useState("");
  const [comisionEditada, setComisionEditada] = useState("");

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

  // Extraer todos los suministros con informe
  const suministrosConInforme = clientes
    .filter(c => ["Informe listo", "Pendiente de firma", "Pendiente de aprobación"].includes(c.estado))
    .flatMap(cliente => 
      (cliente.suministros || [])
        .filter(s => {
          if (!s.informe_final) return false;
          const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
            a && a.url && a.url.trim() !== '' && a.url !== 'null'
          );
          const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
          return tieneArchivosValidos || tieneUrlValida;
        })
        .map(s => ({
          ...s,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre_negocio,
          clienteEstado: cliente.estado,
          comercialEmail: cliente.propietario_email,
          comercialIniciales: cliente.propietario_iniciales,
          comercialNombre: usuarios.find(u => u.email === cliente.propietario_email)?.full_name || cliente.propietario_iniciales,
          fechaSubida: s.informe_final?.fecha_subida || null,
        }))
    );

  // Aplicar filtros
  const suministrosFiltrados = suministrosConInforme.filter(s => {
    if (filtroComercial !== "todos" && s.comercialEmail !== filtroComercial) return false;
    if (filtroTipoFactura !== "todos" && s.tipo_factura !== filtroTipoFactura) return false;
    
    if (filtroFechaDesde && s.fechaSubida) {
      const fechaSub = new Date(s.fechaSubida);
      const fechaDesde = new Date(filtroFechaDesde);
      if (fechaSub < fechaDesde) return false;
    }
    
    if (filtroFechaHasta && s.fechaSubida) {
      const fechaSub = new Date(s.fechaSubida);
      const fechaHasta = new Date(filtroFechaHasta);
      fechaHasta.setHours(23, 59, 59);
      if (fechaSub > fechaHasta) return false;
    }
    
    return true;
  });

  // KPIs
  const totalComisiones = suministrosFiltrados.reduce((sum, s) => sum + (s.comision || 0), 0);
  const informesConRetraso = suministrosFiltrados.filter(s => {
    if (!s.fechaSubida) return false;
    const diasDesdeSubida = Math.floor((new Date() - new Date(s.fechaSubida)) / (1000 * 60 * 60 * 24));
    return diasDesdeSubida > 30;
  }).length;

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
    setArchivosNuevos([]);
  };

  const handleGuardarEdicion = async () => {
    if (!editandoInforme) return;

    const cliente = clientes.find(c => c.id === editandoInforme.clienteId);
    if (!cliente) return;

    let archivosActualizados = editandoInforme.informe_final?.archivos || [];

    // Subir nuevos archivos si hay
    if (archivosNuevos.length > 0) {
      const archivosSubidos = await Promise.all(
        archivosNuevos.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            nombre: file.name,
            url: file_url
          };
        })
      );
      archivosActualizados = [...archivosActualizados, ...archivosSubidos];
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
    setArchivosNuevos([]);
  };

  const estadoColors = {
    "Informe listo": "bg-green-500",
    "Pendiente de firma": "bg-purple-500",
    "Pendiente de aprobación": "bg-yellow-600",
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
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Comisiones en Gestión</p>
                <p className="text-3xl font-bold text-green-600">€{totalComisiones.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 mb-1">Informes Totales</p>
                <p className="text-3xl font-bold text-blue-600">{suministrosFiltrados.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 mb-1">Con Retraso (&gt;30 días)</p>
                <p className="text-3xl font-bold text-red-600">{informesConRetraso}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-[#004D9D]">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Comercial</label>
              <Select value={filtroComercial} onValueChange={setFiltroComercial}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los comerciales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {comerciales.map(c => (
                    <SelectItem key={c.email} value={c.email}>
                      {c.full_name} ({c.iniciales})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de Factura</label>
              <Select value={filtroTipoFactura} onValueChange={setFiltroTipoFactura}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="6.1">6.1 (Alta prioridad)</SelectItem>
                  <SelectItem value="3.0">3.0 (Media prioridad)</SelectItem>
                  <SelectItem value="2.0">2.0 (Baja prioridad)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Desde</label>
              <Input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Hasta</label>
              <Input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
              />
            </div>
          </div>

          {(filtroComercial !== "todos" || filtroTipoFactura !== "todos" || filtroFechaDesde || filtroFechaHasta) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFiltroComercial("todos");
                setFiltroTipoFactura("todos");
                setFiltroFechaDesde("");
                setFiltroFechaHasta("");
              }}
              className="mt-4"
            >
              Limpiar filtros
            </Button>
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
                    <TableHead>Cliente / Suministro</TableHead>
                    <TableHead>Comercial</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tipo</TableHead>
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
                          <Badge className={`${estadoColors[suministro.clienteEstado]} text-white`}>
                            {suministro.clienteEstado}
                          </Badge>
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
              <Input
                type="number"
                step="0.01"
                value={comisionEditada}
                onChange={(e) => setComisionEditada(e.target.value)}
                placeholder="0.00"
              />
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
                Añadir más archivos PDF
              </label>
              <Input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setArchivosNuevos(Array.from(e.target.files || []))}
              />
              {archivosNuevos.length > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {archivosNuevos.length} archivo(s) seleccionado(s)
                </p>
              )}
            </div>

            {editandoInforme?.informe_final?.archivos && editandoInforme.informe_final.archivos.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Archivos actuales:
                </label>
                <div className="space-y-1">
                  {editandoInforme.informe_final.archivos.map((archivo, idx) => (
                    <div key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {archivo.nombre}
                    </div>
                  ))}
                </div>
              </div>
            )}
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