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
import { esGas, esLuz20, recalcularRappelComercial, aplicarActualizacionesRappel } from "../components/utils/rappelComisiones";
import YaEsClienteDialog from "../components/informes/YaEsClienteDialog";

export default function InformesPorPresentar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [clienteExpandido, setClienteExpandido] = useState(null);
  const [comisionesPorSuministro, setComisionesPorSuministro] = useState({});
  const [tipoRappelPorSuministro, setTipoRappelPorSuministro] = useState({}); // "manual", "gas", "luz_20"
  const [informesSubidos, setInformesSubidos] = useState({}); // {suministroId: {files: [{file, fileUrl, fileName}]}}
  const [sincronizando, setSincronizando] = useState(false);
  const [guardando, setGuardando] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("all"); // "all", "6.2", "6.1", "3.0", "2.0", "gas"
  const [ordenManual, setOrdenManual] = useState([]);
  const [notasAdmin, setNotasAdmin] = useState({});
  const [yaEsClienteDialog, setYaEsClienteDialog] = useState({ open: false, cliente: null, suministroId: null });

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
    onSuccess: (_, variables) => {
      // Invalidar queries globales y específicas del cliente
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['cliente', variables.id]);
    },
  });

  const sincronizarEstadosMutation = useMutation({
    mutationFn: async () => {
      const clientesActualizar = [];
      
      clientes.forEach(cliente => {
        if (!cliente.suministros || cliente.suministros.length === 0) return;
        
        // Solo considerar suministros NO cerrados
        const suministrosActivos = cliente.suministros.filter(s => !s.cerrado);
        if (suministrosActivos.length === 0) return; // Todos cerrados, no tocar
        
        const estadosFinales = ["Informe listo", "Pendiente de firma", "Firmado con éxito", "Rechazado"];
        if (estadosFinales.includes(cliente.estado)) return;

        const todosConFacturas = suministrosActivos.every(s => 
          s.facturas && s.facturas.length > 0
        );
        
        const todosConInforme = suministrosActivos.every(s => {
          if (!s.informe_final) return false;
          const tieneArchivosValidos = s.informe_final.archivos?.length > 0 && 
            s.informe_final.archivos.every(a => a.url && a.url.trim() !== '' && a.url !== 'null' && a.nombre && a.nombre.trim() !== '' && a.nombre !== 'null');
          const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
          return tieneArchivosValidos || tieneUrlValida;
        });

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

  const handleSeleccionarInformes = async (suministroId, files) => {
    if (!files || files.length === 0) return;
    
    const informesActuales = informesSubidos[suministroId]?.files || [];
    const remaining = 5 - informesActuales.length;
    
    if (remaining <= 0) {
      toast.error("Máximo 5 archivos por suministro");
      return;
    }
    
    const filesToUpload = files.slice(0, remaining);
    
    try {
      toast.loading(`Subiendo ${filesToUpload.length} archivo(s)...`, { id: `upload-${suministroId}` });
      
      const uploads = await Promise.all(
        filesToUpload.map(file => base44.integrations.Core.UploadFile({ file }))
      );
      
      setInformesSubidos(prev => ({
        ...prev,
        [suministroId]: {
          files: [
            ...(prev[suministroId]?.files || []),
            ...uploads.map((upload, idx) => ({
              file: filesToUpload[idx],
              fileUrl: upload.file_url,
              fileName: filesToUpload[idx].name
            }))
          ]
        }
      }));
      
      toast.success(`${filesToUpload.length} archivo(s) subido(s). Añade comisión y guarda.`, { id: `upload-${suministroId}` });
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al subir archivos", { id: `upload-${suministroId}` });
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
    setTipoRappelPorSuministro(prev => {
      const newState = { ...prev };
      delete newState[suministroId];
      return newState;
    });
    toast.info("Informes cancelados");
  };

  const handleGuardarCambios = async (cliente, suministroId) => {
    const informeSubido = informesSubidos[suministroId];
    const suministro = cliente.suministros.find(s => s.id === suministroId);
    
    if (!informeSubido || !informeSubido.files || informeSubido.files.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }
    
    const tipoRappel = tipoRappelPorSuministro[suministroId] || "manual";
    const comision = comisionesPorSuministro[suministroId];
    
    // Validar comisión solo si es manual
    if (tipoRappel === "manual" && (!comision || isNaN(parseFloat(comision)))) {
      toast.error("Introduce una comisión válida");
      return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));

    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          // Construir el array archivos con los archivos subidos
          const archivos = informeSubido.files.map(f => ({
            nombre: f.fileName,
            url: f.fileUrl
          }));

          // CRÍTICO: Solo crear informe_final con archivos válidos
          // NO marcar como cerrado aquí - solo cuando se firma el cliente
          return {
            ...s,
            informe_comparativo: {
              nombre: informeSubido.files[0].fileName,
              url: informeSubido.files[0].fileUrl,
              fecha_subida: new Date().toISOString(),
              subido_por_email: user.email
            },
            informe_final: {
              archivos: archivos,
              fecha_subida: new Date().toISOString(),
              subido_por_email: user.email,
              notas_admin: notasAdmin[suministroId]?.trim() || undefined
            },
            // Comisión y tipo_rappel según selección del admin
            comision: tipoRappel === "manual" ? parseFloat(comision) : 0,
            tipo_rappel: tipoRappel === "manual" ? null : tipoRappel
          };
        }
        
        // LIMPIEZA: Solo eliminar si NO hay URL válida
        if (s.informe_final) {
          const archivosValidos = s.informe_final.archivos?.filter(a => 
            a && a.url && a.url.trim() && a.url !== 'null'
          ) || [];
          const tieneUrlLegacy = s.informe_final.url && s.informe_final.url.trim() && s.informe_final.url !== 'null';

          // Solo eliminar si no hay ninguna URL válida
          if (archivosValidos.length === 0 && !tieneUrlLegacy) {
            const { informe_final, ...suministroLimpio } = s;
            return suministroLimpio;
          }
        }

        return s;
      });

      // Solo considerar suministros NO cerrados
      const suministrosActivos = nuevosSuministros.filter(s => !s.cerrado);
      
      // Primero verificar si todos tienen comparativo
      const todosConComparativo = suministrosActivos.every(s => s.informe_comparativo);
      
      const todosConInforme = suministrosActivos.every(s => {
        if (!s.informe_final) return false;
        const tieneArchivosValidos = s.informe_final.archivos?.some(a => 
          a && a.url && a.url.trim() !== '' && a.url !== 'null'
        );
        const tieneUrlValida = s.informe_final.url && s.informe_final.url.trim() !== '' && s.informe_final.url !== 'null';
        return tieneArchivosValidos || tieneUrlValida;
      });
      const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);
      const nuevoEstado = todosConInforme ? "Informe listo" : 
                          todosConComparativo ? "Pendiente informe comparativo" : 
                          "Pendiente informe potencias";

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: {
          suministros: nuevosSuministros,
          estado: nuevoEstado,
          comision: comisionTotal
        }
      });

      // CRÍTICO: Invalidar todas las queries para forzar recarga
      await queryClient.invalidateQueries(['clientes']);
      await queryClient.invalidateQueries(['cliente', cliente.id]);
      
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
      setTipoRappelPorSuministro(prev => {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      });
      setNotasAdmin(prev => {
        const newState = { ...prev };
        delete newState[suministroId];
        return newState;
      });

      // Enviar email al comercial si todos tienen informe
      if (todosConInforme) {
        try {
          await base44.integrations.Core.SendEmail({
            to: cliente.propietario_email,
            subject: `✅ Todos los informes listos para ${cliente.nombre_negocio}`,
            body: `Hola,\n\nTodos los informes finales de "${cliente.nombre_negocio}" ya están listos y disponibles en la plataforma.\n\nComisión total: ${comisionTotal}€\n\nPuedes verlos en: ${window.location.origin}${createPageUrl(`DetalleCliente?id=${cliente.id}`)}\n\nSaludos,\nVoltis Energía`
          });
        } catch (emailError) {
          console.error("Error enviando email:", emailError);
          // No bloquear el proceso si falla el email
        }
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

  const handleDescargarArchivo = async (url, nombre) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nombre || 'archivo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error al descargar:', error);
      window.open(url, '_blank');
    }
  };

  const handleIgnorarCliente = async (clienteId) => {
    if (!window.confirm("¿Ignorar este cliente? Desaparecerá de la lista pero mantendrá su estado actual.")) {
      return;
    }

    try {
      await updateClienteMutation.mutateAsync({
        id: clienteId,
        data: { estado: "Ignorado con mucho éxito" }
      });
      toast.success("Cliente ignorado");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al ignorar cliente");
    }
  };

  const openYaEsClienteDialog = (cliente, suministroId) => {
    setYaEsClienteDialog({ open: true, cliente, suministroId });
  };

  const closeYaEsClienteDialog = () => {
    setYaEsClienteDialog({ open: false, cliente: null, suministroId: null });
  };

  const handleYaEsClienteConfirm = async ({ tipoComision, comision, tipoRappel }) => {
    const { cliente, suministroId } = yaEsClienteDialog;
    closeYaEsClienteDialog();

    const fechaCierre = new Date().toISOString().split('T')[0];
    const mesComision = fechaCierre.substring(0, 7);

    try {
      // Marcar suministro como cerrado
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          return {
            ...s,
            cerrado: true,
            fecha_cierre_suministro: fechaCierre,
            mes_comision_suministro: mesComision,
            comision: tipoComision === "manual" ? comision : 0,
            tipo_rappel: tipoRappel
          };
        }
        return s;
      });

      // Verificar si TODOS los suministros están cerrados
      const todosCerrados = nuevosSuministros.every(s => s.cerrado);
      const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);

      let updateData = {
        suministros: nuevosSuministros,
        comision: comisionTotal
      };

      // Si todos cerrados → Firmado con éxito
      if (todosCerrados) {
        // Crear eventos de feedback
        const eventosActualizados = [...(cliente.eventos || [])];
        
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

        updateData = {
          ...updateData,
          estado: "Firmado con éxito",
          fecha_cierre: fechaCierre,
          mes_comision: mesComision,
          aprobado_admin: true,
          eventos: eventosActualizados
        };
      }

      // Recalcular rappel si es necesario
      const todosClientes = await base44.entities.Cliente.list();
      const clientesConActualizacion = todosClientes.map(c => 
        c.id === cliente.id ? { ...cliente, suministros: updateData.suministros } : c
      );
      
      const { actualizacionesPorCliente } = recalcularRappelComercial(
        clientesConActualizacion,
        cliente.propietario_email,
        mesComision
      );

      // Aplicar actualizaciones de rappel
      if (actualizacionesPorCliente[cliente.id]) {
        const clienteConRappel = aplicarActualizacionesRappel(
          { ...cliente, suministros: updateData.suministros },
          actualizacionesPorCliente[cliente.id]
        );
        updateData.suministros = clienteConRappel.suministros;
        updateData.comision = clienteConRappel.comision;
      }

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: updateData
      });

      // Actualizar otros clientes afectados por rappel
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

      // Notificar a contabilidad si todos cerrados
      if (todosCerrados) {
        try {
          await base44.integrations.Core.SendEmail({
            to: "iranzu@voltisenergia.com",
            subject: `Cierre verificado - ${cliente.nombre_negocio}`,
            body: `${cliente.nombre_negocio} ha sido cerrado con éxito y está listo para contabilidad.`
          });
        } catch (error) {
          console.error("Error enviando notificación:", error);
        }
      }

      await queryClient.invalidateQueries(['clientes']);
      toast.success(todosCerrados ? "Cliente cerrado con éxito" : "Suministro cerrado");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al procesar el cierre");
    }
  };

  const handleEliminarInforme = async (cliente, suministroId) => {
    if (!window.confirm("¿Eliminar el informe de este suministro? Podrás volver a subirlo.")) {
      return;
    }

    setGuardando(prev => ({ ...prev, [suministroId]: true }));

    try {
      const nuevosSuministros = cliente.suministros.map(s => {
        if (s.id === suministroId) {
          // Eliminar informe_final
          const { informe_final, ...suministroLimpio } = s;
          return suministroLimpio;
        }
        return s;
      });

      // Recalcular estado según suministros restantes
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

      await updateClienteMutation.mutateAsync({
        id: cliente.id,
        data: {
          suministros: nuevosSuministros,
          estado: nuevoEstado,
          comision: comisionTotal
        }
      });

      await queryClient.invalidateQueries(['clientes']);
      await queryClient.invalidateQueries(['cliente', cliente.id]);
      
      toast.success("Informe eliminado correctamente");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el informe");
    } finally {
      setGuardando(prev => ({ ...prev, [suministroId]: false }));
    }
  };

  // Luz: 6.2 > 6.1 > 3.0 > 2.0. Gas: RL6 > RL5 > RL4 > RL3 > RL2 > RL1. Gas es menos prioritario que luz.
  const TIPO_ORDEN = { "6.2": 8, "6.1": 7, "3.0": 6, "2.0": 5, "RL6": 4, "RL5": 3, "RL4": 2, "RL3": 2, "RL2": 1, "RL1": 1 };

  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    return cliente.suministros.reduce((max, s) => {
      const actual = TIPO_ORDEN[s.tipo_factura] || 0;
      const maxActual = TIPO_ORDEN[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, cliente.suministros[0]?.tipo_factura || "2.0");
  };

  // Mostrar clientes desde que tienen facturas (con o sin informe de potencias)
  // EXCLUIR clientes con estado "Ignorado con mucho éxito"
  let clientesFacturasPresent = clientes.filter(c => {
    if (!c.suministros || c.suministros.length === 0) return false;
    if (c.estado === "Ignorado con mucho éxito") return false;
    if (["Informe listo", "Pendiente de firma", "Pendiente de aprobación", "Firmado con éxito", "Rechazado"].includes(c.estado)) return false;

    // Solo considerar suministros NO cerrados
    const suministrosActivos = c.suministros.filter(s => !s.cerrado);
    if (suministrosActivos.length === 0) return false;

    // Mostrar si tiene al menos un suministro con facturas y sin informe final
    return suministrosActivos.some(s =>
      s.facturas && s.facturas.length > 0 && !s.informe_comparativo
    );
  });

  // Aplicar filtro de prioridad
  if (filtroPrioridad !== "all") {
    clientesFacturasPresent = clientesFacturasPresent.filter(c => {
      const max = getTipoMaximo(c);
      if (filtroPrioridad === "gas") return esGasTipo(max);
      return max === filtroPrioridad;
    });
  }

  const esGasTipo = (tipo) => ["RL1","RL2","RL3","RL4","RL5","RL6"].includes(tipo);

  const conteo = {
    "6.2": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "6.2").length,
    "6.1": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "6.1").length,
    "3.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "3.0").length,
    "2.0": clientesFacturasPresent.filter(c => getTipoMaximo(c) === "2.0").length,
    "gas": clientesFacturasPresent.filter(c => esGasTipo(getTipoMaximo(c))).length,
  };

  // Orden automático por prioridad (mayor TIPO_ORDEN = mayor prioridad = primero)
  const clientesOrdenadosAuto = [...clientesFacturasPresent].sort((a, b) => {
    const orderA = TIPO_ORDEN[getTipoMaximo(a)] || 0;
    const orderB = TIPO_ORDEN[getTipoMaximo(b)] || 0;
    return orderB - orderA;
  });

  // Inicializar orden manual si está vacío
  useEffect(() => {
    if (ordenManual.length === 0 && clientesOrdenadosAuto.length > 0) {
      setOrdenManual(clientesOrdenadosAuto.map(c => c.id));
    }
  }, [clientesOrdenadosAuto.length]);

  // Detectar clientes que recién obtuvieron informe de potencias (todos los suministros activos con facturas tienen potencias)
  const clientesConPotenciasRecientes = new Set(
    clientesFacturasPresent
      .filter(c => {
        const activos = c.suministros.filter(s => !s.cerrado && s.facturas?.length > 0 && !s.informe_comparativo);
        return activos.length > 0 && activos.every(s => s.informe_potencias || s.potencias_ignorado);
      })
      .map(c => c.id)
  );

  // Aplicar orden manual y añadir nuevos clientes que no están en el orden
  let clientesOrdenados;
  if (ordenManual.length > 0) {
    // Clientes que están en el orden manual
    const clientesEnOrden = ordenManual
      .map(id => clientesFacturasPresent.find(c => c.id === id))
      .filter(c => c !== undefined);
    
    // Clientes nuevos que NO están en el orden manual
    const clientesNuevos = clientesFacturasPresent.filter(
      c => !ordenManual.includes(c.id)
    );
    
    // Ordenar los nuevos por prioridad automáticamente
    const clientesNuevosOrdenados = clientesNuevos.sort((a, b) => {
      const orderA = TIPO_ORDEN[getTipoMaximo(a)] || 999;
      const orderB = TIPO_ORDEN[getTipoMaximo(b)] || 999;
      return orderA - orderB;
    });
    
    // Combinar: primero los del orden manual (con potencias recientes al top), luego los nuevos
    const conPotencias = clientesEnOrden.filter(c => clientesConPotenciasRecientes.has(c.id));
    const sinPotencias = clientesEnOrden.filter(c => !clientesConPotenciasRecientes.has(c.id));
    clientesOrdenados = [...conPotencias, ...sinPotencias, ...clientesNuevosOrdenados];
  } else {
    clientesOrdenados = clientesOrdenadosAuto;
  }

  // Filtrar por búsqueda
  if (searchTerm) {
    clientesOrdenados = clientesOrdenados.filter(cliente =>
      cliente.nombre_negocio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    "6.2": "bg-purple-600 text-white",
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white",
    "RL1": "bg-green-600 text-white",
    "RL2": "bg-green-600 text-white",
    "RL3": "bg-green-600 text-white",
    "RL4": "bg-green-600 text-white",
    "RL5": "bg-green-600 text-white",
    "RL6": "bg-green-600 text-white",
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          { key: "6.2", label: "6.2", color: "purple", border: "border-purple-500", ring: "ring-purple-500", text: "text-purple-600", bg: "bg-purple-100" },
          { key: "6.1", label: "6.1", color: "red", border: "border-red-500", ring: "ring-red-500", text: "text-red-600", bg: "bg-red-100" },
          { key: "3.0", label: "3.0", color: "orange", border: "border-orange-500", ring: "ring-orange-500", text: "text-orange-600", bg: "bg-orange-100" },
          { key: "2.0", label: "2.0", color: "blue", border: "border-blue-500", ring: "ring-blue-500", text: "text-blue-600", bg: "bg-blue-100" },
          { key: "gas", label: "Gas", color: "green", border: "border-green-500", ring: "ring-green-500", text: "text-green-600", bg: "bg-green-100" },
        ].map(item => (
          <Card
            key={item.key}
            className={`border-l-4 ${item.border} cursor-pointer transition-all ${
              filtroPrioridad === item.key ? `ring-2 ${item.ring} shadow-lg` : "hover:shadow-lg"
            }`}
            onClick={() => setFiltroPrioridad(filtroPrioridad === item.key ? "all" : item.key)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs text-[#666666] mb-1`}>
                    {item.label} {filtroPrioridad === item.key && "✓"}
                  </p>
                  <p className={`text-2xl font-bold ${item.text}`}>{conteo[item.key]}</p>
                </div>
                <div className={`w-9 h-9 rounded-full ${item.bg} flex items-center justify-center`}>
                  <FileText className={`w-5 h-5 ${item.text}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
            
            // Calcular fecha de primera factura subida
            let primeraFechaFactura = null;
            let diasDesdeSubida = 0;
            if (cliente.suministros && cliente.suministros.length > 0) {
              const todasFechas = cliente.suministros
                .flatMap(s => s.facturas || [])
                .map(f => f.fecha_subida)
                .filter(f => f)
                .sort();
              if (todasFechas.length > 0) {
                const fechaSubida = new Date(todasFechas[0]);
                primeraFechaFactura = fechaSubida.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                diasDesdeSubida = Math.floor((new Date() - fechaSubida) / (1000 * 60 * 60 * 24));
              }
            }
            
            return (
              <Draggable key={cliente.id} draggableId={cliente.id} index={index}>
                {(provided, snapshot) => (
                  <Card 
                   ref={provided.innerRef}
                   {...provided.draggableProps}
                   className={`border-l-4 ${
                     clientesConPotenciasRecientes.has(cliente.id)
                       ? 'border-blue-500 shadow-blue-200 shadow-lg ring-2 ring-blue-300'
                       : 'border-[#004D9D]'
                   } ${snapshot.isDragging ? 'shadow-2xl' : ''}`}
                  >
                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => setClienteExpandido(isExpanded ? null : cliente.id)}
                    >
                          <CardHeader className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div 
                                {...provided.dragHandleProps}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing" />
                              </div>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80" >
                                  <Building2 className="w-6 h-6 text-[#004D9D]" />
                                  <div>
                                    <CardTitle className="text-[#004D9D]">{cliente.nombre_negocio}</CardTitle>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
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
                              </CollapsibleTrigger>
                            </div>
                            <div className="flex items-center gap-3">
                              {primeraFechaFactura && (
                                <span className={`text-sm ${diasDesdeSubida > 8 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                  📅 {primeraFechaFactura}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIgnorarCliente(cliente.id);
                                }}
                                className="text-gray-600 hover:bg-gray-100"
                              >
                                Ignorar
                              </Button>
                              <CollapsibleTrigger asChild>
                                <button className="p-1 hover:opacity-80">
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                        </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                       {cliente.suministros?.filter(s => !s.cerrado && s.facturas && s.facturas.length > 0 && !s.informe_comparativo).map((suministro) => {
                         const informeSubido = informesSubidos[suministro.id];
                         const estaGuardando = guardando[suministro.id];
                         const tienePotencias = !!(suministro.informe_potencias || suministro.potencias_ignorado);

                         return (
                            <Card key={suministro.id} className={`${tienePotencias ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 opacity-75'}`}>
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <h4 className="font-semibold text-[#004D9D]">{suministro.nombre}</h4>
                                        <Badge className={tipoFacturaColors[suministro.tipo_factura]}>
                                          {suministro.tipo_factura}
                                        </Badge>
                                        {!tienePotencias && (
                                          <Badge className="bg-gray-400 text-white text-xs">⏳ Esperando informe de potencias</Badge>
                                        )}
                                        {tienePotencias && (
                                          <Badge className="bg-blue-600 text-white text-xs">⚡ Potencias listas</Badge>
                                        )}
                                      </div>

                                      <div className="space-y-2">
                                        <p className="text-sm text-gray-600 font-medium">📄 Facturas:</p>
                                        {suministro.facturas?.map((factura, idx) => (
                                          <div key={idx} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            <span className="flex-1 truncate">{factura.nombre}</span>
                                            <button
                                              onClick={() => handleDescargarArchivo(factura.url, factura.nombre)}
                                              className="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                              <Download className="w-4 h-4" />
                                              Descargar
                                            </button>
                                          </div>
                                        ))}
                                      </div>

                                      {suministro.informe_potencias && (
                                        <div className="space-y-2 mt-3">
                                          <p className="text-sm text-gray-600 font-medium">⚡ Informe de Potencias:</p>
                                          <div className="flex items-center gap-2 text-sm bg-yellow-50 p-2 rounded border border-yellow-300">
                                            <FileText className="w-4 h-4 text-yellow-600" />
                                            <span className="flex-1 truncate">{suministro.informe_potencias.nombre}</span>
                                            <button
                                              onClick={() => handleDescargarArchivo(suministro.informe_potencias.url, suministro.informe_potencias.nombre)}
                                              className="text-yellow-600 hover:underline flex items-center gap-1"
                                            >
                                              <Download className="w-4 h-4" />
                                              Descargar
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {!tienePotencias ? (
                                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
                                      <p className="text-sm text-gray-500">Esperando a que José suba el informe de potencias para poder subir el informe final</p>
                                    </div>
                                  ) : suministro.informe_final ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-green-700 font-semibold">✓ Informe(s) subido(s)</p>
                                        <div className="flex gap-2">
                                          <Button
                                           size="sm"
                                           onClick={() => openYaEsClienteDialog(cliente, suministro.id)}
                                           disabled={guardando[suministro.id]}
                                           className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                                          >
                                           ✓ Ya es cliente
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEliminarInforme(cliente, suministro.id)}
                                            disabled={guardando[suministro.id]}
                                            className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-7"
                                          >
                                            <X className="w-3 h-3 mr-1" />
                                            Eliminar
                                          </Button>
                                        </div>
                                      </div>
                                      {suministro.informe_final.notas_admin && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-2">
                                          <p className="text-xs font-semibold text-blue-800">📝 Nota:</p>
                                          <p className="text-xs text-blue-700 whitespace-pre-wrap">{suministro.informe_final.notas_admin}</p>
                                        </div>
                                      )}
                                      <div className="space-y-2">
                                        {suministro.informe_final.archivos ? (
                                          suministro.informe_final.archivos.map((archivo, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                                              <span className="text-sm text-green-600 truncate">{archivo.nombre}</span>
                                              <a
                                                href={archivo.url}
                                                download={archivo.nombre}
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
                                              download={suministro.informe_final.nombre}
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
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-semibold text-purple-900">📤 Subir informe comparativo (PDF) para este suministro</p>
                                        <Button
                                          size="sm"
                                          onClick={() => openYaEsClienteDialog(cliente, suministro.id)}
                                          disabled={guardando[suministro.id]}
                                          className="bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                                        >
                                          ✓ Ya es cliente
                                        </Button>
                                      </div>
                                      
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

                                          {/* Campo de notas para el comercial */}
                                          <div>
                                            <Label htmlFor={`notas-${suministro.id}`} className="text-sm font-medium text-gray-700">
                                              📝 Notas para el comercial (opcional)
                                            </Label>
                                            <textarea
                                              id={`notas-${suministro.id}`}
                                              value={notasAdmin[suministro.id] || ''}
                                              onChange={(e) => setNotasAdmin(prev => ({ ...prev, [suministro.id]: e.target.value }))}
                                              placeholder="Ej: Revisar página 3, ajustar comisión..."
                                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent mt-1"
                                              rows="2"
                                            />
                                          </div>

                                          {/* Selector de tipo de comisión */}
                                          <div>
                                            <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                              Tipo de comisión *
                                            </Label>
                                            <div className="space-y-2">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`tipo-rappel-${suministro.id}`}
                                                  value="manual"
                                                  checked={(tipoRappelPorSuministro[suministro.id] || "manual") === "manual"}
                                                  onChange={(e) => setTipoRappelPorSuministro(prev => ({ ...prev, [suministro.id]: e.target.value }))}
                                                  className="w-4 h-4 text-purple-600"
                                                />
                                                <span className="text-sm text-gray-700">Manual</span>
                                              </label>
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`tipo-rappel-${suministro.id}`}
                                                  value="gas"
                                                  checked={tipoRappelPorSuministro[suministro.id] === "gas"}
                                                  onChange={(e) => setTipoRappelPorSuministro(prev => ({ ...prev, [suministro.id]: e.target.value }))}
                                                  className="w-4 h-4 text-purple-600"
                                                />
                                                <span className="text-sm text-gray-700">Rappel Gas</span>
                                              </label>
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`tipo-rappel-${suministro.id}`}
                                                  value="luz_20"
                                                  checked={tipoRappelPorSuministro[suministro.id] === "luz_20"}
                                                  onChange={(e) => setTipoRappelPorSuministro(prev => ({ ...prev, [suministro.id]: e.target.value }))}
                                                  className="w-4 h-4 text-purple-600"
                                                />
                                                <span className="text-sm text-gray-700">Rappel Luz 2.0</span>
                                              </label>
                                            </div>
                                          </div>

                                          {/* Input comisión - solo si es manual */}
                                          {(tipoRappelPorSuministro[suministro.id] || "manual") === "manual" && (
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
                                          )}

                                          {/* Mensaje informativo para rappel */}
                                          {tipoRappelPorSuministro[suministro.id] && tipoRappelPorSuministro[suministro.id] !== "manual" && (
                                           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                             <p className="text-sm text-blue-700">
                                               ℹ️ Comisión automática por rappel {tipoRappelPorSuministro[suministro.id] === 'gas' ? '(Gas)' : '(Luz 2.0)'} - Se calculará al firmar el cliente
                                             </p>
                                           </div>
                                          )}

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
                                              const pdfFiles = files.filter(f => f.type === 'application/pdf');
                                              
                                              if (pdfFiles.length < files.length) {
                                                toast.error("Solo se permiten archivos PDF");
                                              }
                                              
                                              if (pdfFiles.length > 0) {
                                                handleSeleccionarInformes(suministro.id, pdfFiles);
                                              }
                                            }}
                                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors"
                                          >
                                            <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                              Arrastra PDFs aquí o haz clic para seleccionar (máx. 5)
                                            </p>
                                            <input
                                              type="file"
                                              id={`upload-${suministro.id}`}
                                              className="hidden"
                                              accept=".pdf"
                                              multiple
                                              onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                if (files.length > 0) {
                                                  handleSeleccionarInformes(suministro.id, files);
                                                }
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

      <YaEsClienteDialog
        open={yaEsClienteDialog.open}
        onClose={closeYaEsClienteDialog}
        onConfirm={handleYaEsClienteConfirm}
        suministroNombre={
          yaEsClienteDialog.suministroId && yaEsClienteDialog.cliente
            ? yaEsClienteDialog.cliente.suministros?.find(s => s.id === yaEsClienteDialog.suministroId)?.nombre
            : ""
        }
      />
    </div>
  );
}