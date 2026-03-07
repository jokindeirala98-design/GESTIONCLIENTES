import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Building2, User, Phone, Mail, MapPin,
  Trash2, Edit, X, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import EditClienteDialog from "../components/clientes/EditClienteDialog.jsx";
import SuministrosSection from "../components/clientes/SuministrosSection.jsx";
import EventosSection from "../components/clientes/EventosSection.jsx";
import DocumentosClienteSection from "../components/clientes/DocumentosClienteSection.jsx";
import ContratoClienteSection from "../components/clientes/ContratoClienteSection.jsx";
import ClientesVinculadosSection from "../components/clientes/ClientesVinculadosSection.jsx";
import PlanPagoSection from "../components/suscripciones/PlanPagoSection.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { recalcularRappelComercial, aplicarActualizacionesRappel } from "../components/utils/rappelComisiones";

const estadoColors = {
  "Primer contacto": "bg-gray-500",
  "Esperando facturas": "bg-orange-500",
  "Facturas presentadas": "bg-blue-500",
  "Informe listo": "bg-green-500",
  "Pendiente de firma": "bg-purple-500",
  "Pendiente de aprobación": "bg-yellow-600",
  "Firmado con éxito": "bg-green-700",
  "Rechazado": "bg-red-500",
};

const TODOS_ESTADOS = [
  "Primer contacto",
  "Esperando facturas",
  "Facturas presentadas",
  "Pendiente informe potencias",
  "Informe listo",
  "Pendiente de firma",
  "Pendiente de aprobación",
  "Firmado con éxito",
  "Rechazado",
  "Ignorado con mucho éxito",
];

// Estados que implican que ya hay informes subidos
const ESTADOS_CON_INFORMES = ["Informe listo", "Pendiente de firma", "Pendiente de aprobación", "Firmado con éxito"];
// Estados anteriores a tener informes
const ESTADOS_SIN_INFORMES = ["Primer contacto", "Esperando facturas", "Facturas presentadas", "Pendiente informe potencias", "Rechazado", "Ignorado con mucho éxito"];

