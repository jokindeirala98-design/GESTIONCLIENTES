import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, User, CheckCircle2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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

export default function ClienteCard({ cliente, user, zonas, onClick }) {
  const queryClient = useQueryClient();
  const [optimisticEstado, setOptimisticEstado] = useState(null);

  const isOwner = cliente.propietario_email === user.email;
  const isAdmin = user.role === "admin";
  const canViewFull = isOwner || isAdmin;

  const zona = zonas.find(z => z.id === cliente.zona_id);
  const estadoVisible = optimisticEstado ?? cliente.estado;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      queryClient.invalidateQueries(['cliente', cliente.id]);
      toast.success("Estado actualizado");
      setOptimisticEstado(null);
    },
    onError: () => {
      setOptimisticEstado(null);
      toast.error("Error al actualizar el estado");
    },
  });

  const handleEstadoChange = (e, nuevoEstado) => {
    e.stopPropagation();
    // Optimistic update: refleja el cambio de inmediato
    setOptimisticEstado(nuevoEstado);

    if (nuevoEstado === "Firmado con éxito") {
      const fechaCierre = new Date().toISOString().split('T')[0];
      const mesComision = fechaCierre.substring(0, 7);
      updateMutation.mutate({ id: cliente.id, data: { estado: nuevoEstado, fecha_cierre: fechaCierre, mes_comision: mesComision } });
    } else {
      updateMutation.mutate({ id: cliente.id, data: { estado: nuevoEstado } });
    }
  };

  // Los comerciales pueden cambiar estado en estas situaciones:
  // 1. Entre "Primer contacto" y "Esperando facturas"
  // 2. Cuando está en "Pendiente de firma" puede marcar como "Firmado con éxito" o "Rechazado"
  const canChangeState = isOwner && (
    (cliente.estado === "Primer contacto" || cliente.estado === "Esperando facturas") ||
    cliente.estado === "Pendiente de firma"
  );

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4"
      style={{ borderLeftColor: estadoColors[cliente.estado] || '#004D9D' }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-[#004D9D] text-lg mb-2 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {cliente.nombre_negocio}
            </h3>
            
            {canChangeState ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="text-left">
                    <Badge className={`${estadoColors[cliente.estado]} text-white text-xs hover:opacity-80 cursor-pointer`}>
                      {cliente.estado} ▼
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                  {(cliente.estado === "Primer contacto" || cliente.estado === "Esperando facturas") && (
                    <>
                      <DropdownMenuItem onClick={(e) => handleEstadoChange(e, "Primer contacto")}>
                        Primer contacto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleEstadoChange(e, "Esperando facturas")}>
                        Esperando facturas
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {cliente.estado === "Pendiente de firma" && (
                    <>
                      <DropdownMenuItem onClick={(e) => handleEstadoChange(e, "Firmado con éxito")}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-700" />
                        <span className="text-green-700">🏆 Firmado con éxito</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleEstadoChange(e, "Rechazado")}>
                        <X className="w-4 h-4 mr-2 text-red-600" />
                        <span className="text-red-600">Rechazado</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className={`${estadoColors[cliente.estado]} text-white text-xs`}>
                {cliente.estado}
              </Badge>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {cliente.propietario_iniciales || 'n/s'}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {zona && (
          <div className="flex items-center gap-2 text-sm text-[#666666]">
            <MapPin className="w-4 h-4" />
            <span>{zona.nombre}</span>
          </div>
        )}

        {canViewFull && (
          <>
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
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm text-[#666666] truncate">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{cliente.email}</span>
              </div>
            )}
          </>
        )}

        {cliente.facturas && cliente.facturas.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-[#666666]">
              {cliente.facturas.length} factura(s) subida(s)
            </p>
          </div>
        )}

        {(canViewFull && cliente.comision && cliente.estado === "Firmado con éxito" && cliente.aprobado_admin) && (
          <div className="pt-2 border-t">
            <p className="text-sm font-semibold text-green-600">
              Comisión: €{cliente.comision.toFixed(2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}