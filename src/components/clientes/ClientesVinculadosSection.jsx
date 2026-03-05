import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link2, Plus, ArrowRight, Building2, X } from "lucide-react";
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

export default function ClientesVinculadosSection({ cliente, isOwnerOrAdmin, user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");

  const { data: clientesVinculados = [] } = useQuery({
    queryKey: ['clientesVinculados', cliente.id],
    queryFn: async () => {
      const todos = await base44.entities.Cliente.list();
      return todos.filter(c => c.cliente_principal_id === cliente.id);
    },
    enabled: !!cliente.id,
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) throw new Error("El nombre es obligatorio");
      const zona = zonas.find(z => z.id === cliente.zona_id);
      const nuevoCliente = await base44.entities.Cliente.create({
        nombre_negocio: nombre.trim(),
        zona_id: cliente.zona_id,
        propietario_email: cliente.propietario_email,
        propietario_iniciales: cliente.propietario_iniciales,
        estado: "Primer contacto",
        eventos: [],
        cliente_principal_id: cliente.id,
      });
      return nuevoCliente;
    },
    onSuccess: (nuevoCliente) => {
      queryClient.invalidateQueries(['clientesVinculados', cliente.id]);
      queryClient.invalidateQueries(['clientes']);
      toast.success("Titular vinculado creado");
      setNombre("");
      setShowForm(false);
    },
    onError: (err) => toast.error(err.message),
  });

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
                <div className="flex items-center gap-2 flex-wrap">
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
                  className="text-[#004D9D] hover:bg-blue-50 flex-shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isOwnerOrAdmin && !showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="w-full border-dashed text-[#004D9D] hover:bg-blue-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir titular vinculado
          </Button>
        )}

        {showForm && (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="Nombre del nuevo titular / negocio"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createMutation.mutate()}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !nombre.trim()}
              className="bg-[#004D9D] hover:bg-[#00AEEF]"
            >
              Crear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setNombre(""); }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}