import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, AlertCircle, Trash2, StickyNote, Volume2, Search, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
  const [searchClienteTerm, setSearchClienteTerm] = useState("");
  const [showCorchoDialog, setShowCorchoDialog] = useState(false);
  const [editingTareaCorcho, setEditingTareaCorcho] = useState(null);
  const [modoMultiple, setModoMultiple] = useState(false);
  const [newTareaCorcho, setNewTareaCorcho] = useState({
    descripcion: "",
    notas: "",
    fecha: "",
    audio_url: null,
    prioridad: "verde",
    propietario_email: ""
  });
  const [propietarioSeleccionado, setPropietarioSeleccionado] = useState(null); // Para el selector del corcho
  const [tareasMultiples, setTareasMultiples] = useState([
    { descripcion: "", prioridad: "verde" },
    { descripcion: "", prioridad: "verde" },
    { descripcion: "", prioridad: "verde" }
  ]);
  const inputRefs = useRef([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialSearchTerm, setHistorialSearchTerm] = useState("");
  const [historialFilterUsuario, setHistorialFilterUsuario] = useState("todos");
  const [pasapalabraDialog, setPasapalabraDialog] = useState(null); // { tareaId, descripcion }

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  // Inicializar propietario seleccionado por defecto
  useEffect(() => {
    if (user && !propietarioSeleccionado) {
      setPropietarioSeleccionado(user.email);
    }
  }, [user, propietarioSeleccionado]);

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
      setNewEvent({ cliente_id: "", descripcion: "", color: isAdmin ? "rojo" : "verde" });
      setSearchClienteTerm("");
      toast.success("Evento creado");
    },
  });

  const completarEventMutation = useMutation({
    mutationFn: async ({ clienteId, eventoId, esTarea, tareaId }) => {
      const timestamp = new Date().toISOString();
      
      if (esTarea) {
        // Marcar tarea como completada y guardar en el corcho
        await base44.entities.Tarea.update(tareaId, { completada: true });
        
        const tarea = tareas.find(t => t.id === tareaId);
        if (tarea && (user.email === 'iranzu@voltisenergia.com' || user.email === 'nicolas@voltisenergia.com')) {
          const maxOrden = tareasCorcho.filter(t => t.completada).reduce((max, t) => Math.max(max, t.orden || 0), 0);
          await base44.entities.TareaCorcho.create({
            descripcion: `${tarea.descripcion}`,
            orden: maxOrden + 1,
            completada: true,
            fecha_completada: timestamp,
            creador_email: user.email
          });
        }
      } else {
        // Marcar evento de cliente como completado
        const cliente = clientes.find(c => c.id === clienteId);
        const eventosActuales = cliente.eventos || [];
        const evento = eventosActuales.find(e => e.id === eventoId);
        const nuevosEventos = eventosActuales.map(e => 
          e.id === eventoId ? { ...e, completada: true } : e
        );
        
        await base44.entities.Cliente.update(clienteId, {
          eventos: nuevosEventos
        });
        
        // Guardar en el corcho para tracking
        if (evento && (user.email === 'iranzu@voltisenergia.com' || user.email === 'nicolas@voltisenergia.com')) {
          const maxOrden = tareasCorcho.filter(t => t.completada).reduce((max, t) => Math.max(max, t.orden || 0), 0);
          await base44.entities.TareaCorcho.create({
            descripcion: `${cliente.nombre_negocio}: ${evento.descripcion}`,
            orden: maxOrden + 1,
            completada: true,
            fecha_completada: timestamp,
            creador_email: user.email
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['tareas']);
      queryClient.invalidateQueries(['tareasCorcho']);
      toast.success("Tarea completada");
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async ({ clienteId, eventoId, esTarea, tareaId }) => {
      if (esTarea) {
        // Eliminar tarea
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
      toast.success("Evento eliminado");
    },
  });

  const createTareaCorchoMutation = useMutation({
    mutationFn: async (tarea) => {
      const propietarioEmail = tarea.propietario_email;
      const maxOrden = tareasCorcho.filter(t => !t.completada && t.propietario_email === propietarioEmail).reduce((max, t) => Math.max(max, t.orden || 0), 0);
      await base44.entities.TareaCorcho.create({
        ...tarea,
        orden: maxOrden + 1,
        completada: false,
        tiene_alerta: false,
        prioridad: tarea.prioridad || "verde",
        creador_email: user.email,
        propietario_email: propietarioEmail
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      setShowCorchoDialog(false);
      setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null, prioridad: "verde", propietario_email: "" });
      setTareasMultiples([
        { descripcion: "", prioridad: "verde" },
        { descripcion: "", prioridad: "verde" },
        { descripcion: "", prioridad: "verde" }
      ]);
      setModoMultiple(false);
      toast.success("Tarea creada");
    },
  });

  const createTareasMultiplesMutation = useMutation({
    mutationFn: async ({ tareas, propietarioEmail }) => {
      const maxOrden = tareasCorcho.filter(t => !t.completada && t.propietario_email === propietarioEmail).reduce((max, t) => Math.max(max, t.orden || 0), 0);
      for (let i = 0; i < tareas.length; i++) {
        await base44.entities.TareaCorcho.create({
          descripcion: tareas[i].descripcion,
          prioridad: tareas[i].prioridad || "verde",
          orden: maxOrden + i + 1,
          completada: false,
          tiene_alerta: false,
          creador_email: user.email,
          propietario_email: propietarioEmail
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tareasCorcho']);
      setShowCorchoDialog(false);
      setTareasMultiples([
        { descripcion: "", prioridad: "verde" },
        { descripcion: "", prioridad: "verde" },
        { descripcion: "", prioridad: "verde" }
      ]);
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
      const timestamp = new Date().toISOString();
      await base44.entities.TareaCorcho.update(id, {
        completada: true,
        fecha_completada: timestamp
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

  // Helper: normalizar email de Nico - ambos emails de Nico apuntan al mismo corcho
  // El corcho de Nico se filtra con propietarioSeleccionado, que se inicializa con user.email
  // Para garantizar coherencia, todas las tareas de Nico se guardan con el mismo email
  // que usa el selector del corcho: el email real del usuario Nico logueado.
  // Si el destinatario es cualquiera de los dos emails de Nico, buscar cuál está en la DB
  // como propietario de tareas existentes (el que realmente usa), o usar el del selector.
  const resolverEmailNico = () => {
    // Si el usuario actual ES Nico, su email es el correcto
    if (isNico) return user.email;
    // Si no, buscar tareas existentes de Nico para saber qué email usa
    const tareaDeNico = tareasCorcho.find(t => 
      t.propietario_email === "nicolas@voltisenergia.com" || 
      t.propietario_email === "nicolasvoltis@gmail.com"
    );
    if (tareaDeNico) return tareaDeNico.propietario_email;
    // Fallback: email canónico
    return "nicolas@voltisenergia.com";
  };

  const pasapalabra = async (tareaId, destinatarioEmail) => {
    const tarea = tareasCorcho.find(t => t.id === tareaId);
    if (!tarea) return;

    // Resolver el email final: si es Nico, usar el email consistente con las tareas existentes
    const esDestinatarioNico = destinatarioEmail === "nicolas@voltisenergia.com" || destinatarioEmail === "nicolasvoltis@gmail.com";
    const emailFinal = esDestinatarioNico ? resolverEmailNico() : destinatarioEmail;

    // Calcular nuevo orden (al final de la lista del destinatario)
    const maxOrden = tareasCorcho
      .filter(t => !t.completada && (
        t.propietario_email === emailFinal || 
        (esDestinatarioNico && (t.propietario_email === "nicolas@voltisenergia.com" || t.propietario_email === "nicolasvoltis@gmail.com"))
      ))
      .reduce((max, t) => Math.max(max, t.orden || 0), 0);

    await base44.entities.TareaCorcho.update(tareaId, {
      propietario_email: emailFinal,
      orden: maxOrden + 1
    });

    queryClient.invalidateQueries(['tareasCorcho']);
    setPasapalabraDialog(null);
    
    const nombreDestinatario = esDestinatarioNico ? "Nico" : 
      (destinatarioEmail === "iranzu@voltisenergia.com" ? "Iranzu" : 
      destinatarioEmail === "jose@voltisenergia.com" ? "José" : "Jokin");
    toast.success(`Tarea enviada a ${nombreDestinatario}`);
  };

  // Auto-eliminar tareas completadas después de 3 semanas
  useEffect(() => {
    const limpiarTareasAntiguas = async () => {
      const hoy = new Date();
      const tresSemanasAtras = new Date(hoy);
      tresSemanasAtras.setDate(tresSemanasAtras.getDate() - 21);

      const tareasAEliminar = tareasCorcho.filter(t => {
        if (!t.completada || !t.fecha_completada) return false;
        const fechaCompletada = new Date(t.fecha_completada);
        return fechaCompletada < tresSemanasAtras;
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

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceCompleted = source.droppableId === 'completadas';
    const destCompleted = destination.droppableId === 'completadas';

    // Listas ordenadas del propietario seleccionado (igual que en el render)
    const pendientes = tareasCorcho
      .filter(t => !t.completada && esPropietario(t.propietario_email, propietarioSeleccionado))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

    const completadas = tareasCorcho
      .filter(t => t.completada && esPropietario(t.propietario_email, propietarioSeleccionado))
      .sort((a, b) => {
        if (!a.fecha_completada) return 1;
        if (!b.fecha_completada) return -1;
        return new Date(b.fecha_completada) - new Date(a.fecha_completada);
      });

    const sourceList = sourceCompleted ? [...completadas] : [...pendientes];
    const destList = sourceCompleted === destCompleted ? sourceList : (destCompleted ? [...completadas] : [...pendientes]);

    const [movedTarea] = sourceList.splice(source.index, 1);

    if (sourceCompleted === destCompleted) {
      // Mismo contenedor: reordenar
      sourceList.splice(destination.index, 0, movedTarea);

      // Actualización optimista inmediata
      queryClient.setQueryData(['tareasCorcho'], (old) => {
        if (!old) return old;
        const otherTareas = old.filter(t => !(esPropietario(t.propietario_email, propietarioSeleccionado) && t.completada === sourceCompleted));
        return [...otherTareas, ...sourceList.map((t, i) => ({ ...t, orden: i }))];
      });

      // Guardar en servidor solo las tareas que cambiaron de orden
      for (let i = 0; i < sourceList.length; i++) {
        if (sourceList[i].orden !== i) {
          base44.entities.TareaCorcho.update(sourceList[i].id, {
            orden: i,
            propietario_email: sourceList[i].propietario_email || propietarioSeleccionado,
          });
        }
      }
    } else {
      // Entre columnas: mover y reordenar destino
      const timestamp = destCompleted ? new Date().toISOString() : null;
      const updatedMoved = { ...movedTarea, completada: destCompleted, fecha_completada: timestamp };
      destList.splice(destination.index, 0, updatedMoved);

      // Actualización optimista
      queryClient.setQueryData(['tareasCorcho'], (old) => {
        if (!old) return old;
        const rest = old.filter(t => t.id !== movedTarea.id && !(esPropietario(t.propietario_email, propietarioSeleccionado) && t.completada === destCompleted));
        return [...rest, ...destList.map((t, i) => ({ ...t, orden: i }))];
      });

      // Guardar en servidor
      base44.entities.TareaCorcho.update(movedTarea.id, {
        completada: destCompleted,
        fecha_completada: timestamp,
        propietario_email: movedTarea.propietario_email || propietarioSeleccionado,
        orden: destination.index,
      });
      for (let i = 0; i < destList.length; i++) {
        if (destList[i].id !== movedTarea.id) {
          base44.entities.TareaCorcho.update(destList[i].id, {
            orden: i,
            propietario_email: destList[i].propietario_email || propietarioSeleccionado,
          });
        }
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isNico = user?.email === "nicolasvoltis@gmail.com" || user?.email === "nicolas@voltisenergia.com";
  const isIranzu = user?.email === "iranzu@voltisenergia.com";
  const isJose = user?.email === "jose@voltisenergia.com";
  const isJokin = user?.email === "jokin@voltisenergia.com";
  const tieneAccesoCorcho = isNico || isIranzu || isJose || isJokin;

  // Helper para comparar propietario - Nico tiene dos emails posibles que comparten el mismo corcho
  const esPropietario = (tareaEmail, selectorEmail) => {
    const EMAILS_NICO = ["nicolas@voltisenergia.com", "nicolasvoltis@gmail.com"];
    const selectorEsNico = EMAILS_NICO.includes(selectorEmail);
    const tareaEsNico = EMAILS_NICO.includes(tareaEmail);
    if (selectorEsNico && tareaEsNico) return true;
    return tareaEmail === selectorEmail;
  };

  // Opciones de pasapalabra para cada usuario (a quién puede enviar)
  const PASAPALABRA_OPCIONES = {
    "nicolasvoltis@gmail.com": ["iranzu@voltisenergia.com", "jose@voltisenergia.com", "jokin@voltisenergia.com"],
    "nicolas@voltisenergia.com": ["iranzu@voltisenergia.com", "jose@voltisenergia.com", "jokin@voltisenergia.com"],
    "iranzu@voltisenergia.com": ["nicolasvoltis@gmail.com", "nicolas@voltisenergia.com", "jose@voltisenergia.com", "jokin@voltisenergia.com"],
    "jose@voltisenergia.com": ["nicolasvoltis@gmail.com", "nicolas@voltisenergia.com", "iranzu@voltisenergia.com", "jokin@voltisenergia.com"],
    "jokin@voltisenergia.com": ["nicolasvoltis@gmail.com", "nicolas@voltisenergia.com", "iranzu@voltisenergia.com", "jose@voltisenergia.com"],
  };

  const NOMBRES_CORTOS = {
    "nicolasvoltis@gmail.com": "Nico",
    "nicolas@voltisenergia.com": "Nico",
    "iranzu@voltisenergia.com": "Iranzu",
    "jose@voltisenergia.com": "José",
    "jokin@voltisenergia.com": "Jokin",
  };

  const opcionesPasapalabra = PASAPALABRA_OPCIONES[user?.email] || [];

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
        es_tarea: false,
        completada: evento.completada || false
      }));
  });

  // Filtrar tareas independientes según rol
  const tareasIndependientes = tareas
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
      propietario_email: tarea.propietario_email,
      completada: tarea.completada
    }));

  // Agregar tareas del corcho con fecha al calendario (filtrado por propietario)
  const tareasConFecha = tieneAccesoCorcho ? tareasCorcho
    .filter(t => t.fecha && t.propietario_email === user.email)
    .map(t => ({
      id: `corcho-${t.id}`,
      tarea_corcho_id: t.id,
      fecha: t.fecha,
      descripcion: t.descripcion,
      color: "azul",
      cliente_nombre: "Tarea",
      es_tarea_corcho: true,
      tiene_alerta: t.tiene_alerta,
      completada: t.completada
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
    const eventos = eventosRelevantes.filter(e => e.fecha === dateStr);
    // Ordenar: no completados primero, luego completados
    return eventos.sort((a, b) => {
      if (a.completada === b.completada) return 0;
      return a.completada ? 1 : -1;
    });
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
                       className={`hover:shadow-md transition-shadow ${
                         evento.completada ? "bg-green-50 border-green-200" : ""
                       }`}
                     >
                       <CardContent className="p-3">
                         <div className="flex items-start gap-2">
                           <div
                             className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                               evento.completada ? "bg-green-500" :
                               evento.color === "verde" ? "bg-green-500" : 
                               evento.color === "rojo" ? "bg-red-500" : 
                               evento.color === "azul" ? "bg-blue-500" : "bg-yellow-500"
                             }`}
                           />
                           <div className="flex-1 min-w-0">
                             <div 
                               className={evento.es_tarea ? "" : "cursor-pointer hover:underline"}
                               onClick={() => !evento.es_tarea && navigate(createPageUrl(`DetalleCliente?id=${evento.cliente_id}`))}
                             >
                               <div className="flex items-center gap-2 mb-1">
                                 <span className={`font-semibold text-sm truncate ${
                                   evento.completada ? "text-green-700 line-through" :
                                   evento.es_tarea ? "text-purple-600" : 
                                   evento.es_tarea_corcho ? "text-blue-600" : "text-[#004D9D]"
                                 }`}>
                                   {evento.cliente_nombre}
                                 </span>
                                 {evento.tiene_alerta && !evento.completada && (
                                   <AlertCircle className="w-4 h-4 text-red-500" />
                                 )}

                               </div>
                               <p className={`text-xs ${evento.completada ? "text-gray-500 line-through" : "text-gray-600"}`}>
                                 {evento.descripcion}
                               </p>
                             </div>
                             <div className="flex items-center gap-1 mt-2">
                               {!evento.completada && (
                                 <Button
                                   size="icon"
                                   variant="ghost"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     if (evento.es_tarea_corcho) {
                                       completarTareaCorchoMutation.mutate(evento.tarea_corcho_id);
                                     } else {
                                       completarEventMutation.mutate({
                                         clienteId: evento.cliente_id,
                                         eventoId: evento.id,
                                         esTarea: evento.es_tarea,
                                         tareaId: evento.tarea_id
                                       });
                                     }
                                   }}
                                   className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                 >
                                   <CheckCircle2 className="w-4 h-4" />
                                 </Button>
                               )}
                               <Button
                                 size="icon"
                                 variant="ghost"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (evento.es_tarea_corcho) {
                                     deleteTareaCorchoMutation.mutate(evento.tarea_corcho_id);
                                   } else {
                                     deleteEventMutation.mutate({
                                       clienteId: evento.cliente_id,
                                       eventoId: evento.id,
                                       esTarea: evento.es_tarea,
                                       tareaId: evento.tarea_id
                                     });
                                   }
                                 }}
                                 className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                               >
                                 <Trash2 className="w-4 h-4" />
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

      {/* Corcho de Tareas - Para Nico, Iranzu y José */}
      {tieneAccesoCorcho && (
        <div className="mt-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-[#004D9D] flex items-center gap-3">
                <StickyNote className="w-7 h-7" />
                Corcho de Tareas
              </h2>
              {isNico && (
                <Select value={propietarioSeleccionado} onValueChange={setPropietarioSeleccionado}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nicolasvoltis@gmail.com">Nico</SelectItem>
                    <SelectItem value="iranzu@voltisenergia.com">Iranzu</SelectItem>
                    <SelectItem value="jose@voltisenergia.com">José</SelectItem>
                    <SelectItem value="jokin@voltisenergia.com">Jokin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
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
                    Por Realizar ({tareasCorcho.filter(t => !t.completada && esPropietario(t.propietario_email, propietarioSeleccionado)).length})
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
                          .filter(t => !t.completada && esPropietario(t.propietario_email, propietarioSeleccionado))
                          .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
                          .map((tarea, index) => (
                            <Draggable key={tarea.id} draggableId={tarea.id} index={index}>
                              {(provided, snapshot) => {
                                const clienteIdMatch = tarea.notas?.match(/Cliente ID:\s*([a-f0-9]+)/i);
                                const clienteId = clienteIdMatch?.[1];
                                const handleClick = () => {
                                  if (clienteId) {
                                    navigate(createPageUrl(`DetalleCliente?id=${clienteId}`));
                                  }
                                };

                                return (
                                 <Card
                                   ref={provided.innerRef}
                                   {...provided.draggableProps}
                                   {...provided.dragHandleProps}
                                   onClick={handleClick}
                                   className={`${
                                     tarea.tiene_alerta ? 'border-2 border-red-500 bg-red-50' : 'hover:shadow-lg'
                                   } transition-shadow ${snapshot.isDragging ? 'shadow-2xl' : ''} border-l-4 ${
                                     tarea.prioridad === 'rojo' ? 'border-l-red-500' : 
                                     tarea.prioridad === 'amarillo' ? 'border-l-yellow-500' : 
                                     'border-l-green-500'
                                   } ${clienteId ? 'cursor-pointer' : ''}`}
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
                                          <div className={`w-1 h-1 rounded-full mt-2 flex-shrink-0 ${
                                            tarea.prioridad === 'rojo' ? 'bg-red-500' : 
                                            tarea.prioridad === 'amarillo' ? 'bg-yellow-500' : 
                                            'bg-green-500'
                                          }`} />
                                          <div className="flex-1 cursor-pointer" onClick={() => {
                                            // Extraer cliente_id de las notas (formato: "Cliente ID: xxxxx")
                                            const clienteIdMatch = tarea.notas?.match(/Cliente ID:\s*([a-f0-9]+)/i);
                                            const clienteId = clienteIdMatch?.[1];
                                            if (clienteId) {
                                              navigate(createPageUrl(`DetalleCliente?id=${clienteId}`));
                                            }
                                          }}>
                                            <p className="font-semibold text-gray-800 mb-1 hover:text-[#004D9D] hover:underline">{tarea.descripcion}</p>
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
                                          <div className="flex items-center gap-2 flex-wrap">
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               setEditingTareaCorcho(tarea);
                                             }}
                                           >
                                             ✏️ Editar
                                           </Button>
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               toggleAlertaMutation.mutate({ id: tarea.id, tiene_alerta: tarea.tiene_alerta });
                                             }}
                                             className={tarea.tiene_alerta ? "border-red-500 text-red-600" : ""}
                                           >
                                             <AlertCircle className="w-4 h-4 mr-1" />
                                             {tarea.tiene_alerta ? "Quitar" : "Alerta"}
                                           </Button>
                                           <Button
                                             size="sm"
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               completarTareaCorchoMutation.mutate(tarea.id);
                                             }}
                                             className="bg-green-600"
                                           >
                                             ✓ Hecha
                                           </Button>
                                           {tieneAccesoCorcho && (
                                             <Button
                                               size="icon"
                                               variant="ghost"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setPasapalabraDialog({ tareaId: tarea.id, descripcion: tarea.descripcion });
                                               }}
                                               className="h-7 w-7 text-orange-500 hover:text-orange-700 hover:bg-orange-50"
                                               title="Pasapalabra"
                                             >
                                               <ArrowRightLeft className="w-4 h-4" />
                                             </Button>
                                           )}
                                         </div>
                                        </div>
                                        </>
                                        )}
                                        </CardContent>
                                        </Card>
                                        );
                                        }}
                                        </Draggable>
                          ))}
                        {provided.placeholder}
                        {tareasCorcho.filter(t => !t.completada && esPropietario(t.propietario_email, propietarioSeleccionado)).length === 0 && (
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
                  <CardTitle 
                    className={`text-white ${isNico ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => {
                      if (isNico) {
                        setShowHistorial(true);
                        setHistorialSearchTerm("");
                        setHistorialFilterUsuario("todos");
                      }
                    }}
                  >
                    Realizadas ({tareasCorcho.filter(t => t.completada && esPropietario(t.propietario_email, propietarioSeleccionado)).length})
                    {isNico && <span className="text-xs ml-2 opacity-75">📜 click para ver historial</span>}
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
                          .filter(t => t.completada && esPropietario(t.propietario_email, propietarioSeleccionado))
                          .sort((a, b) => {
                            // Ordenar por fecha_completada descendente (más reciente primero)
                            if (!a.fecha_completada) return 1;
                            if (!b.fecha_completada) return -1;
                            return new Date(b.fecha_completada) - new Date(a.fecha_completada);
                          })
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
                                      </div>
                                      {isNico && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => deleteTareaCorchoMutation.mutate(tarea.id)}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                    {tarea.fecha_completada && (
                                      <div className="text-right mt-2">
                                        <span className="text-xs text-gray-500">
                                          {new Date(tarea.fecha_completada).toLocaleString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        {tareasCorcho.filter(t => t.completada && esPropietario(t.propietario_email, propietarioSeleccionado)).length === 0 && (
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
                    setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null, prioridad: "verde", propietario_email: "" });
                  } else {
                    setTareasMultiples([
                      { descripcion: "", prioridad: "verde" },
                      { descripcion: "", prioridad: "verde" },
                      { descripcion: "", prioridad: "verde" }
                    ]);
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
                  <label className="text-sm font-medium mb-1 block">Prioridad</label>
                  <div className="flex gap-2">
                    {[
                      { value: "rojo", label: "Alta", bg: "bg-red-500" },
                      { value: "amarillo", label: "Media", bg: "bg-yellow-500" },
                      { value: "verde", label: "Baja", bg: "bg-green-500" }
                    ].map(({ value, label, bg }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNewTareaCorcho({ ...newTareaCorcho, prioridad: value })}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all ${
                          newTareaCorcho.prioridad === value
                            ? `${bg} border-gray-800 text-white font-semibold`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${bg}`} />
                          <span className="text-sm">{label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
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
                      <div key={index} className="flex gap-2">
                        <Input
                          ref={(el) => (inputRefs.current[index] = el)}
                          value={tarea.descripcion}
                          onChange={(e) => {
                            const nuevas = [...tareasMultiples];
                            nuevas[index] = { ...nuevas[index], descripcion: e.target.value };
                            setTareasMultiples(nuevas);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (index === tareasMultiples.length - 1) {
                                setTareasMultiples([...tareasMultiples, { descripcion: "", prioridad: "verde" }]);
                                setTimeout(() => {
                                  inputRefs.current[index + 1]?.focus();
                                }, 0);
                              } else {
                                inputRefs.current[index + 1]?.focus();
                              }
                            }
                          }}
                          placeholder={`Tarea ${index + 1}`}
                          className="flex-1"
                        />
                        <Select
                          value={tarea.prioridad}
                          onValueChange={(value) => {
                            const nuevas = [...tareasMultiples];
                            nuevas[index] = { ...nuevas[index], prioridad: value };
                            setTareasMultiples(nuevas);
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rojo">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                <span>Alta</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="amarillo">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                <span>Media</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="verde">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span>Baja</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTareasMultiples([...tareasMultiples, { descripcion: "", prioridad: "verde" }]);
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
                setNewTareaCorcho({ descripcion: "", notas: "", fecha: "", audio_url: null, prioridad: "verde", propietario_email: "" });
                setTareasMultiples([
                  { descripcion: "", prioridad: "verde" },
                  { descripcion: "", prioridad: "verde" },
                  { descripcion: "", prioridad: "verde" }
                ]);
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
                  createTareaCorchoMutation.mutate({ ...newTareaCorcho, propietario_email: propietarioSeleccionado || user.email });
                } else {
                  const tareasValidas = tareasMultiples.filter(t => t.descripcion.trim() !== "");
                  if (tareasValidas.length === 0) {
                    toast.error("Añade al menos una descripción");
                    return;
                  }
                  createTareasMultiplesMutation.mutate({ tareas: tareasValidas, propietarioEmail: propietarioSeleccionado || user.email });
                }
              }}
              className="bg-[#004D9D]"
              >
              Crear {modoMultiple && tareasMultiples.filter(t => t.descripcion.trim()).length > 0 ? `(${tareasMultiples.filter(t => t.descripcion.trim()).length})` : "Tarea"}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para historial de tareas */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D] flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              Historial Completo de Tareas
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar tarea..."
                value={historialSearchTerm}
                onChange={(e) => setHistorialSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={historialFilterUsuario} onValueChange={setHistorialFilterUsuario}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los usuarios</SelectItem>
                <SelectItem value="nicolasvoltis@gmail.com">Nico</SelectItem>
                <SelectItem value="iranzu@voltisenergia.com">Iranzu</SelectItem>
                <SelectItem value="jose@voltisenergia.com">José</SelectItem>
                <SelectItem value="jokin@voltisenergia.com">Jokin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-y-auto max-h-[60vh] space-y-3">
            {tareasCorcho
              .filter(t => {
                if (!t.completada) return false;
                
                // Filtrar por usuario
                if (historialFilterUsuario !== "todos" && t.propietario_email !== historialFilterUsuario) {
                  return false;
                }
                
                // Filtrar por búsqueda
                if (historialSearchTerm.trim() !== "") {
                  const searchLower = historialSearchTerm.toLowerCase();
                  const descripcionMatch = t.descripcion?.toLowerCase().includes(searchLower);
                  const notasMatch = t.notas?.toLowerCase().includes(searchLower);
                  return descripcionMatch || notasMatch;
                }
                
                return true;
              })
              .sort((a, b) => {
                if (!a.fecha_completada) return 1;
                if (!b.fecha_completada) return -1;
                return new Date(b.fecha_completada) - new Date(a.fecha_completada);
              })
              .map((tarea) => {
                const propietario = usuarios.find(u => u.email === tarea.propietario_email);
                return (
                  <Card key={tarea.id} className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-700 line-through">{tarea.descripcion}</p>
                            {propietario && (
                              <Badge variant="outline" className="text-xs">
                                {propietario.iniciales || propietario.full_name}
                              </Badge>
                            )}
                          </div>
                          {tarea.notas && (
                            <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{tarea.notas}</p>
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
                            <span className="text-xs text-gray-500 mt-2 block">
                              ✓ {new Date(tarea.fecha_completada).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm("¿Eliminar esta tarea del historial?")) {
                              deleteTareaCorchoMutation.mutate(tarea.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            {tareasCorcho
              .filter(t => {
                if (!t.completada) return false;
                if (historialFilterUsuario !== "todos" && t.propietario_email !== historialFilterUsuario) return false;
                if (historialSearchTerm.trim() !== "") {
                  const searchLower = historialSearchTerm.toLowerCase();
                  return t.descripcion?.toLowerCase().includes(searchLower) || t.notas?.toLowerCase().includes(searchLower);
                }
                return true;
              }).length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay tareas que coincidan con la búsqueda</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Pasapalabra */}
      {pasapalabraDialog && (() => {
        // Si Nico está viendo el corcho de otra persona, actuar como si fuera esa persona
        const usuarioEfectivo = (isNico && propietarioSeleccionado !== "nicolasvoltis@gmail.com" && propietarioSeleccionado !== "nicolas@voltisenergia.com")
          ? propietarioSeleccionado
          : user.email;

        let opciones = [];
        const esNicoEfectivo = usuarioEfectivo === "nicolas@voltisenergia.com" || usuarioEfectivo === "nicolasvoltis@gmail.com";
        const esIranzuEfectivo = usuarioEfectivo === "iranzu@voltisenergia.com";
        const esJoseEfectivo = usuarioEfectivo === "jose@voltisenergia.com";
        const esJokinEfectivo = usuarioEfectivo === "jokin@voltisenergia.com";

        if (esNicoEfectivo) {
          opciones = [
            { email: "iranzu@voltisenergia.com", nombre: "Iranzu" },
            { email: "jose@voltisenergia.com", nombre: "José" },
            { email: "jokin@voltisenergia.com", nombre: "Jokin" },
          ];
        } else if (esIranzuEfectivo) {
          opciones = [
            { email: "nicolas@voltisenergia.com", nombre: "Nico" },
            { email: "jose@voltisenergia.com", nombre: "José" },
            { email: "jokin@voltisenergia.com", nombre: "Jokin" },
          ];
        } else if (esJoseEfectivo) {
          opciones = [
            { email: "nicolas@voltisenergia.com", nombre: "Nico" },
            { email: "iranzu@voltisenergia.com", nombre: "Iranzu" },
            { email: "jokin@voltisenergia.com", nombre: "Jokin" },
          ];
        } else if (esJokinEfectivo) {
          opciones = [
            { email: "nicolas@voltisenergia.com", nombre: "Nico" },
            { email: "iranzu@voltisenergia.com", nombre: "Iranzu" },
            { email: "jose@voltisenergia.com", nombre: "José" },
          ];
        }
        return (
          <Dialog open={!!pasapalabraDialog} onOpenChange={() => setPasapalabraDialog(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-center text-2xl font-extrabold text-orange-500 tracking-wide">
                  ¡PASAPALABRA!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6908eb4fae82961ef57549fe/e576b734b_image.png" 
                    alt="Pasapalabra" 
                    className="w-48 h-48 object-cover rounded-xl"
                  />
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-orange-600 font-semibold mb-1">Tarea:</p>
                  <p className="text-sm text-gray-800">{pasapalabraDialog.descripcion}</p>
                </div>
                <p className="text-sm text-gray-600 text-center font-medium">¿A quién se la mandas?</p>
                <div className="space-y-2">
                  {opciones.map(({ email, nombre }) => (
                    <Button
                      key={email}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white text-base font-bold py-5"
                      onClick={() => pasapalabra(pasapalabraDialog.tareaId, email)}
                    >
                      → {nombre}
                    </Button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="w-full" onClick={() => setPasapalabraDialog(null)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

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
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <Input
                 placeholder="Buscar cliente o dejar vacío para tarea personal..."
                 value={searchClienteTerm}
                 onChange={(e) => setSearchClienteTerm(e.target.value)}
                 className="pl-9"
               />
             </div>

             <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
               {searchClienteTerm === "" && (
                 <button
                   onClick={() => {
                     setNewEvent({ ...newEvent, cliente_id: "" });
                     setSearchClienteTerm("");
                   }}
                   className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                     newEvent.cliente_id === "" ? "bg-blue-50 border-l-4 border-blue-500" : ""
                   }`}
                 >
                   <span className="text-gray-500 italic text-sm">Sin cliente - Tarea personal</span>
                 </button>
               )}
               {misClientes
                 .filter(c => 
                   c.nombre_negocio?.toLowerCase().includes(searchClienteTerm.toLowerCase()) ||
                   c.nombre_cliente?.toLowerCase().includes(searchClienteTerm.toLowerCase())
                 )
                 .map(cliente => (
                   <button
                     key={cliente.id}
                     onClick={() => {
                       setNewEvent({ ...newEvent, cliente_id: cliente.id });
                       setSearchClienteTerm(cliente.nombre_negocio);
                     }}
                     className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                       newEvent.cliente_id === cliente.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                     }`}
                   >
                     <div className="flex items-center justify-between">
                       <span className="text-sm font-medium">{cliente.nombre_negocio}</span>
                       {isAdmin && (
                         <span className="text-xs text-gray-500">({cliente.propietario_iniciales})</span>
                       )}
                     </div>
                     {cliente.nombre_cliente && (
                       <span className="text-xs text-gray-500">{cliente.nombre_cliente}</span>
                     )}
                   </button>
                 ))}
               {misClientes.filter(c => 
                 c.nombre_negocio?.toLowerCase().includes(searchClienteTerm.toLowerCase()) ||
                 c.nombre_cliente?.toLowerCase().includes(searchClienteTerm.toLowerCase())
               ).length === 0 && searchClienteTerm !== "" && (
                 <div className="px-3 py-6 text-center text-gray-500 text-sm">
                   No se encontraron clientes
                 </div>
               )}
             </div>
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
                  {isAdmin ? (
                    <>
                      <SelectItem value="rojo">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full" />
                          <span>Alta</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="amarillo">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                          <span>Media</span>
                        </div>
                      </SelectItem>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewEvent({ cliente_id: "", descripcion: "", color: isAdmin ? "rojo" : "verde" });
                setSearchClienteTerm("");
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