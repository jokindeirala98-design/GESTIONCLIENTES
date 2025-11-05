import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { municipiosNavarra } from "@/utils/municipiosNavarra";

export default function EditClienteDialog({ open, onClose, cliente }) {
  const queryClient = useQueryClient();
  const [openCombobox, setOpenCombobox] = useState(false);
  
  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const zonaActual = zonas.find(z => z.id === cliente.zona_id);
  
  const [formData, setFormData] = useState({
    nombre_negocio: cliente.nombre_negocio || "",
    nombre_cliente: cliente.nombre_cliente || "",
    telefono: cliente.telefono || "",
    email: cliente.email || "",
    zona_nombre: zonaActual?.nombre || "",
    zona_id: cliente.zona_id || "",
    anotaciones: cliente.anotaciones || "",
  });

  const createZonaMutation = useMutation({
    mutationFn: (data) => base44.entities.Zona.create(data),
    onSuccess: (nuevaZona) => {
      queryClient.invalidateQueries(['zonas']);
      return nuevaZona;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cliente', cliente.id]);
      queryClient.invalidateQueries(['clientes']);
      onClose();
      toast.success("Cliente actualizado correctamente");
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let zonaId = formData.zona_id;

    // Si no hay zona_id pero hay zona_nombre, crear la zona
    if (!zonaId && formData.zona_nombre) {
      const zonaExistente = zonas.find(
        z => z.nombre.toLowerCase() === formData.zona_nombre.toLowerCase()
      );

      if (zonaExistente) {
        zonaId = zonaExistente.id;
      } else {
        // Crear nueva zona
        const user = await base44.auth.me();
        const nuevaZona = await createZonaMutation.mutateAsync({
          nombre: formData.zona_nombre,
          fecha_creacion_zona: new Date().toISOString().split('T')[0],
          creador_email: user?.email,
        });
        zonaId = nuevaZona.id;
      }
    }

    if (!zonaId) {
      toast.error("Debes seleccionar un municipio");
      return;
    }

    updateMutation.mutate({
      id: cliente.id,
      data: {
        nombre_negocio: formData.nombre_negocio,
        nombre_cliente: formData.nombre_cliente,
        telefono: formData.telefono,
        email: formData.email,
        zona_id: zonaId,
        anotaciones: formData.anotaciones,
      }
    });
  };

  const handleSelectMunicipio = (municipioNombre) => {
    // Buscar si ya existe una zona con este nombre
    const zonaExistente = zonas.find(z => z.nombre === municipioNombre);
    
    setFormData({
      ...formData,
      zona_nombre: municipioNombre,
      zona_id: zonaExistente ? zonaExistente.id : ""
    });
    setOpenCombobox(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Editar Cliente</DialogTitle>
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
                Municipio *
              </label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {formData.zona_nombre || "Buscar municipio..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar municipio (ej: tud)..." />
                    <CommandEmpty>No se encontró el municipio.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {municipiosNavarra.map((municipio) => (
                        <CommandItem
                          key={municipio.nombre}
                          value={municipio.nombre}
                          onSelect={() => handleSelectMunicipio(municipio.nombre)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.zona_nombre === municipio.nombre ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {municipio.nombre}
                          <span className="ml-auto text-xs text-gray-500">
                            {municipio.poblacion.toLocaleString()} hab.
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#004D9D] hover:bg-[#00AEEF]">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}