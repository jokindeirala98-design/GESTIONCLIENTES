
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
  Select, // Kept Select just in case, though the municipality one is replaced
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

export default function EditClienteDialog({ open, onClose, cliente }) {
  const queryClient = useQueryClient();

  const { data: zonas = [], isLoading: zonasLoading } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const zonaActual = zonas.find(z => z.id === cliente.zona_id);

  const [formData, setFormData] = useState({
    nombre_negocio: cliente.nombre_negocio || "",
    nombre_cliente: cliente.nombre_cliente || "",
    telefono: cliente.telefono || "",
    email: cliente.email || "",
    zona_nombre: zonaActual?.nombre || "", // Display name of the zone
    zona_id: cliente.zona_id || "",      // ID of the zone
    anotaciones: cliente.anotaciones || "",
  });

  // State for the new combobox
  const [openMunicipioSelect, setOpenMunicipioSelect] = useState(false);
  const [searchMunicipioValue, setSearchMunicipioValue] = useState("");

  // UseEffect to update formData if client or zones change after initial render
  useEffect(() => {
    if (cliente.zona_id && zonas.length > 0) {
      const currentZona = zonas.find(z => z.id === cliente.zona_id);
      if (currentZona && (formData.zona_id !== currentZona.id || formData.zona_nombre !== currentZona.nombre)) {
        setFormData(prev => ({
          ...prev,
          zona_nombre: currentZona.nombre,
          zona_id: currentZona.id,
        }));
      }
    } else if (!cliente.zona_id && (formData.zona_id !== "" || formData.zona_nombre !== "")) {
      // If client has no zona_id, but form has values (e.g., from previous selection), reset them
      setFormData(prev => ({ ...prev, zona_nombre: "", zona_id: "" }));
    }
  }, [cliente.zona_id, zonas, cliente, formData.zona_id, formData.zona_nombre]);

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

    // If there's no zona_id but a zona_nombre is selected, check if it's an existing zone or create a new one
    if (!zonaId && formData.zona_nombre) {
      const zonaExistente = zonas.find(
        z => z.nombre.toLowerCase() === formData.zona_nombre.toLowerCase()
      );

      if (zonaExistente) {
        zonaId = zonaExistente.id;
      } else {
        // Create new zona if it doesn't exist
        try {
          const user = await base44.auth.me();
          const nuevaZona = await createZonaMutation.mutateAsync({
            nombre: formData.zona_nombre,
            fecha_creacion_zona: new Date().toISOString().split('T')[0],
            creador_email: user?.email,
          });
          zonaId = nuevaZona.id;
        } catch (error) {
          toast.error("Error al crear la nueva zona.");
          console.error("Error creating new zona:", error);
          return;
        }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Editar Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre_negocio">Nombre del negocio *</Label>
              <Input
                id="nombre_negocio"
                value={formData.nombre_negocio}
                onChange={(e) => setFormData({ ...formData, nombre_negocio: e.target.value })}
                placeholder="Ej: Panadería Pepe"
                required
              />
            </div>

            <div>
              <Label htmlFor="nombre_cliente">Nombre del cliente</Label>
              <Input
                id="nombre_cliente"
                value={formData.nombre_cliente}
                onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                placeholder="Ej: José García"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej: 600 123 456"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="municipio">Municipio *</Label>
              <Popover open={openMunicipioSelect} onOpenChange={setOpenMunicipioSelect}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMunicipioSelect}
                    className="w-full justify-between"
                  >
                    {formData.zona_nombre
                      ? formData.zona_nombre
                      : "Seleccionar municipio..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Buscar municipio..."
                      value={searchMunicipioValue}
                      onValueChange={setSearchMunicipioValue}
                    />
                    <CommandEmpty>No municipio found.</CommandEmpty>
                    <CommandGroup>
                      {buscarMunicipios(searchMunicipioValue).map((municipio) => (
                        <CommandItem
                          key={municipio.nombre}
                          value={municipio.nombre} // Value for onSelect
                          onSelect={(currentValue) => {
                            const selectedName = municipiosNavarra.find(
                                (m) => m.nombre.toLowerCase() === currentValue.toLowerCase()
                            )?.nombre || "";
                            const existingZona = zonas.find(z => z.nombre === selectedName);

                            setFormData(prev => ({
                              ...prev,
                              zona_nombre: selectedName,
                              zona_id: existingZona ? existingZona.id : "",
                            }));
                            setOpenMunicipioSelect(false);
                            setSearchMunicipioValue(""); // Clear search after selection
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.zona_nombre === municipio.nombre
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {municipio.nombre}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="anotaciones">Anotaciones</Label>
              <Textarea
                id="anotaciones"
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
              disabled={updateMutation.isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#004D9D] hover:bg-[#00AEEF]"
              disabled={updateMutation.isLoading}
            >
              {updateMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
