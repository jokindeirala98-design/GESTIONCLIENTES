import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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

  // Filtrar eventos de clientes según rol
  const eventosClientes = clientes.flatMap(cliente => {
    const eventos = cliente.eventos || [];
    return eventos
      .filter(evento => {
        if (isAdmin) {
          // Admins ven solo eventos rojos de todos
          return evento.color === "rojo";
        } else {
          // Comerciales ven solo sus eventos (verdes, rojos y amarillos)
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
        return tarea.color === "rojo";
      } else {
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
      es_mi_cliente: tarea.propietario_email === user.email
    }));

  // Combinar eventos de clientes y tareas independientes
  const eventosRelevantes = [...eventosClientes, ...tareasIndependientes];

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
            ? "Eventos rojos prioritarios de todos los comerciales" 
            : "Tus eventos programados"}
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
                                evento.color === "rojo" ? "bg-red-500" : "bg-yellow-500"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div 
                                className={evento.es_tarea ? "" : "cursor-pointer hover:underline"}
                                onClick={() => !evento.es_tarea && navigate(createPageUrl(`DetalleCliente?id=${evento.cliente_id}`))}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-semibold text-sm truncate ${evento.es_tarea ? "text-purple-600" : "text-[#004D9D]"}`}>
                                    {evento.cliente_nombre}
                                  </span>
                                  {!evento.es_mi_cliente && !evento.es_tarea && (
                                    <Badge variant="outline" className="text-xs">
                                      {evento.cliente_propietario}
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
                                    : "bg-yellow-100 text-yellow-700"
                                }`}>
                                  {evento.color === "verde" ? "Usuario" : 
                                   evento.color === "rojo" ? "Admin" : "Automático"}
                                </Badge>
                                {evento.es_mi_cliente && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm("¿Marcar esta tarea como completada?")) {
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
                                    ✓ Tarea hecha
                                  </Button>
                                )}
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