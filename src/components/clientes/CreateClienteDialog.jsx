
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Datos directos de municipios de Navarra
const municipiosNavarra = [
  { nombre: "Pamplona", lat: 42.8125, lng: -1.6458, poblacion: 201653 },
  { nombre: "Tudela", lat: 42.0667, lng: -1.6, poblacion: 35691 },
  { nombre: "Barañáin", lat: 42.8047, lng: -1.6756, poblacion: 19869 },
  { nombre: "Burlada", lat: 42.8289, lng: -1.6086, poblacion: 18847 },
  { nombre: "Zizur Mayor", lat: 42.7833, lng: -1.6833, poblacion: 14926 },
  { nombre: "Villava", lat: 42.8381, lng: -1.6156, poblacion: 10753 },
  { nombre: "Ansoáin", lat: 42.8236, lng: -1.6542, poblacion: 10539 },
  { nombre: "Estella-Lizarra", lat: 42.6717, lng: -2.0264, poblacion: 13892 },
  { nombre: "Tafalla", lat: 42.5292, lng: -1.6764, poblacion: 10670 },
  { nombre: "Berriozar", lat: 42.8358, lng: -1.6681, poblacion: 10106 },
  { nombre: "Huarte", lat: 42.8192, lng: -1.6014, poblacion: 7439 },
];

function buscarMunicipios(termino = '') {
  const terminoLower = termino.toLowerCase().trim();
  if (!terminoLower) return municipiosNavarra;
  return municipiosNavarra.filter(m => 
    m.nombre.toLowerCase().includes(terminoLower)
  );
}

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
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

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
    });
  };

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
    
    const dataToSave = {
      nombre_negocio: formData.nombre_negocio,
      nombre_cliente: formData.nombre_cliente,
      telefono: formData.telefono,
      email: formData.email,
      zona_id: zonaId,
      anotaciones: formData.anotaciones,
      propietario_email: user.email,
      propietario_iniciales: user.iniciales || user.full_name?.substring(0, 3).toUpperCase(),
      estado: "Primer contacto",
      facturas: [],
    };

    createMutation.mutate(dataToSave);
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
                      {buscarMunicipios().map((municipio) => (
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
              {zonaPreseleccionada && formData.zona_id && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Municipio preseleccionado
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
