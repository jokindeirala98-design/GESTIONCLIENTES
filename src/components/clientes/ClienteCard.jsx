import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, User } from "lucide-react";

const estadoColors = {
  "Primer contacto": "bg-gray-500",
  "Esperando facturas": "bg-orange-500",
  "Facturas presentadas": "bg-blue-500",
  "Informe listo": "bg-purple-500",
  "Cerrado con éxito": "bg-green-500",
  "Rechazado": "bg-red-500",
};

export default function ClienteCard({ cliente, user, zonas, onClick }) {
  const isOwner = cliente.propietario_email === user.email;
  const isAdmin = user.role === "admin";
  const canViewFull = isOwner || isAdmin;

  const zona = zonas.find(z => z.id === cliente.zona_id);

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4"
      style={{ borderLeftColor: estadoColors[cliente.estado] || '#004D9D' }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-[#004D9D] text-lg mb-1 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {canViewFull ? cliente.nombre_negocio : '*****'}
            </h3>
            <Badge className={`${estadoColors[cliente.estado]} text-white text-xs`}>
              {cliente.estado}
            </Badge>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {cliente.propietario_iniciales || 'N/A'}
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

        {canViewFull ? (
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
        ) : (
          <div className="text-sm text-[#666666] italic">
            Datos privados del propietario
          </div>
        )}

        {cliente.facturas && cliente.facturas.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-[#666666]">
              {cliente.facturas.length} factura(s) subida(s)
            </p>
          </div>
        )}

        {(canViewFull && cliente.comision && cliente.estado === "Cerrado con éxito") && (
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