export default function DetalleCliente() {
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [user, setUser] = useState(null);
   const [showEditDialog, setShowEditDialog] = useState(false);
   const [showPropietarioPopover, setShowPropietarioPopover] = useState(false);
   const [showEstadoSelector, setShowEstadoSelector] = useState(false);
   const [optimisticEstado, setOptimisticEstado] = useState(null);

   const urlParams = new URLSearchParams(window.location.search);
   const clienteId = urlParams.get('id');
   const from = urlParams.get('from');
   const tab = urlParams.get('tab');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      // Intentar obtener del caché de la lista primero
      const cached = queryClient.getQueryData(['clientes']);
      if (cached) {
        const found = cached.find(c => c.id === clienteId);
        if (found) return found;
      }
      const results = await base44.entities.Cliente.filter({ id: clienteId });
      return results[0] ?? null;
    },
    enabled: !!clienteId,
    staleTime: 30_000,
  });

  const { data: zona } = useQuery({
    queryKey: ['zona', cliente?.zona_id],
    queryFn: async () => {
      if (!cliente?.zona_id) return null;
      const cached = queryClient.getQueryData(['zonas']);
      if (cached) {
        const found = cached.find(z => z.id === cliente.zona_id);
        if (found) return found;
      }
      const results = await base44.entities.Zona.filter({ id: cliente.zona_id });
      return results[0] ?? null;
    },
    enabled: !!cliente?.zona_id,
    staleTime: 60_000,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: user?.role === 'admin',
  });

  const comerciales = usuarios.filter(u => u.role === 'user' || u.role === 'admin');

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cliente', clienteId]);
      queryClient.invalidateQueries(['clientes']);
      toast.success("Cliente actualizado");
      setOptimisticEstado(null);
    },
    onError: () => {
      setOptimisticEstado(null);
      toast.error("Error al actualizar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cliente.delete(id),
    onSuccess: () => {
      toast.success("Cliente eliminado");
      navigate(createPageUrl("Clientes"));
    },
  });



  // NUEVO: Verificar y corregir estados automáticamente al cargar
  useEffect(() => {
    if (!cliente || !cliente.suministros || cliente.suministros.length === 0) return;
    
    // Solo considerar suministros NO cerrados
    const suministrosActivos = cliente.suministros.filter(s => !s.cerrado);
    
    if (suministrosActivos.length === 0) {
      // Todos los suministros cerrados → mantener en "Firmado con éxito"
      if (cliente.estado !== "Firmado con éxito") {
        updateMutation.mutate({
          id: clienteId,
          data: { estado: "Firmado con éxito" }
        });
      }
      return;
    }
    
    const estadosFinales = ["Informe listo", "Pendiente de firma", "Pendiente de aprobación", "Firmado con éxito", "Rechazado"];
    
    // No tocar clientes en estados finales (o estados que requieren aprobación)
    if (estadosFinales.includes(cliente.estado)) return;

    // Verificar si todos los suministros ACTIVOS tienen al menos 1 factura
    const todosConFacturas = suministrosActivos.every(s => 
      s.facturas && s.facturas.length > 0
    );
    
    // Verificar si todos los suministros ACTIVOS tienen informe final
    const todosConInforme = suministrosActivos.every(s => {
      if (!s.informe_final) return false;
      const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
        a && a.url && a.url.trim() !== '' && a.url !== 'null'
      );
      const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
      return tieneArchivosValidos || tieneUrlValida;
    });

    // Corregir estado si es necesario
    if (todosConInforme && cliente.estado !== "Informe listo") {
      console.log("Auto-corrección: Cambiando a Informe listo");
      updateMutation.mutate({
        id: clienteId,
        data: { estado: "Informe listo" }
      });
    } else if (todosConFacturas && !todosConInforme && !["Facturas presentadas", "Pendiente informe potencias"].includes(cliente.estado)) {
      console.log("Auto-corrección: Cambiando a Facturas presentadas");
      updateMutation.mutate({
        id: clienteId,
        data: { estado: "Facturas presentadas" }
      });
    }
  }, [cliente?.id, cliente?.suministros, cliente?.estado]);

  const handleUpdate = (data) => {
      // Gestionar eventos automáticos según cambios de estado
      let eventosActualizados = [...(data.eventos || cliente.eventos || [])];

      // 1. Si cambia a "Facturas presentadas", eliminar evento "recordar_facturas"
      if (data.estado === "Facturas presentadas" || (data.suministros && cliente.estado !== "Facturas presentadas")) {
        const todosConFacturas = data.suministros?.length > 0 && data.suministros.every(s => 
          s.facturas && s.facturas.length > 0
        );
        if (todosConFacturas) {
          eventosActualizados = eventosActualizados.filter(e => e.tipo_automatico !== "recordar_facturas");
        }
      }

      // 2. Si cambia a "Pendiente de firma", crear evento "recordar_cierre" a 3 días
      if (data.estado === "Pendiente de firma" && cliente.estado !== "Pendiente de firma") {
        const fecha3Dias = new Date();
        fecha3Dias.setDate(fecha3Dias.getDate() + 3);
        eventosActualizados.push({
          id: Date.now().toString(),
          fecha: fecha3Dias.toISOString().split('T')[0],
          descripcion: "Recordar el cierre",
          color: "amarillo",
          tipo_automatico: "recordar_cierre"
        });
      }

      // 3. Si se aprueba un cierre (admin marca como aprobado), crear eventos de feedback
      // O si el estado cambia a "Firmado con éxito", crear eventos de feedback
      const estaAprobandoCierre = data.aprobado_admin === true && cliente.aprobado_admin !== true;
      const cambiaAFirmado = data.estado === "Firmado con éxito" && cliente.estado !== "Firmado con éxito";
      
      if ((estaAprobandoCierre || cambiaAFirmado) && (data.fecha_cierre || cliente.fecha_cierre)) {
        const fechaCierre = new Date(data.fecha_cierre || cliente.fecha_cierre);
        
        // Eliminar evento "recordar_cierre" si existe
        eventosActualizados = eventosActualizados.filter(e => e.tipo_automatico !== "recordar_cierre");
        
        // Eliminar eventos de feedback previos para evitar duplicados
        eventosActualizados = eventosActualizados.filter(e => 
          !['feedback_2meses', 'feedback_6meses', 'feedback_1año'].includes(e.tipo_automatico)
        );

        // Crear eventos de feedback
        const fecha2Meses = new Date(fechaCierre);
        fecha2Meses.setMonth(fecha2Meses.getMonth() + 2);
        eventosActualizados.push({
          id: `${Date.now()}_2m`,
          fecha: fecha2Meses.toISOString().split('T')[0],
          descripcion: "Preguntar por feedback",
          color: "amarillo",
          tipo_automatico: "feedback_2meses"
        });

        const fecha6Meses = new Date(fechaCierre);
        fecha6Meses.setMonth(fecha6Meses.getMonth() + 6);
        eventosActualizados.push({
          id: `${Date.now()}_6m`,
          fecha: fecha6Meses.toISOString().split('T')[0],
          descripcion: "Preguntar por feedback",
          color: "amarillo",
          tipo_automatico: "feedback_6meses"
        });

        const fecha1Año = new Date(fechaCierre);
        fecha1Año.setFullYear(fecha1Año.getFullYear() + 1);
        eventosActualizados.push({
          id: `${Date.now()}_1y`,
          fecha: fecha1Año.toISOString().split('T')[0],
          descripcion: "Preguntar por feedback",
          color: "amarillo",
          tipo_automatico: "feedback_1año"
        });
      }

      // LIMPIEZA PREVENTIVA: Eliminar informes corruptos
      if (data.suministros) {
        data.suministros = data.suministros.map(s => {
          if (s.informe_final) {
            const archivosValidos = s.informe_final.archivos?.filter(a => 
              a && a.url && a.url.trim() && a.url !== 'null'
            ) || [];
            const tieneUrlLegacy = s.informe_final.url && 
              s.informe_final.url.trim() && s.informe_final.url !== 'null';

            if (archivosValidos.length === 0 && !tieneUrlLegacy) {
              const { informe_final, ...resto } = s;
              return resto;
            }
          }
          return s;
        });
      
      // Solo considerar suministros NO cerrados para el cálculo del estado
      const suministrosActivos = data.suministros.filter(s => !s.cerrado);
      
      if (suministrosActivos.length === 0) {
        // Todos cerrados → mantener en "Firmado con éxito"
        if (cliente.estado !== "Firmado con éxito") {
          updateMutation.mutate({
            id: clienteId,
            data: { ...data, estado: "Firmado con éxito", eventos: eventosActualizados }
          });
        }
        return;
      }
      
      const todosConFacturas = suministrosActivos.every(s => 
        s.facturas && s.facturas.length > 0
      );
      
      const estadosFinales = ["Informe listo", "Pendiente de firma", "Pendiente de aprobación", "Firmado con éxito", "Rechazado"];
      const estadosIntermedios = ["Facturas presentadas", "Pendiente informe potencias"];
      if (todosConFacturas && !estadosFinales.includes(cliente.estado) && !estadosIntermedios.includes(cliente.estado)) {
        console.log("Cambiando a Facturas presentadas - todos los suministros activos tienen facturas");
        eventosActualizados = eventosActualizados.filter(e => e.tipo_automatico !== "recordar_facturas");
        updateMutation.mutate({
          id: clienteId,
          data: { ...data, estado: "Facturas presentadas", eventos: eventosActualizados }
        });
        return;
      }

      const todosConInforme = suministrosActivos.every(s => {
        if (!s.informe_final) return false;
        const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
          a && a.url && a.url.trim() !== '' && a.url !== 'null'
        );
        const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
        return tieneArchivosValidos || tieneUrlValida;
      });

      if (todosConInforme && ["Facturas presentadas", "Pendiente informe potencias"].includes(cliente.estado)) {
        console.log("Cambiando a Informe listo - todos los suministros activos tienen informe");
        updateMutation.mutate({
          id: clienteId,
          data: { ...data, estado: "Informe listo", eventos: eventosActualizados }
        });
        return;
      }
    }

    updateMutation.mutate({ id: clienteId, data: { ...data, eventos: eventosActualizados } });
  };

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar el cliente "${cliente.nombre_negocio}"?`)) {
      deleteMutation.mutate(clienteId);
    }
  };

  const handleMarcarRechazado = () => {
    if (window.confirm("¿Marcar este cliente como Rechazado?")) {
      updateMutation.mutate({
        id: clienteId,
        data: { estado: "Rechazado" }
      });
    }
  };

  const handleMarcarFirmado = async () => {
    if (window.confirm("¿Marcar este cliente como Firmado con éxito?")) {
      const fechaCierre = new Date().toISOString().split('T')[0];
      const mesComision = fechaCierre.substring(0, 7);
      
      // Marcar todos los suministros NO cerrados como cerrados
      const suministrosActualizados = (cliente.suministros || []).map(s => {
        if (s.cerrado) return s; // Ya cerrado, no tocar
        return {
          ...s,
          cerrado: true,
          fecha_cierre_suministro: fechaCierre,
          mes_comision_suministro: mesComision
        };
      });
      
      let updateData = { suministros: suministrosActualizados };
      let aprobandoAhora = false;

      if (isAdmin && cliente.estado === "Pendiente de aprobación") {
        updateData = {
          ...updateData,
          estado: "Firmado con éxito",
          fecha_cierre: cliente.fecha_cierre || fechaCierre,
          mes_comision: cliente.mes_comision || mesComision,
          aprobado_admin: true
        };
        aprobandoAhora = true;
      } else if (isAdmin && (cliente.estado === "Informe listo" || cliente.estado === "Pendiente de firma")) {
        updateData = {
          ...updateData,
          estado: "Firmado con éxito",
          fecha_cierre: fechaCierre,
          mes_comision: mesComision,
          aprobado_admin: true
        };
        aprobandoAhora = true;
      } else {
        updateData = {
          ...updateData,
          estado: "Pendiente de aprobación",
          fecha_cierre: fechaCierre,
          mes_comision: mesComision,
          aprobado_admin: false
        };
      }

      // RAPPEL: Recalcular comisiones de gas/luz 2.0 para este comercial en este mes
      try {
        const todosClientes = await base44.entities.Cliente.list();
        
        // CRÍTICO: Incluir el cliente actual con sus suministros actualizados en la lista
        const clientesConActualizacion = todosClientes.map(c => 
          c.id === clienteId ? { ...cliente, suministros: updateData.suministros } : c
        );
        
        const { actualizacionesPorCliente } = recalcularRappelComercial(
          clientesConActualizacion,
          cliente.propietario_email,
          mesComision
        );

        // Aplicar actualizaciones de rappel si las hay para este cliente
        if (actualizacionesPorCliente[clienteId]) {
          const clienteConRappel = aplicarActualizacionesRappel(
            { ...cliente, suministros: updateData.suministros },
            actualizacionesPorCliente[clienteId]
          );
          updateData.suministros = clienteConRappel.suministros;
          updateData.comision = clienteConRappel.comision;
        } else {
          // Si no hay actualizaciones de rappel, calcular comisión total manualmente
          updateData.comision = updateData.suministros.reduce((sum, s) => sum + (s.comision || 0), 0);
        }

        // Actualizar OTROS clientes del mismo comercial que necesiten recalcular rappel
        for (const [otroClienteId, actualizacionesSuministros] of Object.entries(actualizacionesPorCliente)) {
          if (otroClienteId !== clienteId) {
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
        // En caso de error, calcular comisión total manualmente
        updateData.comision = updateData.suministros.reduce((sum, s) => sum + (s.comision || 0), 0);
      }

      updateMutation.mutate({
        id: clienteId,
        data: updateData
      });

      // Si es admin y está aprobando, notificar a contabilidad
      if (aprobandoAhora) {
        try {
          await base44.integrations.Core.SendEmail({
            to: "iranzu@voltisenergia.com",
            subject: `Cierre verificado - ${cliente.nombre_negocio}`,
            body: `${cliente.nombre_negocio} ha sido cerrado con éxito y está listo para contabilidad.`
          });
        } catch (error) {
          console.error("Error enviando notificación a contabilidad:", error);
        }
      }
    }
  };

  const handleEliminarInforme = (suministroId) => {
    if (!window.confirm("¿Eliminar el informe de este suministro? El cliente volverá a 'Facturas presentadas'.")) {
      return;
    }

    const nuevosSuministros = cliente.suministros.map(s => {
      if (s.id === suministroId) {
        const { informe_final, ...suministroLimpio } = s;
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

    updateMutation.mutate({
      id: clienteId,
      data: {
        suministros: nuevosSuministros,
        estado: nuevoEstado,
        comision: comisionTotal
      }
    });
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    setShowEstadoSelector(false);
    if (nuevoEstado === cliente.estado) return;
    setOptimisticEstado(nuevoEstado);

    const estaVolviendo = ESTADOS_SIN_INFORMES.includes(nuevoEstado) && ESTADOS_CON_INFORMES.includes(cliente.estado);

    let mensaje = `¿Cambiar el estado a "${nuevoEstado}"?`;
    if (estaVolviendo) {
      mensaje = `¿Cambiar el estado a "${nuevoEstado}"?\n\nAVISO: Los informes finales subidos serán eliminados.`;
    }

    if (!window.confirm(mensaje)) return;

    let updateData = { estado: nuevoEstado };

    if (estaVolviendo && cliente.suministros) {
      // Eliminar informes finales y comparativos de todos los suministros activos
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.cerrado) return s;
        const { informe_final, informe_comparativo, ...resto } = s;
        return resto;
      });
      updateData.suministros = nuevosSuministros;
      updateData.comision = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);
    }

    updateMutation.mutate({ id: clienteId, data: updateData });
  };

  const handleChangePropietario = (nuevoEmail) => {
    const nuevoPropietario = comerciales.find(u => u.email === nuevoEmail);
    if (!nuevoPropietario) return;

    updateMutation.mutate({
      id: clienteId,
      data: {
        propietario_email: nuevoEmail,
        propietario_iniciales: nuevoPropietario.iniciales || nuevoPropietario.full_name?.substring(0, 3).toUpperCase()
      }
    });
    setShowPropietarioPopover(false);
  };

  if (isLoading || !user || !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const isOwner = cliente.propietario_email === user.email;
  const isAdmin = user.role === "admin";
  const canViewFull = isOwner || isAdmin;
  const canEdit = isOwner || isAdmin;
  const estadoVisible = optimisticEstado ?? cliente.estado;

  if (!canViewFull) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Button
           variant="outline"
           onClick={() => {
             if (from === 'readyToGo' && tab) {
               navigate(createPageUrl(`ReadyToGo?tab=${tab}`));
             } else {
               window.history.back();
             }
           }}
           className="mb-6"
         >
           <ArrowLeft className="w-4 h-4 mr-2" />
           Volver
         </Button>
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-[#666666]">No tienes permisos para ver este cliente</p>
            </CardContent>
          </Card>
      </div>
    );
  }

  // Calcular tipo de factura máximo para mostrar prioridad
  const tipoFacturaMaximo = cliente.suministros?.reduce((max, s) => {
    if (!s.tipo_factura) return max;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    const actual = orden[s.tipo_factura] || 0;
    const maxActual = orden[max] || 0;
    return actual > maxActual ? s.tipo_factura : max;
  }, "2.0");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Button
        variant="outline"
        onClick={() => window.history.back()}
        className="mb-6 min-h-[44px] min-w-[44px]"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <Card className="border-l-4 mb-6" style={{ borderLeftColor: estadoColors[estadoVisible] }}>
        <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white text-2xl mb-2 flex items-center gap-3">
                <Building2 className="w-7 h-7" />
                {cliente.nombre_negocio}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Badge
                    className={`${estadoColors[estadoVisible] || 'bg-gray-500'} text-white cursor-pointer hover:opacity-80 transition-opacity select-none`}
                    onClick={() => canEdit && setShowEstadoSelector(prev => !prev)}
                    title={canEdit ? "Haz clic para cambiar el estado" : ""}
                  >
                    {estadoVisible} {canEdit && "▾"}
                  </Badge>
                  {showEstadoSelector && canEdit && (
                    <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[220px]">
                      {TODOS_ESTADOS.map(estado => (
                        <button
                          key={estado}
                          onClick={() => handleCambiarEstado(estado)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${estado === cliente.estado ? 'font-bold text-[#004D9D]' : 'text-gray-700'}`}
                        >
                          <span className={`w-2 h-2 rounded-full inline-block ${estadoColors[estado] || 'bg-gray-400'}`} />
                          {estado}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {tipoFacturaMaximo && (
                  <Badge className={
                    tipoFacturaMaximo === "6.1" ? "bg-red-600 text-white" :
                    tipoFacturaMaximo === "3.0" ? "bg-orange-600 text-white" : "bg-blue-600 text-white"
                  }>
                    Prioridad: {tipoFacturaMaximo}
                  </Badge>
                )}
              </div>
            </div>
            {isAdmin ? (
              <Popover open={showPropietarioPopover} onOpenChange={setShowPropietarioPopover}>
                <PopoverTrigger asChild>
                  <button className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                    <span className="text-white font-bold text-lg">
                      {cliente.propietario_iniciales}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Reasignar cliente a:</p>
                    <Select value={cliente.propietario_email} onValueChange={handleChangePropietario}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {comerciales.map(comercial => (
                          <SelectItem key={comercial.email} value={comercial.email}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{comercial.full_name}</span>
                              <span className="text-xs text-gray-500">({comercial.iniciales})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {cliente.propietario_iniciales}
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              {cliente.nombre_cliente && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <User className="w-5 h-5" />
                  <span>{cliente.nombre_cliente}</span>
                </div>
              )}
              {cliente.telefono && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <Phone className="w-5 h-5" />
                  <span>{cliente.telefono}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <Mail className="w-5 h-5" />
                  <span className="break-all">{cliente.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {zona && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <MapPin className="w-5 h-5" />
                  <span>{zona.nombre}</span>
                </div>
              )}
            </div>
          </div>

          {cliente.anotaciones && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-[#004D9D] mb-2">Anotaciones</h3>
              <p className="text-[#666666] whitespace-pre-wrap">{cliente.anotaciones}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
            
            {canEdit && (
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}

            {isOwner && (
              <>
                {(cliente.estado === "Primer contacto" || cliente.estado === "Esperando facturas" || cliente.estado === "Facturas presentadas") && (
                  <Button
                    variant="outline"
                    onClick={handleMarcarRechazado}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Marcar Rechazado
                  </Button>
                )}

                {cliente.estado === "Informe listo" && (
                  <Button
                    onClick={() => {
                      if (window.confirm("¿Cambiar a Pendiente de firma?")) {
                        const fechaCambio = new Date().toISOString().split('T')[0];
                        updateMutation.mutate({
                          id: cliente.id,
                          data: { 
                            estado: "Pendiente de firma",
                            fecha_cambio_pendiente_firma: fechaCambio
                          }
                        });
                      }
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    ⏳ Marcar Pendiente de Firma
                  </Button>
                )}

                {cliente.estado === "Pendiente de firma" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleMarcarRechazado}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Rechazar
                    </Button>
                    <Button
                      onClick={handleMarcarFirmado}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Firmado con Éxito
                    </Button>
                    {cliente.fecha_cambio_pendiente_firma && (
                      <div className="w-full text-xs text-orange-600 bg-orange-50 p-2 rounded">
                        📅 En pendiente desde: {new Date(cliente.fecha_cambio_pendiente_firma).toLocaleDateString('es-ES')}
                        {(() => {
                          const dias = Math.floor((new Date() - new Date(cliente.fecha_cambio_pendiente_firma)) / (1000 * 60 * 60 * 24));
                          return dias >= 25 ? ` - ⚠️ ${dias} días (auto-rechazo en ${30 - dias} días)` : '';
                        })()}
                      </div>
                    )}
                  </>
                )}
                
                {cliente.estado === "Pendiente de aprobación" && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                    <p className="text-yellow-700 font-semibold text-sm">
                      ⏳ Pendiente de aprobación por el administrador
                    </p>
                  </div>
                )}
              </>
            )}

            {isAdmin && cliente.estado !== "Firmado con éxito" && cliente.estado !== "Rechazado" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleMarcarRechazado}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                {(cliente.estado === "Informe listo" || cliente.estado === "Pendiente de firma" || cliente.estado === "Pendiente de aprobación") && (
                  <Button
                    onClick={handleMarcarFirmado}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {cliente.estado === "Pendiente de aprobación" ? "Aprobar Cierre" : "Firmado con Éxito"}
                  </Button>
                )}
              </>
            )}

            {(isAdmin || isOwner) && cliente.estado === "Rechazado" && (
              <Button
                onClick={() => {
                  if (window.confirm("¿Cambiar a Facturas presentadas para volver a procesar?")) {
                    updateMutation.mutate({
                      id: clienteId,
                      data: { estado: "Facturas presentadas" }
                    });
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                🔄 Volver a Facturas Presentadas
              </Button>
            )}
            
            {cliente.estado === "Firmado con éxito" && cliente.aprobado_admin === true && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <p className="text-green-700 font-semibold text-sm">
                  ✓ Cierre aprobado - Comisión contabilizada
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <SuministrosSection 
          cliente={cliente}
          onUpdate={handleUpdate}
          isOwnerOrAdmin={canEdit}
        />
        

        
        <DocumentosClienteSection
          cliente={cliente}
          isOwnerOrAdmin={canEdit}
          isAdmin={isAdmin}
        />

        <ContratoClienteSection
          cliente={cliente}
          isAdmin={isAdmin}
          isOwner={isOwner}
        />

        <EventosSection
          cliente={cliente}
          onUpdate={handleUpdate}
          isOwnerOrAdmin={canEdit}
        />

        <PlanPagoSection
          cliente={cliente}
          canEdit={canEdit}
        />

        <ClientesVinculadosSection
          cliente={cliente}
          isOwnerOrAdmin={canEdit}
          user={user}
        />
      </div>

      {showEditDialog && (
        <EditClienteDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          cliente={cliente}
        />
      )}
    </div>
  );
}