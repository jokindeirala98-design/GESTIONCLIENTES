import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MUNICIPIOS_NAVARRA } from "../shared/municipios";

export default function CreateClienteDialog({ open, onClose, user, zonaPreseleccionada = null }) {
  const queryClient = useQueryClient();
  const [openCombobox, setOpenCombobox] = useState(false);
  const [formData, setFormData] = useState({
    nombre_negocio: "",
    nombre_cliente: "",
    telefono: "",
    email: "",
    zona_nombre: "",
    zona_id: "",
    anotaciones: "",
    propietario_email: user.email,
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: user?.role === 'admin',
  });

  const isAdmin = user?.role === 'admin';
  const comerciales = usuarios.filter(u => u.role === 'user' || u.role === 'admin');

  useEffect(() => {
    if (zonaPreseleccionada) {
      const zona = zonas.find(z => z.id === zonaPreseleccionada);
      if (zona) {
        setFormData(prev => ({
          ...prev,
          zona_id: zonaPreseleccionada,
          zona_nombre: zona.nombre
        }));
      }
    }
  }, [zonaPreseleccionada, zonas]);

  const createZonaMutation = useMutation({
    mutationFn: (data) => base44.entities.Zona.create(data),
    onSuccess: (nuevaZona) => {
      queryClient.invalidateQueries(['zonas']);
      return nuevaZona;
    },
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
      zona_nombre: "",
      zona_id: "",
      anotaciones: "",
      propietario_email: user.email,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.zona_id) {
      toast.error("Debes seleccionar una zona");
      return;
    }

    const propietario = isAdmin 
      ? comerciales.find(u => u.email === formData.propietario_email)
      : user;
    
    let iniciales = 'n/s';
    if (propietario) {
      if (propietario.iniciales) {
        iniciales = propietario.iniciales;
      } else if (propietario.full_name) {
        iniciales = propietario.full_name.substring(0, 3).toUpperCase();
      }
    }

    const dataToSave = {
      nombre_negocio: formData.nombre_negocio,
      nombre_cliente: formData.nombre_cliente,
      telefono: formData.telefono,
      email: formData.email,
      zona_id: formData.zona_id,
      anotaciones: formData.anotaciones,
      propietario_email: formData.propietario_email,
      propietario_iniciales: iniciales,
      estado: "Primer contacto",
      facturas: [],
      eventos: []
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

            {isAdmin && comerciales.length > 0 && (
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Asignar a comercial *
                </label>
                <Select
                  value={formData.propietario_email}
                  onValueChange={(value) => setFormData({ ...formData, propietario_email: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar comercial" />
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
            )}

            <div>
              <label className="text-sm font-medium text-[#666666] mb-1 block">
                Zona / Pueblo *
              </label>
              <Select
                value={formData.zona_id}
                onValueChange={(value) => {
                  const zona = zonas.find(z => z.id === value);
                  setFormData({ ...formData, zona_id: value, zona_nombre: zona?.nombre || "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una zona existente" />
                </SelectTrigger>
                <SelectContent>
                  {zonas.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">
                      No hay zonas creadas. Crea una zona primero desde "Zonas".
                    </div>
                  ) : (
                    zonas.map(zona => (
                      <SelectItem key={zona.id} value={zona.id}>
                        {zona.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {zonas.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Debes crear una zona primero desde la sección "Zonas"
                </p>
              )}
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