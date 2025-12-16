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
import { AlertTriangle, Plus, CheckCircle2, Eye, MessageSquare, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function Incidencias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchClienteTerm, setSearchClienteTerm] = useState("");
  const [newIncidencia, setNewIncidencia] = useState({
    cliente_id: "",
    descripcion: "",
    prioridad: "media"
  });
  const [incidenciaAbierta, setIncidenciaAbierta] = useState(null);
  const [nuevoMensaje, setNuevoMensaje] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: incidencias = [] } = useQuery({
    queryKey: ['incidencias'],
    queryFn: () => base44.entities.Incidencia.list('-created_date'),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const createIncidenciaMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Incidencia.create({
        ...data,
        mensajes: []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['incidencias']);
      setShowCreateDialog(false);
      setNewIncidencia({ cliente_id: "", descripcion: "", prioridad: "media" });
      setSearchClienteTerm("");
      toast.success("Incidencia creada");
    },
  });

  const agregarMensajeMutation = useMutation({
    mutationFn: async ({ incidenciaId, mensaje }) => {
      const incidencia = incidencias.find(i => i.id === incidenciaId);
      const mensajesActuales = incidencia.mensajes || [];
      
      const nuevoMensaje = {
        id: Date.now().toString(),
        autor_email: user.email,
        autor_nombre: user.full_name,
        contenido: mensaje,
        fecha: new Date().toISOString(),
        leido: false
      };

      await base44.entities.Incidencia.update(incidenciaId, {
        mensajes: [...mensajesActuales, nuevoMensaje]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['incidencias']);
      setNuevoMensaje("");
      toast.success("Mensaje enviado");
    },
  });

  const resolverIncidenciaMutation = useMutation({
    mutationFn: async ({ id, comercialEmail, clienteId, clienteNombre }) => {
      const fechaResolucion = new Date().toISOString().split('T')[0];
      await base44.entities.Incidencia.update(id, {
        estado: "resuelta",
        fecha_resolucion: fechaResolucion
      });

      // Crear evento en calendario del comercial
      const cliente = clientes.find(c => c.id === clienteId);
      if (cliente) {
        const eventosActuales = cliente.eventos || [];
        const nuevoEvento = {
          id: Date.now().toString(),
          fecha: fechaResolucion,
          descripcion: "Incidencia resuelta",
          color: "verde"
        };
        await base44.entities.Cliente.update(clienteId, {
          eventos: [...eventosActuales, nuevoEvento]
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['incidencias']);
      queryClient.invalidateQueries(['clientes']);
      setIncidenciaAbierta(null);
      toast.success("Incidencia resuelta");
    },
  });

  const revisarIncidenciaMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Incidencia.update(id, { estado: "revisada" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['incidencias']);
      toast.success("Incidencia revisada");
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  // Filtrar clientes del usuario
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user.email);

  // Filtrar incidencias según rol
  const misIncidencias = isAdmin
    ? incidencias.filter(i => i.estado !== "revisada")
    : incidencias.filter(i => i.comercial_email === user.email && i.estado !== "revisada");

  // Separar por estado
  const incidenciasActivas = misIncidencias.filter(i => i.estado === "activa");
  const incidenciasResueltas = misIncidencias.filter(i => i.estado === "resuelta");



  // Ordenar activas por prioridad
  const ordenPrioridad = { alta: 0, media: 1, baja: 2 };
  const incidenciasOrdenadas = incidenciasActivas.sort((a, b) => 
    ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad]
  );

  const prioridadColors = {
    alta: "bg-red-500",
    media: "bg-orange-500",
    baja: "bg-yellow-500"
  };

  const prioridadTextColors = {
    alta: "text-red-700 bg-red-50",
    media: "text-orange-700 bg-orange-50",
    baja: "text-yellow-700 bg-yellow-50"
  };

  const handleCreateIncidencia = () => {
    if (!newIncidencia.cliente_id || !newIncidencia.descripcion) {
      toast.error("Completa todos los campos");
      return;
    }

    const cliente = clientes.find(c => c.id === newIncidencia.cliente_id);
    if (!cliente) return;

    createIncidenciaMutation.mutate({
      cliente_id: newIncidencia.cliente_id,
      cliente_nombre: cliente.nombre_negocio,
      comercial_email: user.email,
      comercial_iniciales: user.iniciales || user.full_name?.substring(0, 3).toUpperCase(),
      descripcion: newIncidencia.descripcion,
      prioridad: newIncidencia.prioridad,
      estado: "activa"
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" />
            Incidencias
          </h1>
          <p className="text-[#666666]">
            {isAdmin ? "Gestión de incidencias de todos los comerciales" : "Tus incidencias reportadas"}
          </p>
        </div>
        {!isAdmin && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#004D9D]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Incidencia
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">
                  {isAdmin ? "Incidencias activas" : "Mis incidencias activas"}
                </p>
                <p className="text-4xl font-bold text-red-600">{incidenciasActivas.length}</p>
              </div>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {!isAdmin && (
          <Card className="border-none shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">Resueltas por revisar</p>
                  <p className="text-4xl font-bold text-green-600">{incidenciasResueltas.length}</p>
                </div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Incidencias Activas */}
      <Card className="border-none shadow-md mb-6">
        <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
          <CardTitle className="text-white">
            {isAdmin ? "Incidencias Activas" : "Mis Incidencias Activas"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {incidenciasOrdenadas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No hay incidencias activas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidenciasOrdenadas.map((incidencia) => {
                const totalMensajes = incidencia.mensajes?.length || 0;
                
                return (
                  <Card key={incidencia.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 
                              className="font-bold text-[#004D9D] cursor-pointer hover:underline"
                              onClick={() => navigate(createPageUrl(`DetalleCliente?id=${incidencia.cliente_id}`))}
                            >
                              {incidencia.cliente_nombre}
                            </h3>
                            {isAdmin && (
                              <Badge variant="outline" className="text-xs">
                                {incidencia.comercial_iniciales}
                              </Badge>
                            )}
                            <Badge className={prioridadTextColors[incidencia.prioridad]}>
                              {incidencia.prioridad.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm whitespace-pre-wrap">{incidencia.descripcion}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Creada el {new Date(incidencia.created_date).toLocaleDateString('es-ES')}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIncidenciaAbierta(incidencia)}
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              {totalMensajes === 0 ? "Responder" : "Ver conversación"}
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (window.confirm("¿Marcar esta incidencia como resuelta?")) {
                                    resolverIncidenciaMutation.mutate({
                                      id: incidencia.id,
                                      comercialEmail: incidencia.comercial_email,
                                      clienteId: incidencia.cliente_id,
                                      clienteNombre: incidencia.cliente_nombre
                                    });
                                  }
                                }}
                                className={`${prioridadColors[incidencia.prioridad]} hover:opacity-80`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Resolver
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incidencias Resueltas - Solo para comerciales */}
      {!isAdmin && incidenciasResueltas.length > 0 && (
        <Card className="border-none shadow-md">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700">
            <CardTitle className="text-white">Incidencias Resueltas</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {incidenciasResueltas.map((incidencia) => (
                <Card key={incidencia.id} className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 
                            className="font-bold text-green-800 cursor-pointer hover:underline"
                            onClick={() => navigate(createPageUrl(`DetalleCliente?id=${incidencia.cliente_id}`))}
                          >
                            {incidencia.cliente_nombre}
                          </h3>
                          <Badge className="bg-green-600 text-white">RESUELTA</Badge>
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{incidencia.descripcion}</p>
                        {incidencia.mensajes && incidencia.mensajes.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-green-800">Conversación:</p>
                            {incidencia.mensajes.slice(-2).map(mensaje => (
                              <div key={mensaje.id} className="p-2 bg-white border-l-4 border-green-600 rounded text-xs">
                                <p className="font-semibold text-green-800">{mensaje.autor_nombre}</p>
                                <p className="text-gray-700">{mensaje.contenido}</p>
                              </div>
                            ))}
                            {incidencia.mensajes.length > 2 && (
                              <p className="text-xs text-gray-500">+ {incidencia.mensajes.length - 2} mensajes más</p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-green-700 mt-2">
                          Resuelta el {new Date(incidencia.fecha_resolucion).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <Button
                        onClick={() => revisarIncidenciaMutation.mutate(incidencia.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Revisado
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear incidencia */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Nueva Incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cliente *</label>
              <Input
                placeholder="Buscar cliente..."
                value={searchClienteTerm}
                onChange={(e) => setSearchClienteTerm(e.target.value)}
              />
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                {misClientes
                  .filter(c => 
                    c.nombre_negocio?.toLowerCase().includes(searchClienteTerm.toLowerCase()) ||
                    c.nombre_cliente?.toLowerCase().includes(searchClienteTerm.toLowerCase())
                  )
                  .map(cliente => (
                    <button
                      key={cliente.id}
                      onClick={() => {
                        setNewIncidencia({ ...newIncidencia, cliente_id: cliente.id });
                        setSearchClienteTerm(cliente.nombre_negocio);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                        newIncidencia.cliente_id === cliente.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                      }`}
                    >
                      <div className="text-sm font-medium">{cliente.nombre_negocio}</div>
                      {cliente.nombre_cliente && (
                        <div className="text-xs text-gray-500">{cliente.nombre_cliente}</div>
                      )}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Descripción *</label>
              <Textarea
                value={newIncidencia.descripcion}
                onChange={(e) => setNewIncidencia({ ...newIncidencia, descripcion: e.target.value })}
                placeholder="Describe la incidencia..."
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Prioridad *</label>
              <Select
                value={newIncidencia.prioridad}
                onValueChange={(value) => setNewIncidencia({ ...newIncidencia, prioridad: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span>Alta</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="media">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span>Media</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="baja">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span>Baja</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewIncidencia({ cliente_id: "", descripcion: "", prioridad: "media" });
                setSearchClienteTerm("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateIncidencia} className="bg-[#004D9D]">
              Crear Incidencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para conversación de incidencia */}
      <Dialog open={!!incidenciaAbierta} onOpenChange={() => setIncidenciaAbierta(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              Conversación - {incidenciaAbierta?.cliente_nombre}
            </DialogTitle>
          </DialogHeader>
          {incidenciaAbierta && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={prioridadTextColors[incidenciaAbierta.prioridad]}>
                    {incidenciaAbierta.prioridad.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    Creada el {new Date(incidenciaAbierta.created_date).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Descripción inicial:</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {incidenciaAbierta.descripcion}
                </p>
              </div>
              
              {/* Mensajes */}
              <div className="max-h-[300px] overflow-y-auto space-y-3 p-2">
                {(!incidenciaAbierta.mensajes || incidenciaAbierta.mensajes.length === 0) ? (
                  <p className="text-center text-gray-400 text-sm py-8">
                    No hay mensajes aún. Inicia la conversación.
                  </p>
                ) : (
                  incidenciaAbierta.mensajes.map((mensaje) => {
                    const esMio = mensaje.autor_email === user.email;
                    return (
                      <div key={mensaje.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${
                          esMio 
                            ? 'bg-[#004D9D] text-white' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          <p className="text-xs font-semibold mb-1">
                            {mensaje.autor_nombre}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{mensaje.contenido}</p>
                          <p className={`text-xs mt-1 ${esMio ? 'text-white/70' : 'text-gray-500'}`}>
                            {new Date(mensaje.fecha).toLocaleString('es-ES', { 
                              day: 'numeric', 
                              month: 'short', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input para nuevo mensaje */}
              <div className="flex gap-2">
                <Textarea
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  rows={2}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (nuevoMensaje.trim()) {
                        agregarMensajeMutation.mutate({
                          incidenciaId: incidenciaAbierta.id,
                          mensaje: nuevoMensaje
                        });
                      }
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (nuevoMensaje.trim()) {
                      agregarMensajeMutation.mutate({
                        incidenciaId: incidenciaAbierta.id,
                        mensaje: nuevoMensaje
                      });
                    }
                  }}
                  disabled={!nuevoMensaje.trim()}
                  className="bg-[#004D9D]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidenciaAbierta(null)}>
              Cerrar
            </Button>
            {isAdmin && incidenciaAbierta?.estado === "activa" && (
              <Button
                onClick={() => {
                  if (window.confirm("¿Marcar esta incidencia como resuelta definitivamente?")) {
                    resolverIncidenciaMutation.mutate({
                      id: incidenciaAbierta.id,
                      comercialEmail: incidenciaAbierta.comercial_email,
                      clienteId: incidenciaAbierta.cliente_id,
                      clienteNombre: incidenciaAbierta.cliente_nombre
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Resolver Definitivamente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}