import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, AlertCircle, Trash2, StickyNote, Volume2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CheckCircle2 } from "lucide-react";
import AudioRecorder from "../components/calendario/AudioRecorder.jsx";
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

export default function Calendario() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    cliente_id: "",
    descripcion: "",
    color: "verde"
  });
  const [showCorchoDialog, setShowCorchoDialog] = useState(false);
  const [editingTareaCorcho, setEditingTareaCorcho] = useState(null);
  const [modoMultiple, setModoMultiple] = useState(false);
  const [newTareaCorcho, setNewTareaCorcho] = useState({
    descripcion: "",
    notas: "",
    fecha: "",
    audio_url: null
  });
  const [tareasMultiples, setTareasMultiples] = useState(["", "", ""]);
  const inputRefs = useRef([]);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: tareas = [] } = useQuery({
    queryKey: ['tareas'],
    queryFn: () => base44.entities.Tarea.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: tareasCorcho = [] } = useQuery({
    queryKey: ['tareasCorcho'],
    queryFn: () => base44.entities.TareaCorcho.list(),
  });

  const createEventMutation = useMutation({
    mutationFn: async ({ clienteId, evento, esTarea }) => {
      if (esTarea) {
        // Crear tarea independiente
        await base44.entities.Tarea.create({
          fecha: evento.fecha,
          descripcion: evento.descripcion,
          color: evento.color,
          propietario_email: user.email,
          completada: false
        });
      } else {
        // Crear evento asociado a cliente
        const cliente = clientes.find(c => c.id === clienteId);
        const eventosActuales = cliente.eventos || [];
        const nuevosEventos = [...eventosActuales, evento];
        
        await base44.entities.Cliente.update(clienteId, {
          eventos: nuevosEventos
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['tareas']);
      setShowCreateDialog(false);
      setNewEvent({ cliente_id: "", descripcion: "", color: "verde" });
      toast.success("Evento creado");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ clienteId, eventoId, esTarea, tareaId }) => {
      if (esTarea) {
        // Marcar tarea como completada (o eliminarla)
        await base44.entities.Tarea.delete(tareaId);
      } else {
        // Eliminar evento de cliente
        const cliente = clientes.find(c => c.id === clienteId);
        const eventosActuales = cliente.eventos || [];
        const nuevosEventos = eventosActuales.filter(e => e.id !== eventoId);
        
        await base44.entities.Cliente.update(clienteId, {
          eventos: nuevosEventos
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['tareas']);
      toast.success("Tarea completada");
    },
  });

  const createTareaCorchoMutation = useMutation({
    mutationFn: async (tarea) => {
      const maxOrden = tareasCorcho.filter(t => !t.completada).reduce((max, t) => Math.max(max, t.orden || 0), 0);
      await base44.entities.TareaCorcho.create({
        ...tarea,
        orden: maxOrden + 1,
        completada: false,
        tiene_alerta: false,
        creador_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      setShowCorchoDialog(false);
      setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null });
      setTareasMultiples(["", "", ""]);
      setModoMultiple(false);
      toast.success("Tarea creada");
    },
  });

  const createTareasMultiplesMutation = useMutation({
    mutationFn: async (tareas) => {
      const maxOrden = tareasCorcho.filter(t => !t.completada).reduce((max, t) => Math.max(max, t.orden || 0), 0);
      for (let i = 0; i < tareas.length; i++) {
        await base44.entities.TareaCorcho.create({
          descripcion: tareas[i],
          orden: maxOrden + i + 1,
          completada: false,
          tiene_alerta: false,
          creador_email: user.email
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      setShowCorchoDialog(false);
      setTareasMultiples(["", "", ""]);
      setModoMultiple(false);
      toast.success("Tareas creadas");
    },
  });

  const updateTareaCorchoMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.TareaCorcho.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      setEditingTareaCorcho(null);
    },
  });

  const deleteTareaCorchoMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.TareaCorcho.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      toast.success("Tarea eliminada");
    },
  });

  const completarTareaCorchoMutation = useMutation({
    mutationFn: async (id) => {
      const fecha = new Date().toISOString().split('T')[0];
      await base44.entities.TareaCorcho.update(id, {
        completada: true,
        fecha_completada: fecha
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      toast.success("Tarea completada");
    },
  });

  const toggleAlertaMutation = useMutation({
    mutationFn: async ({ id, tiene_alerta }) => {
      await base44.entities.TareaCorcho.update(id, { tiene_alerta: !tiene_alerta });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
    },
  });

  // Auto-eliminar tareas completadas después de 2 semanas
  useEffect(() => {
    const limpiarTareasAntiguas = async () => {
      const hoy = new Date();
      const dosSemanasAtras = new Date(hoy);
      dosSemanasAtras.setDate(dosSemanasAtras.getDate() - 14);

      const tareasAEliminar = tareasCorcho.filter(t => {
        if (!t.completada || !t.fecha_completada) return false;
        const fechaCompletada = new Date(t.fecha_completada);
        return fechaCompletada < dosSemanasAtras;
      });

      for (const tarea of tareasAEliminar) {
        await base44.entities.TareaCorcho.delete(tarea.id);
      }

      if (tareasAEliminar.length > 0) {
        queryClient.invalidateQueries(['tareasCorcho']);
      }
    };

    if (tareasCorcho.length > 0) {
      limpiarTareasAntiguas();
    }
  }, [tareasCorcho.length]);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    // Si es el mismo contenedor y misma posición, no hacer nada
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceCompleted = source.droppableId === 'completadas';
    const destCompleted = destination.droppableId === 'completadas';

    // Obtener tareas filtradas del contenedor origen
    const sourceTareas = tareasCorcho
      .filter(t => t.completada === sourceCompleted)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const [movedTarea] = sourceTareas.splice(source.index, 1);

    // Si se mueve entre columnas
    if (sourceCompleted !== destCompleted) {
      const fecha = new Date().toISOString().split('T')[0];
      await base44.entities.TareaCorcho.update(movedTarea.id, {
        completada: destCompleted,
        fecha_completada: destCompleted ? fecha : null
      });
    }

    // Obtener tareas del contenedor destino
    const destTareas = tareasCorcho
      .filter(t => t.completada === destCompleted && t.id !== movedTarea.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    destTareas.splice(destination.index, 0, movedTarea);

    // Actualizar orden de todas las tareas en el contenedor destino
    for (let i = 0; i < destTareas.length; i++) {
      await base44.entities.TareaCorcho.update(destTareas[i].id, { 
        orden: i,
        completada: destCompleted,
        fecha_completada: destCompleted && !destTareas[i].fecha_completada ? new Date().toISOString().split('T')[0] : destTareas[i].fecha_completada
      });
    }

    queryClient.invalidateQueries(['tareasCorcho']);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  // Clientes del usuario (o todos si es admin)
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user.email);

  const emailsAdmins = usuarios.filter(u => u.role === 'admin').map(u => u.email);

  // Filtrar eventos de clientes según rol (lógica original restaurada)
  const eventosClientes = clientes.flatMap(cliente => {
    const eventos = cliente.eventos || [];
    return eventos
      .filter(evento => {
        if (isAdmin) {
          // Admins ven eventos rojos de TODOS los comerciales
          return evento.color === "rojo";
        } else {
          // Comerciales ven solo sus eventos (todos los colores)
          return cliente.propietario_email === user.email;
        }
      })
      .map(evento => ({
        ...evento,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre_negocio,
        cliente_propietario: cliente.propietario_iniciales,
        es_mi_cliente: cliente.propietario_email === user.email,
        es_tarea: false
      }));
  });

  // Filtrar tareas independientes según rol
  const tareasIndependientes = tareas
    .filter(tarea => !tarea.completada)
    .filter(tarea => {
      if (isAdmin) {
        // Admins ven tareas de otros admins
        return emailsAdmins.includes(tarea.propietario_email);
      } else {
        // Comerciales ven solo sus tareas
        return tarea.propietario_email === user.email;
      }
    })
    .map(tarea => ({
      id: tarea.id,
      fecha: tarea.fecha,
      descripcion: tarea.descripcion,
      color: tarea.color,
      cliente_nombre: "Tarea personal",
      es_tarea: true,
      tarea_id: tarea.id,
      es_mi_cliente: tarea.propietario_email === user.email,
      propietario_email: tarea.propietario_email
    }));

  // Agregar tareas del corcho con fecha al calendario (solo para admins)
  const tareasConFecha = isAdmin ? tareasCorcho
    .filter(t => !t.completada && t.fecha)
    .map(t => ({
      id: `corcho-${t.id}`,
      tarea_corcho_id: t.id,
      fecha: t.fecha,
      descripcion: t.descripcion,
      color: "azul",
      cliente_nombre: "Tarea",
      es_tarea_corcho: true,
      tiene_alerta: t.tiene_alerta
    })) : [];

  // Combinar eventos de clientes y tareas independientes
  const eventosRelevantes = [...eventosClientes, ...tareasIndependientes, ...tareasConFecha];

  // Función para convertir fecha a string local (sin zona horaria)
  const dateToLocalString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Obtener días del mes
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      });
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day)
      });
    }

    // Días del mes siguiente
    const remainingDays = 42 - days.length; // 6 semanas * 7 días
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        day,
        isCurrentMonth: false,
        date: new Date(year, month + 1, day)
      });
    }

    return days;
  };

  const getEventosForDay = (date) => {
    const dateStr = dateToLocalString(date);
    return eventosRelevantes.filter(e => e.fecha === dateStr);
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const eventosDelDia = selectedDay ? getEventosForDay(selectedDay) : [];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDay(null);
  };

  const handleDayClick = (date) => {
    setSelectedDay(date);
  };

  const handleCreateEvent = () => {
    if (!newEvent.descripcion) {
      toast.error("Añade una descripción");
      return;
    }

    const esTarea = !newEvent.cliente_id;

    if (!esTarea && !newEvent.cliente_id) {
      toast.error("Selecciona un cliente o crea una tarea personal");
      return;
    }

    const evento = {
      id: Date.now().toString(),
      fecha: dateToLocalString(selectedDay),
      descripcion: newEvent.descripcion,
      color: newEvent.color
    };

    createEventMutation.mutate({
      clienteId: newEvent.cliente_id,
      evento,
      esTarea
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CalendarIcon className="w-8 h-8" />
          Calendario de Eventos
        </h1>
        <p className="text-[#666666]">
          {isAdmin 
            ? "Calendario compartido de administradores" 
            : "Tu calendario personal"}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Calendario */}
        <Card className="md:col-span-2 border-none shadow-md">
          <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-white capitalize">{monthName}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="text-white hover:bg-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((dayInfo, idx) => {
                const eventosDay = getEventosForDay(dayInfo.date);
                const hasEvents = eventosDay.length > 0;
                const hasGreen = eventosDay.some(e => e.color === "verde");
                const hasRed = eventosDay.some(e => e.color === "rojo");
                const hasYellow = eventosDay.some(e => e.color === "amarillo");
                const hasBlue = eventosDay.some(e => e.color === "azul");
                const isSelected = selectedDay && selectedDay.toDateString() === dayInfo.date.toDateString();
                const isToday = dayInfo.date.toDateString() === new Date().toDateString();

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(dayInfo.date)}
                    className={`
                      aspect-square p-2 rounded-lg text-sm transition-all cursor-pointer hover:bg-gray-100
                      ${!dayInfo.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                      ${isToday ? 'bg-blue-100 font-bold' : ''}
                      ${isSelected ? 'ring-2 ring-[#004D9D]' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span>{dayInfo.day}</span>
                      {hasEvents && (
                        <div className="flex gap-1 mt-1">
                          {hasGreen && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                          {hasRed && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                          {hasYellow && <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />}
                          {hasBlue && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Panel de Eventos */}
        <Card className="border-none shadow-md">
          <CardHeader className="bg-gradient-to-r from-[#00AEEF] to-[#004D9D]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg">
                {selectedDay 
                  ? selectedDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                  : 'Selecciona un día'}
              </CardTitle>
              {selectedDay && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCreateDialog(true)}
                  className="text-white hover:bg-white/20"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {!selectedDay ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Haz click en un día</p>
              </div>
            ) : (
              <>
                {eventosDelDia.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm mb-3">No hay eventos este día</p>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-[#004D9D]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Evento
                    </Button>
                  </div>
                )}
                
                {eventosDelDia.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {eventosDelDia.map((evento) => (
                      <Card 
                        key={evento.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <div
                              className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                                evento.color === "verde" ? "bg-green-500" : 
                                evento.color === "rojo" ? "bg-red-500" : 
                                evento.color === "azul" ? "bg-blue-500" : "bg-yellow-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div 
                                className={evento.es_tarea || evento.es_tarea_corcho ? "" : "cursor-pointer hover:underline"}
                                onClick={() => !evento.es_tarea && !evento.es_tarea_corcho && navigate(createPageUrl(`DetalleCliente?id=${evento.cliente_id}`))}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-semibold text-sm truncate ${evento.es_tarea ? "text-purple-600" : evento.es_tarea_corcho ? "text-blue-600" : "text-[#004D9D]"}`}>
                                    {evento.cliente_nombre}
                                  </span>
                                  {evento.tiene_alerta && (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  {!evento.es_mi_cliente && (
                                    <Badge variant="outline" className="text-xs">
                                      {evento.es_tarea 
                                        ? usuarios.find(u => u.email === evento.propietario_email)?.full_name || 'Admin'
                                        : evento.cliente_propietario}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">{evento.descripcion}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={`text-xs ${
                                  evento.color === "verde" 
                                    ? "bg-green-100 text-green-700" 
                                    : evento.color === "rojo"
                                    ? "bg-red-100 text-red-700"
                                    : evento.color === "azul"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {evento.color === "verde" ? "Usuario" : 
                                   evento.color === "rojo" ? "Admin" : 
                                   evento.color === "azul" ? "Corcho" : "Automático"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (evento.es_tarea_corcho) {
                                      completarTareaCorchoMutation.mutate(evento.tarea_corcho_id);
                                    } else {
                                      deleteEventMutation.mutate({
                                        clienteId: evento.cliente_id,
                                        eventoId: evento.id,
                                        esTarea: evento.es_tarea,
                                        tareaId: evento.tarea_id
                                      });
                                    }
                                  }}
                                  className="h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  ✓ Hecho
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {eventosDelDia.length > 0 && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateDialog(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Evento
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Corcho de Tareas - Solo para Administradores */}
      {isAdmin && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#004D9D] flex items-center gap-3">
              <StickyNote className="w-7 h-7" />
              Corcho de Tareas
            </h2>
            <Button
              onClick={() => setShowCorchoDialog(true)}
              className="bg-[#004D9D]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarea
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Columna: Tareas por Realizar */}
              <Card className="border-none shadow-md">
                <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
                  <CardTitle className="text-white">
                    Por Realizar ({tareasCorcho.filter(t => !t.completada).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Droppable droppableId="pendientes">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-[300px] space-y-3 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''}`}
                      >
                        {tareasCorcho
                          .filter(t => !t.completada)
                          .sort((a, b) => (a.orden || 0) - (b.orden || 0))
                          .map((tarea, index) => (
                            <Draggable key={tarea.id} draggableId={tarea.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`${
                                    tarea.tiene_alerta ? 'border-2 border-red-500 bg-red-50' : 'hover:shadow-lg'
                                  } transition-shadow ${snapshot.isDragging ? 'shadow-2xl' : ''}`}
                                >
                                  <CardContent className="p-4">
                                    {editingTareaCorcho?.id === tarea.id ? (
                                      <div className="space-y-3">
                                        <Textarea
                                          value={editingTareaCorcho.descripcion}
                                          onChange={(e) => setEditingTareaCorcho({...editingTareaCorcho, descripcion: e.target.value})}
                                          placeholder="Descripción"
                                          rows={2}
                                        />
                                        <Textarea
                                          value={editingTareaCorcho.notas || ""}
                                          onChange={(e) => setEditingTareaCorcho({...editingTareaCorcho, notas: e.target.value})}
                                          placeholder="Notas"
                                          rows={2}
                                        />
                                        <Input
                                          type="date"
                                          value={editingTareaCorcho.fecha || ""}
                                          onChange={(e) => setEditingTareaCorcho({...editingTareaCorcho, fecha: e.target.value})}
                                        />
                                        <AudioRecorder
                                          existingAudioUrl={editingTareaCorcho.audio_url}
                                          onAudioSaved={(url) => setEditingTareaCorcho({...editingTareaCorcho, audio_url: url})}
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              updateTareaCorchoMutation.mutate({
                                                id: tarea.id,
                                                data: {
                                                  descripcion: editingTareaCorcho.descripcion,
                                                  notas: editingTareaCorcho.notas,
                                                  fecha: editingTareaCorcho.fecha,
                                                  audio_url: editingTareaCorcho.audio_url
                                                }
                                              });
                                            }}
                                            className="bg-green-600"
                                          >
                                            Guardar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditingTareaCorcho(null)}
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-start gap-3 mb-3">
                                          <div className="flex-1">
                                            <p className="font-semibold text-gray-800 mb-1">{tarea.descripcion}</p>
                                            {tarea.notas && (
                                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{tarea.notas}</p>
                                            )}
                                            {tarea.audio_url && (
                                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                  <Volume2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                  <audio controls src={tarea.audio_url} className="flex-1 max-w-full" style={{ height: '32px' }} />
                                                </div>
                                              </div>
                                            )}
                                            {tarea.fecha && (
                                              <Badge className="mt-2 bg-blue-100 text-blue-700">
                                                📅 {new Date(tarea.fecha).toLocaleDateString('es-ES')}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditingTareaCorcho(tarea)}
                                          >
                                            ✏️ Editar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleAlertaMutation.mutate({ id: tarea.id, tiene_alerta: tarea.tiene_alerta })}
                                            className={tarea.tiene_alerta ? "border-red-500 text-red-600" : ""}
                                          >
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            {tarea.tiene_alerta ? "Quitar" : "Alerta"}
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => completarTareaCorchoMutation.mutate(tarea.id)}
                                            className="bg-green-600"
                                          >
                                            ✓ Hecha
                                          </Button>
                                        </div>
                                      </>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        {tareasCorcho.filter(t => !t.completada).length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <StickyNote className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay tareas pendientes</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>

              {/* Columna: Tareas Realizadas */}
              <Card className="border-none shadow-md">
                <CardHeader className="bg-gradient-to-r from-green-600 to-green-700">
                  <CardTitle className="text-white">
                    Realizadas ({tareasCorcho.filter(t => t.completada).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Droppable droppableId="completadas">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`min-h-[300px] space-y-3 ${snapshot.isDraggingOver ? 'bg-green-50 rounded-lg' : ''}`}
                      >
                        {tareasCorcho
                          .filter(t => t.completada)
                          .sort((a, b) => (b.orden || 0) - (a.orden || 0))
                          .map((tarea, index) => (
                            <Draggable key={tarea.id} draggableId={tarea.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-green-50 border-green-200 hover:shadow-lg transition-shadow ${snapshot.isDragging ? 'shadow-2xl' : ''}`}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-700 line-through mb-1">{tarea.descripcion}</p>
                                      {tarea.notas && (
                                        <p className="text-sm text-gray-500 mt-2">{tarea.notas}</p>
                                      )}
                                      {tarea.audio_url && (
                                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg opacity-70">
                                          <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            <audio controls src={tarea.audio_url} className="flex-1 max-w-full" style={{ height: '32px' }} />
                                          </div>
                                        </div>
                                      )}
                                      {tarea.fecha_completada && (
                                        <Badge className="mt-2 bg-green-600 text-white">
                                          ✓ {new Date(tarea.fecha_completada).toLocaleDateString('es-ES')}
                                        </Badge>
                                      )}
                                    </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => deleteTareaCorchoMutation.mutate(tarea.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        {tareasCorcho.filter(t => t.completada).length === 0 && (
                          <div className="text-center py-12 text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay tareas completadas</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Dialog para crear tarea del corcho */}
      <Dialog open={showCorchoDialog} onOpenChange={setShowCorchoDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[#004D9D]">Nueva Tarea del Corcho</DialogTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModoMultiple(!modoMultiple);
                  if (!modoMultiple) {
                    setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null });
                  } else {
                    setTareasMultiples(["", "", ""]);
                  }
                }}
                className="text-xs"
              >
                {modoMultiple ? "Modo Individual" : "Varias Tareas"}
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {!modoMultiple ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Descripción *</label>
                  <Textarea
                    value={newTareaCorcho.descripcion}
                    onChange={(e) => setNewTareaCorcho({ ...newTareaCorcho, descripcion: e.target.value })}
                    placeholder="¿Qué hay que hacer?"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notas</label>
                  <Textarea
                    value={newTareaCorcho.notas}
                    onChange={(e) => setNewTareaCorcho({ ...newTareaCorcho, notas: e.target.value })}
                    placeholder="Detalles adicionales..."
                    rows={3}
                  />
                </div>
                <AudioRecorder
                  onAudioSaved={(url) => setNewTareaCorcho({ ...newTareaCorcho, audio_url: url })}
                />
                <div>
                  <label className="text-sm font-medium mb-1 block">Fecha (opcional)</label>
                  <Input
                    type="date"
                    value={newTareaCorcho.fecha}
                    onChange={(e) => setNewTareaCorcho({ ...newTareaCorcho, fecha: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Si añades fecha, aparecerá en el calendario</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Descripciones de tareas *</label>
                  <div className="space-y-2">
                    {tareasMultiples.map((tarea, index) => (
                      <Input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        value={tarea}
                        onChange={(e) => {
                          const nuevas = [...tareasMultiples];
                          nuevas[index] = e.target.value;
                          setTareasMultiples(nuevas);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (index === tareasMultiples.length - 1) {
                              setTareasMultiples([...tareasMultiples, ""]);
                              setTimeout(() => {
                                inputRefs.current[index + 1]?.focus();
                              }, 0);
                            } else {
                              inputRefs.current[index + 1]?.focus();
                            }
                          }
                        }}
                        placeholder={`Tarea ${index + 1}`}
                      />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTareasMultiples([...tareasMultiples, ""]);
                      setTimeout(() => {
                        const lastIndex = tareasMultiples.length;
                        inputRefs.current[lastIndex]?.focus();
                      }, 0);
                    }}
                    className="mt-2 w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Añadir más
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCorchoDialog(false);
                setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null });
                setTareasMultiples(["", "", ""]);
                setModoMultiple(false);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (!modoMultiple) {
                  if (!newTareaCorcho.descripcion) {
                    toast.error("Añade una descripción");
                    return;
                  }
                  createTareaCorchoMutation.mutate(newTareaCorcho);
                } else {
                  const tareasValidas = tareasMultiples.filter(t => t.trim() !== "");
                  if (tareasValidas.length === 0) {
                    toast.error("Añade al menos una descripción");
                    return;
                  }
                  createTareasMultiplesMutation.mutate(tareasValidas);
                }
              }}
              className="bg-[#004D9D]"
            >
              Crear {modoMultiple && tareasMultiples.filter(t => t.trim()).length > 0 ? `(${tareasMultiples.filter(t => t.trim()).length})` : "Tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear evento */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              Nuevo Evento - {selectedDay?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Cliente <span className="text-gray-400">(opcional - déjalo vacío para crear una tarea personal)</span>
              </label>
              <Select
                value={newEvent.cliente_id}
                onValueChange={(value) => setNewEvent({ ...newEvent, cliente_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente - Tarea personal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>
                    <span className="text-gray-500 italic">Sin cliente - Tarea personal</span>
                  </SelectItem>
                  {misClientes.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nombre_negocio}
                      {isAdmin && ` (${cliente.propietario_iniciales})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Descripción *</label>
              <Textarea
                value={newEvent.descripcion}
                onChange={(e) => setNewEvent({ ...newEvent, descripcion: e.target.value })}
                placeholder="Ej: Presentar informe a las 11:00"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Prioridad</label>
              <Select
                value={newEvent.color}
                onValueChange={(value) => setNewEvent({ ...newEvent, color: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verde">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span>Normal (solo tú)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rojo">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span>Alta (visible para admins)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="amarillo">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span>Automático</span>
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
                setNewEvent({ cliente_id: "", descripcion: "", color: "verde" });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} className="bg-[#004D9D]">
              Crear Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}