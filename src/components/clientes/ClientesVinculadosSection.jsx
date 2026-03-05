import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Plus, ArrowRight, Building2 } from "lucide-react";
import CreateClienteDialog from "./CreateClienteDialog.jsx";
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

export default function ClientesVinculadosSection({ cliente, isOwnerOrAdmin }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: clientesVinculados = [] } = useQuery({
    queryKey: ['clientesVinculados', cliente.id],
    queryFn: async () => {
      const todos = await base44.entities.Cliente.list();
      return todos.filter(c => c.cliente_principal_id === cliente.id);
    },
    enabled: !!cliente.id,
  });

  const handleClienteCreado = async (nuevoCliente) => {
    // Vincular el nuevo cliente al actual
    await base44.entities.Cliente.update(nuevoCliente.id, {
      cliente_principal_id: cliente.id
    });
    queryClient.invalidateQueries(['clientesVinculados', cliente.id]);
    toast.success("Titular vinculado creado correctamente");
    setShowCreateDialog(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[#004D9D] flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Titulares Vinculados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clientesVinculados.length > 0 && (
          <div className="space-y-2">
            {clientesVinculados.map(vinculado => (
              <div
                key={vinculado.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-gray-800">{vinculado.nombre_negocio}</p>
                    {vinculado.nombre_cliente && (
                      <p className="text-xs text-gray-500">{vinculado.nombre_cliente}</p>
                    )}
                  </div>
                  <Badge className={`${estadoColors[vinculado.estado] || 'bg-gray-500'} text-white text-xs`}>
                    {vinculado.estado}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(createPageUrl(`DetalleCliente?id=${vinculado.id}`))}
                  className="text-[#004D9D] hover:bg-blue-50"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isOwnerOrAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="w-full border-dashed text-[#004D9D] hover:bg-blue-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir titular vinculado
          </Button>
        )}
      </CardContent>

      {showCreateDialog && (
        <CreateClienteDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleClienteCreado}
          defaultValues={{
            propietario_email: cliente.propietario_email,
            propietario_iniciales: cliente.propietario_iniciales,
            zona_id: cliente.zona_id,
          }}
        />
      )}
    </Card>
  );
}