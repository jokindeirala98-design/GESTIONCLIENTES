import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, X, Check, Filter } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Citas() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [soloMis, setSoloMis] = useState(false);

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

  const { data: citas = [] } = useQuery({
    queryKey: ['citas'],
    queryFn: () => base44.entities.Cita.list(),
  });

  const createCitaMutation = useMutation({
    mutationFn: (citaData) => base44.entities.Cita.create(citaData),
    onSuccess: () => {
      queryClient.invalidateQueries(['citas']);
    },
  });

  const updateCitaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cita.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['citas']);
    },
  });

  const deleteCitaMutation = useMutation({
    mutationFn: (id) => base44.entities.Cita.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['citas']);
    },
  });

  const updateClienteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
    },
  });

  // Clientes con informe de potencias (50% - amarillo)
  const clientesPotencias = clientes.filter(c => {
    if (soloMis && c.propietario_email !== user?.email) return false;
    if (!c.suministros || c.suministros.length === 0) return false;
    const tieneAlgunPotencias = c.suministros.some(s => s.informe_potencias && !s.informe_comparativo);
    const noTieneCita = !citas.some(cita => cita.cliente_id === c.id && !cita.visitado);
    return tieneAlgunPotencias && noTieneCita;
  });

  // Clientes con informe comparativo (100% - verde)
  const clientesComparativo = clientes.filter(c => {
    if (soloMis && c.propietario_email !== user?.email) return false;
    if (!c.suministros || c.suministros.length === 0) return false;
    const todosConComparativo = c.suministros.every(s => s.informe_comparativo);
    const noTieneCita = !citas.some(cita => cita.cliente_id === c.id && !cita.visitado);
    return todosConComparativo && noTieneCita;
  });

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination) return;

    // Si se arrastra a un día del calendario (desde columnas de espera)
    if (destination.droppableId.startsWith('day-') && (source.droppableId === 'potencias' || source.droppableId === 'comparativo')) {
      const [, day] = destination.droppableId.split('-');
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      setSelectedSlot({
        clienteId: draggableId,
        fecha: fechaStr,
        show: true
      });
    }
    
    // Si se arrastra de vuelta a las columnas (desde el calendario)
    if ((destination.droppableId === 'potencias' || destination.droppableId === 'comparativo') && source.droppableId.startsWith('day-')) {
      const cita = citas.find(c => c.id === draggableId);
      if (cita) {
        deleteCitaMutation.mutate(cita.id);
        
        // Eliminar evento asociado
        const cliente = clientes.find(c => c.id === cita.cliente_id);
        if (cliente) {
          const eventosActualizados = (cliente.eventos || []).filter(
            e => e.tipo_automatico !== 'cita_presentacion' || e.id !== `cita_${cita.id}`
          );
          updateClienteMutation.mutate({
            id: cliente.id,
            data: { eventos: eventosActualizados }
          });
        }
      }
    }
  };

  const handleSelectHora = async (hora) => {
    const cliente = clientes.find(c => c.id === selectedSlot.clienteId);
    if (!cliente) return;

    const citaData = {
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre_negocio,
      comercial_email: cliente.propietario_email,
      comercial_iniciales: cliente.propietario_iniciales,
      fecha: selectedSlot.fecha,
      hora: hora,
      visitado: false
    };

    const nuevaCita = await createCitaMutation.mutateAsync(citaData);

    // Crear evento en el cliente
    const eventosActualizados = [...(cliente.eventos || [])];
    eventosActualizados.push({
      id: `cita_${nuevaCita.id}`,
      fecha: selectedSlot.fecha,
      descripcion: `Presentación a las ${hora}`,
      color: "amarillo",
      tipo_automatico: "cita_presentacion"
    });

    await updateClienteMutation.mutateAsync({
      id: cliente.id,
      data: { eventos: eventosActualizados }
    });

    setSelectedSlot(null);
  };

  const handleMarcarVisitado = async (cita) => {
    await updateCitaMutation.mutateAsync({
      id: cita.id,
      data: {
        visitado: true,
        fecha_visitado: new Date().toISOString()
      }
    });
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getCitasForDay = (day) => {
    const fecha = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0];
    return citas.filter(c => c.fecha === fecha && !c.visitado);
  };

  const isPastDateTime = (fecha, hora) => {
    const citaDateTime = new Date(`${fecha}T${hora}`);
    return citaDateTime < new Date();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth();
  const monthName = currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const horasDisponibles = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      horasDisponibles.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
              <Calendar className="w-8 h-8" />
              Citas de Presentación
            </h1>
            <p className="text-[#666666]">
              Gestiona las visitas a clientes con informes listos
            </p>
          </div>
          <Button
            variant={soloMis ? "default" : "outline"}
            onClick={() => setSoloMis(!soloMis)}
            className={soloMis ? "bg-[#004D9D]" : "border-[#004D9D] text-[#004D9D]"}
          >
            <Filter className="w-4 h-4 mr-2" />
            {soloMis ? "Mostrando solo mis clientes" : "Solo mis clientes"}
          </Button>
        </div>

        {/* Navegación de mes */}
        <Card className="mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <Button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
              ← Anterior
            </Button>
            <h2 className="text-xl font-bold text-[#004D9D] capitalize">{monthName}</h2>
            <Button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
              Siguiente →
            </Button>
          </CardContent>
        </Card>

        {/* Calendario */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                  <div key={day} className="text-center font-semibold text-[#004D9D] py-2 text-base">
                    {day}
                  </div>
                ))}
              </div>
              <div style={{ width: '100%', minHeight: 'auto' }}>
                <div className="grid grid-cols-7 gap-2" style={{ gridTemplateRows: 'repeat(6, 220px)', minHeight: 'auto' }}>
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ height: '220px', minHeight: '220px', maxHeight: '220px' }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const citasDelDia = getCitasForDay(day);
                  
                  return (
                    <Droppable key={day} droppableId={`day-${day}`} isDropDisabled={false}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ 
                            height: '220px', 
                            minHeight: '220px', 
                            maxHeight: '220px',
                            width: '100%',
                            position: 'relative',
                            boxSizing: 'border-box'
                          }}
                          className={`border-2 rounded-lg p-3 ${
                            snapshot.isDraggingOver ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
                          }`}
                        >
                          <div className="font-bold text-lg mb-2 text-[#004D9D]" style={{ height: '28px' }}>{day}</div>
                          <div className="space-y-1" style={{ height: '170px', maxHeight: '170px', overflowY: 'auto', overflowX: 'hidden' }}>
                          {citasDelDia.map((cita, index) => {
                            const cliente = clientes.find(c => c.id === cita.cliente_id);
                            const puedeMarcarVisitado = isPastDateTime(cita.fecha, cita.hora);
                            const tieneComparativo = cliente?.suministros?.every(s => s.informe_comparativo);
                            
                            return (
                              <Draggable key={cita.id} draggableId={cita.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`${tieneComparativo ? 'bg-green-100 border-green-400' : 'bg-yellow-100 border-yellow-400'} border-2 rounded-lg p-2 cursor-move ${
                                      snapshot.isDragging ? 'shadow-lg opacity-80' : ''
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-xs truncate">{cliente?.nombre_negocio}</div>
                                        <div className="text-[10px] opacity-75">{cita.hora} • {cliente?.propietario_iniciales}</div>
                                      </div>
                                      {puedeMarcarVisitado && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarcarVisitado(cita);
                                          }}
                                          className="bg-green-500 hover:bg-green-600 text-white rounded p-1 flex-shrink-0"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
                            {provided.placeholder}
                          </div>
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
              </div>
          </CardContent>
        </Card>
        </div>

        {/* Zonas de espera */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Clientes con informe de potencias (amarillo) */}
          <Droppable droppableId="potencias">
            {(provided, snapshot) => (
              <Card className={`border-l-4 border-yellow-500 ${snapshot.isDraggingOver ? 'bg-yellow-50' : ''}`}>
                <CardHeader>
                  <CardTitle className="text-yellow-700 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Informe de Potencias Listo ({clientesPotencias.length})
                  </CardTitle>
                </CardHeader>
                <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {clientesPotencias.map((cliente, index) => (
                      <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 cursor-move max-w-[120px] ${
                              snapshot.isDragging ? 'shadow-lg opacity-80' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-yellow-900 text-xs truncate">{cliente.nombre_negocio}</p>
                                <p className="text-[10px] text-yellow-700">{cliente.propietario_iniciales}</p>
                              </div>
                              <Badge className="bg-yellow-600 text-[10px] px-1 py-0">50%</Badge>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </CardContent>
              </Card>
            )}
          </Droppable>

          {/* Clientes con informe comparativo (verde) */}
          <Droppable droppableId="comparativo">
            {(provided, snapshot) => (
              <Card className={`border-l-4 border-green-500 ${snapshot.isDraggingOver ? 'bg-green-50' : ''}`}>
                <CardHeader>
                  <CardTitle className="text-green-700 flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Informe Completo Listo ({clientesComparativo.length})
                  </CardTitle>
                </CardHeader>
                <CardContent ref={provided.innerRef} {...provided.droppableProps}>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {clientesComparativo.map((cliente, index) => (
                      <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-green-100 border-2 border-green-400 rounded-lg p-2 cursor-move max-w-[120px] ${
                              snapshot.isDragging ? 'shadow-lg opacity-80' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-green-900 text-xs truncate">{cliente.nombre_negocio}</p>
                                <p className="text-[10px] text-green-700">{cliente.propietario_iniciales}</p>
                              </div>
                              <Badge className="bg-green-600 text-[10px] px-1 py-0">100%</Badge>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </CardContent>
              </Card>
            )}
          </Droppable>
        </div>

        {/* Dialog para seleccionar hora */}
        <Dialog open={selectedSlot?.show} onOpenChange={() => setSelectedSlot(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Seleccionar hora para {selectedSlot?.fecha}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-2">
              {horasDisponibles.map(hora => (
                <Button
                  key={hora}
                  onClick={() => handleSelectHora(hora)}
                  variant="outline"
                  className="hover:bg-[#004D9D] hover:text-white"
                >
                  {hora}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DragDropContext>
  );
}