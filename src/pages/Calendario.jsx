import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Calendario() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

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

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Filtrar eventos según rol
  const eventosRelevantes = clientes.flatMap(cliente => {
    const eventos = cliente.eventos || [];
    return eventos
      .filter(evento => {
        if (isAdmin) {
          // Admins ven solo eventos rojos de todos
          return evento.color === "rojo";
        } else {
          // Comerciales ven solo sus eventos (verdes y rojos)
          return cliente.propietario_email === user.email;
        }
      })
      .map(evento => ({
        ...evento,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre_negocio,
        cliente_propietario: cliente.propietario_iniciales,
        es_mi_cliente: cliente.propietario_email === user.email
      }));
  });

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
    const dateStr = date.toISOString().split('T')[0];
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
    const eventos = getEventosForDay(date);
    if (eventos.length > 0) {
      setSelectedDay(date);
    }
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
                const isSelected = selectedDay && selectedDay.toDateString() === dayInfo.date.toDateString();
                const isToday = dayInfo.date.toDateString() === new Date().toDateString();

                return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(dayInfo.date)}
                    className={`
                      aspect-square p-2 rounded-lg text-sm transition-all
                      ${!dayInfo.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                      ${isToday ? 'bg-blue-100 font-bold' : ''}
                      ${isSelected ? 'ring-2 ring-[#004D9D]' : ''}
                      ${hasEvents ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span>{dayInfo.day}</span>
                      {hasEvents && (
                        <div className="flex gap-1 mt-1">
                          {hasGreen && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                          {hasRed && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
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
            <CardTitle className="text-white text-lg">
              {selectedDay 
                ? selectedDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                : 'Selecciona un día'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {!selectedDay ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Haz click en un día con eventos</p>
              </div>
            ) : eventosDelDia.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay eventos este día</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventosDelDia.map((evento) => (
                  <Card 
                    key={evento.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(createPageUrl(`DetalleCliente?id=${evento.cliente_id}`))}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                            evento.color === "verde" ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-[#004D9D] truncate">
                              {evento.cliente_nombre}
                            </span>
                            {!evento.es_mi_cliente && (
                              <Badge variant="outline" className="text-xs">
                                {evento.cliente_propietario}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{evento.descripcion}</p>
                          <Badge className={`mt-2 text-xs ${
                            evento.color === "verde" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            {evento.color === "verde" ? "Usuario" : "Admin"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}