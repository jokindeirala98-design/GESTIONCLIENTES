import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, Building2, MapPin, User, Phone, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function CierresVerificados() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

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

  const clientesFirmados = clientes.filter(c => c.estado === "Firmado con éxito");

  const handleAprobar = async (cliente) => {
    if (!window.confirm(`¿Aprobar el cierre de "${cliente.nombre_negocio}"?\n\nLa comisión de €${cliente.comision?.toFixed(2) || '0.00'} será contabilizada para ${cliente.propietario_iniciales}.`)) {
      return;
    }

    const fechaCierre = cliente.fecha_cierre || new Date().toISOString().split('T')[0];
    const mesComision = fechaCierre.substring(0, 7);

    updateMutation.mutate({
      id: cliente.id,
      data: {
        estado: "Firmado con éxito",
        fecha_cierre: fechaCierre,
        mes_comision: mesComision,
        aprobado_admin: true
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
        mes_comision: null
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
    clientes: clientesFirmados.filter(c => c.zona_id === zona.id)
  })).filter(grupo => grupo.clientes.length > 0)
    .sort((a, b) => b.clientes.length - a.clientes.length);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          Cierres Verificados
        </h1>
        <p className="text-[#666666]">
          Clientes marcados como firmados por los comerciales - Pendientes de tu aprobación
        </p>
      </div>

      <Card className="border-2 border-yellow-200 bg-yellow-50 mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">
                {clientesFirmados.length} cierre(s) pendiente(s) de verificación
              </h3>
              <p className="text-sm text-yellow-700">
                Revisa cada cierre y aprueba o rechaza según corresponda. Solo los cierres aprobados contabilizarán comisión.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {clientesFirmados.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay cierres pendientes de verificación
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando los comerciales marquen "Firmado con éxito"
            </p>
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
                {clientesZona.map(cliente => (
                  <Card 
                    key={cliente.id}
                    className="hover:shadow-lg transition-all duration-300 border-l-4 border-yellow-500"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-5 h-5 text-[#004D9D]" />
                            <h3 className="font-bold text-[#004D9D]">{cliente.nombre_negocio}</h3>
                          </div>
                          
                          <Badge className="bg-yellow-600 text-white text-xs mb-2">
                            🏆 Firmado con éxito
                          </Badge>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}