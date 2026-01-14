import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, X, Building2, MapPin, User, Phone, DollarSign, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { recalcularRappelComercial, aplicarActualizacionesRappel } from "../components/utils/rappelComisiones";

export default function CierresVerificados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    queryFn: () => base44.entities.Cliente.list('-updated_date'),
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Cierre procesado correctamente");
    },
  });

  if (!user) return null;

  // Mostrar clientes en "Pendiente de aprobación" y "Firmado con éxito" del mes actual
  const mesActual = new Date().toISOString().substring(0, 7); // YYYY-MM
  const clientesCierres = clientes.filter(c => 
    (c.estado === "Pendiente de aprobación" || 
     (c.estado === "Firmado con éxito" && c.aprobado_admin === true)) &&
    c.mes_comision === mesActual
  );

  const clientesPendientes = clientesCierres.filter(c => c.estado === "Pendiente de aprobación");
  const clientesAprobados = clientesCierres.filter(c => c.estado === "Firmado con éxito" && c.aprobado_admin === true);

  const clientesFiltrados = clientesCierres.filter(cliente =>
    cliente.nombre_negocio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.propietario_iniciales?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAprobar = async (cliente) => {
    if (!window.confirm(`¿Aprobar el cierre de "${cliente.nombre_negocio}"?\n\nLa comisión de €${cliente.comision?.toFixed(2) || '0.00'} será contabilizada para ${cliente.propietario_iniciales}.`)) {
      return;
    }

    const fechaCierre = cliente.fecha_cierre || new Date().toISOString().split('T')[0];
    const mesComision = fechaCierre.substring(0, 7);

    // Marcar TODOS los suministros NO cerrados como cerrados con su mes de comisión
    let suministrosActualizados = (cliente.suministros || []).map(s => {
      if (s.cerrado) return s; // Ya cerrado, mantener datos originales
      // Cerrar suministros que aún no lo están
      return {
        ...s,
        cerrado: true,
        fecha_cierre_suministro: fechaCierre,
        mes_comision_suministro: mesComision
      };
    });

    // RAPPEL: Recalcular comisiones de gas/luz 2.0
    try {
      const { actualizacionesPorCliente } = recalcularRappelComercial(
        clientes,
        cliente.propietario_email,
        mesComision
      );

      // Aplicar actualizaciones de rappel si las hay para este cliente
      if (actualizacionesPorCliente[cliente.id]) {
        const clienteConRappel = aplicarActualizacionesRappel(
          { ...cliente, suministros: suministrosActualizados },
          actualizacionesPorCliente[cliente.id]
        );
        suministrosActualizados = clienteConRappel.suministros;
      }

      // Actualizar OTROS clientes del mismo comercial que necesiten recalcular rappel
      for (const [otroClienteId, actualizacionesSuministros] of Object.entries(actualizacionesPorCliente)) {
        if (otroClienteId !== cliente.id) {
          const otroCliente = clientes.find(c => c.id === otroClienteId);
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
    }

    const comisionTotal = suministrosActualizados.reduce((sum, s) => sum + (s.comision || 0), 0);

    updateMutation.mutate({
      id: cliente.id,
      data: {
        estado: "Firmado con éxito",
        fecha_cierre: fechaCierre,
        mes_comision: mesComision,
        aprobado_admin: true,
        suministros: suministrosActualizados,
        comision: comisionTotal
      }
    });

    // Notificar al comercial
    try {
      const usuarios = await base44.entities.User.list();
      const comercial = usuarios.find(u => u.email === cliente.propietario_email);
      
      if (comercial && comercial.notificaciones_email) {
        await base44.integrations.Core.SendEmail({
          to: cliente.propietario_email,
          subject: `✅ Cierre aprobado - ${cliente.nombre_negocio}`,
          body: `¡Enhorabuena! El cierre de ${cliente.nombre_negocio} ha sido aprobado.\n\nComisión: €${cliente.comision?.toFixed(2) || '0.00'}\n\nLa comisión ya está contabilizada en tu panel.`
        });
      }

      // Notificar a contabilidad
      await base44.integrations.Core.SendEmail({
        to: "iranzu@voltisenergia.com",
        subject: `Cierre verificado - ${cliente.nombre_negocio}`,
        body: `${cliente.nombre_negocio} ha sido cerrado con éxito y está listo para contabilidad.`
      });
    } catch (error) {
      console.error("Error enviando notificación:", error);
    }
  };

  const handleRechazar = async (cliente) => {
    if (!window.confirm(`¿Rechazar el cierre de "${cliente.nombre_negocio}"?\n\n⚠️ La comisión NO será contabilizada y el cliente pasará a estado "Rechazado".`)) {
      return;
    }

    updateMutation.mutate({
      id: cliente.id,
      data: {
        estado: "Rechazado",
        comision: null,
        fecha_cierre: null,
        mes_comision: null,
        aprobado_admin: false
      }
    });

    // Notificar al comercial
    try {
      const usuarios = await base44.entities.User.list();
      const comercial = usuarios.find(u => u.email === cliente.propietario_email);
      
      if (comercial && comercial.notificaciones_email) {
        await base44.integrations.Core.SendEmail({
          to: cliente.propietario_email,
          subject: `❌ Cierre rechazado - ${cliente.nombre_negocio}`,
          body: `El cierre de ${cliente.nombre_negocio} ha sido rechazado por el administrador.\n\nPor favor, revisa los detalles del cliente.`
        });
      }
    } catch (error) {
      console.error("Error enviando notificación:", error);
    }
  };

  const clientesPorZona = zonas.map(zona => ({
    zona,
    clientes: clientesFiltrados.filter(c => c.zona_id === zona.id)
      .sort((a, b) => {
        // Primero los pendientes, luego los aprobados
        if (a.estado === "Pendiente de aprobación" && b.estado !== "Pendiente de aprobación") return -1;
        if (a.estado !== "Pendiente de aprobación" && b.estado === "Pendiente de aprobación") return 1;
        return 0;
      })
  })).filter(grupo => grupo.clientes.length > 0)
    .sort((a, b) => b.clientes.length - a.clientes.length);

  const formatearMes = (mesStr) => {
    if (!mesStr) return "";
    const [year, month] = mesStr.split('-');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[parseInt(month) - 1]} ${year}`;
  };

  const totalComisiones = clientesAprobados.reduce((sum, c) => sum + (c.comision || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          Cierres Verificados - {formatearMes(mesActual)}
        </h1>
        <p className="text-[#666666]">
          Historial de cierres del mes actual
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 mb-1">Pendientes</p>
                <p className="text-3xl font-bold text-yellow-600">{clientesPendientes.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Aprobados</p>
                <p className="text-3xl font-bold text-green-600">{clientesAprobados.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 mb-1">Total Comisiones</p>
                <p className="text-3xl font-bold text-blue-600">€{totalComisiones.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clientesCierres.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre de cliente o negocio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {clientesCierres.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay cierres en el mes actual
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los cierres aparecerán aquí cuando los comerciales marquen "Firmado con éxito"
            </p>
          </CardContent>
        </Card>
      ) : clientesFiltrados.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No se encontraron clientes
            </p>
            <Button
              variant="outline"
              onClick={() => setSearchTerm("")}
              className="mt-4"
            >
              Limpiar búsqueda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {clientesPorZona.map(({ zona, clientes: clientesZona }) => (
            <div key={zona.id}>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[#004D9D]">
                <MapPin className="w-6 h-6 text-[#004D9D]" />
                <h2 className="text-xl font-bold text-[#004D9D]">{zona.nombre}</h2>
                <span className="ml-auto bg-[#004D9D] text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {clientesZona.length} cierre(s)
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientesZona.map(cliente => {
                  const isPendiente = cliente.estado === "Pendiente de aprobación";
                  const isAprobado = cliente.estado === "Firmado con éxito" && cliente.aprobado_admin === true;
                  
                  return (
                    <Card 
                      key={cliente.id}
                      className={`transition-all duration-300 border-l-4 ${
                        isAprobado ? 'border-green-500 bg-green-50/30 opacity-60 hover:opacity-80' : 
                        isPendiente ? 'border-yellow-500 hover:shadow-lg' : 'border-gray-300'
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="w-5 h-5 text-[#004D9D]" />
                              <h3 className="font-bold text-[#004D9D]">{cliente.nombre_negocio}</h3>
                            </div>
                            
                            {isAprobado ? (
                              <Badge className="bg-green-600 text-white text-xs mb-2">
                                ✓ Firma aprobada
                              </Badge>
                            ) : isPendiente ? (
                              <Badge className="bg-yellow-600 text-white text-xs mb-2">
                                ⏳ Pendiente de aprobación
                              </Badge>
                            ) : null}
                          </div>
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center ${isAprobado ? 'opacity-60' : ''}`}>
                            <span className="text-white font-bold text-sm">
                              {cliente.propietario_iniciales}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          {cliente.nombre_cliente && (
                            <div className="flex items-center gap-2 text-sm text-[#666666]">
                              <User className="w-4 h-4" />
                              <span>{cliente.nombre_cliente}</span>
                            </div>
                          )}
                          {cliente.telefono && (
                            <div className="flex items-center gap-2 text-sm text-[#666666]">
                              <Phone className="w-4 h-4" />
                              <span>{cliente.telefono}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="font-bold text-green-600">
                              €{cliente.comision?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          {cliente.fecha_cierre && (
                            <p className="text-xs text-[#666666]">
                              Fecha: {new Date(cliente.fecha_cierre).toLocaleDateString('es-ES')}
                            </p>
                          )}
                        </div>

                        {isPendiente && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleRechazar(cliente)}
                              variant="outline"
                              size="sm"
                              className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Rechazar
                            </Button>
                            <Button
                              onClick={() => handleAprobar(cliente)}
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Aprobar
                            </Button>
                          </div>
                        )}

                        {isAprobado && (
                          <div className="bg-green-100 border border-green-300 rounded-lg p-2 text-center opacity-80">
                            <p className="text-xs font-semibold text-green-700">
                              ✓ Cierre aprobado - Comisión contabilizada
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}