import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function CreateClienteDialog({ open, onClose, user, zonas }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nombre_negocio: "",
    nombre_cliente: "",
    telefono: "",
    email: "",
    zona_id: "",
    anotaciones: "",
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      onClose();
      resetForm();
      toast.success("Cliente creado correctamente");
    },
  });

  const resetForm = () => {
    setFormData({
      nombre_negocio: "",
      nombre_cliente: "",
      telefono: "",
      email: "",
      zona_id: "",
      anotaciones: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      ...formData,
      propietario_email: user.email,
      propietario_iniciales: user.iniciales || user.full_name?.substring(0, 3).toUpperCase(),
      estado: "Primer contacto",
      facturas: [],
    };

    createMutation.mutate(dataToSave);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Nuevo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#666666] mb-1 block">
                Nombre del negocio *
              </label>
              <Input
                value={formData.nombre_negocio}
                onChange={(e) => setFormData({ ...formData, nombre_negocio: e.target.value })}
                placeholder="Ej: Panadería Pepe"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#666666] mb-1 block">
                Nombre del cliente
              </label>
              <Input
                value={formData.nombre_cliente}
                onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                placeholder="Ej: José García"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Teléfono
                </label>
                <Input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej: 600 123 456"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#666666] mb-1 block">
                Zona *
              </label>
              <Select value={formData.zona_id} onValueChange={(value) => setFormData({ ...formData, zona_id: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una zona" />
                </SelectTrigger>
                <SelectContent>
                  {zonas.map(zona => (
                    <SelectItem key={zona.id} value={zona.id}>{zona.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#666666] mb-1 block">
                Anotaciones
              </label>
              <Textarea
                value={formData.anotaciones}
                onChange={(e) => setFormData({ ...formData, anotaciones: e.target.value })}
                placeholder="Notas sobre el cliente..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#004D9D] hover:bg-[#00AEEF]">
              Crear Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}