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
import { MUNICIPIOS_NAVARRA } from "../../pages/Rutas";

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
    
    let zonaId = formData.zona_id;

    if (!zonaId && formData.zona_nombre) {
      const zonaExistente = zonas.find(
        z => z.nombre.toLowerCase() === formData.zona_nombre.toLowerCase()
      );

      if (zonaExistente) {
        zonaId = zonaExistente.id;
      } else {
        const nuevaZona = await createZonaMutation.mutateAsync({
          nombre: formData.zona_nombre,
          fecha_creacion_zona: new Date().toISOString().split('T')[0],
          creador_email: user?.email,
        });
        zonaId = nuevaZona.id;
      }
    }

    if (!zonaId) {
      toast.error("Debes seleccionar un pueblo");
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
      zona_id: zonaId,
      anotaciones: formData.anotaciones,
      propietario_email: formData.propietario_email,
      propietario_iniciales: iniciales,
      estado: "Primer contacto",
      facturas: [],
    };

    createMutation.mutate(dataToSave);
  };

  const handleSelectMunicipio = (municipioNombre) => {
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
                Pueblo *
              </label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {formData.zona_nombre || "Buscar pueblo..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar pueblo (ej: pam, tud)..." />
                    <CommandEmpty>
                      <div className="p-4 text-sm text-gray-500">
                        No se encontró el pueblo.
                        <Button
                          type="button"
                          variant="link"
                          className="block mt-2 text-[#004D9D]"
                          onClick={() => {
                            const customValue = prompt("Introduce el nombre del pueblo:");
                            if (customValue) {
                              setFormData({ ...formData, zona_nombre: customValue, zona_id: "" });
                              setOpenCombobox(false);
                            }
                          }}
                        >
                          ¿Añadir manualmente?
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {MUNICIPIOS_NAVARRA.map((municipio) => (
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
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {zonaPreseleccionada && formData.zona_id && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Pueblo preseleccionado
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