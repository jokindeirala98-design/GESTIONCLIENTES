import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MapPin, Calendar, Edit, Trash2, AlertCircle, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Zonas() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingZona, setEditingZona] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    nombre: "",
    ultima_visita: "",
    anotaciones: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: zonas = [], isLoading } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list('-created_date'),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Zona.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['zonas']);
      setShowDialog(false);
      resetForm();
      toast.success("Zona creada correctamente");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Zona.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['zonas']);
      setShowDialog(false);
      setEditingZona(null);
      resetForm();
      toast.success("Zona actualizada correctamente");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Zona.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['zonas']);
      toast.success("Zona eliminada correctamente");
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      ultima_visita: "",
      anotaciones: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      ...formData,
      fecha_creacion_zona: editingZona ? editingZona.fecha_creacion_zona : format(new Date(), 'yyyy-MM-dd'),
      creador_email: user?.email,
    };

    if (editingZona) {
      updateMutation.mutate({ id: editingZona.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const handleEdit = (zona) => {
    setEditingZona(zona);
    setFormData({
      nombre: zona.nombre,
      ultima_visita: zona.ultima_visita || "",
      anotaciones: zona.anotaciones || "",
    });
    setShowDialog(true);
  };

  const handleDelete = (zona) => {
    const clientesEnZona = clientes.filter(c => c.zona_id === zona.id);
    
    if (clientesEnZona.length > 0) {
      if (!window.confirm(`Esta zona tiene ${clientesEnZona.length} cliente(s). ¿Estás seguro de eliminarla? Los clientes quedarán sin zona asignada.`)) {
        return;
      }
    }
    
    if (window.confirm(`¿Eliminar la zona "${zona.nombre}"?`)) {
      deleteMutation.mutate(zona.id);
    }
  };

  const getClientesEnZona = (zonaId) => {
    return clientes.filter(c => c.zona_id === zonaId);
  };

  const getClientesInformeListo = (zonaId) => {
    const clientesZona = getClientesEnZona(zonaId);
    return clientesZona.filter(c => c.estado === "Informe listo").length;
  };

  const isPriorityZone = (zonaId) => {
    const clientesZona = getClientesEnZona(zonaId);
    if (clientesZona.length === 0) return false;
    const informesListos = getClientesInformeListo(zonaId);
    return (informesListos / clientesZona.length) > 0.7;
  };

  const sortedZonas = [...zonas].sort((a, b) => {
    const aPriority = isPriorityZone(a.id);
    const bPriority = isPriorityZone(b.id);
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const filteredZonas = sortedZonas.filter(zona => 
    zona.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) return null;
  const isAdmin = user.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2">Zonas</h1>
          <p className="text-[#666666]">Gestiona las zonas de trabajo</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingZona(null);
            setShowDialog(true);
          }}
          className="bg-[#004D9D] hover:bg-[#00AEEF] w-full md:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Zona
        </Button>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Buscar zona..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredZonas.some(z => isPriorityZone(z.id)) && (
        <Alert className="mb-6 border-green-500 bg-green-50">
          <Sparkles className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Las zonas resaltadas en verde tienen más del 70% de clientes con informe listo
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-gray-200" />
              <CardContent className="h-32 bg-gray-100" />
            </Card>
          ))
        ) : filteredZonas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666]">No hay zonas creadas</p>
          </div>
        ) : (
          filteredZonas.map((zona) => {
            const clientesCount = getClientesEnZona(zona.id).length;
            const informesListos = getClientesInformeListo(zona.id);
            const isPriority = isPriorityZone(zona.id);

            return (
              <Card 
                key={zona.id} 
                className={`hover:shadow-lg transition-all duration-300 border-2 cursor-pointer ${
                  isPriority ? 'border-green-500 bg-green-50' : 'border-transparent'
                }`}
                onClick={() => navigate(createPageUrl(`DetalleZona?id=${zona.id}`))}
              >
                <CardHeader className={`${isPriority ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-[#004D9D] to-[#00AEEF]'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg mb-2">{zona.nombre}</CardTitle>
                      <div className="flex items-center gap-2 text-white/90 text-xs">
                        <Calendar className="w-3 h-3" />
                        {zona.fecha_creacion_zona 
                          ? format(new Date(zona.fecha_creacion_zona), "d 'de' MMMM, yyyy", { locale: es })
                          : format(new Date(zona.created_date), "d 'de' MMMM, yyyy", { locale: es })
                        }
                      </div>
                    </div>
                    {isPriority && (
                      <Sparkles className="w-5 h-5 text-yellow-300" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {zona.ultima_visita && (
                    <div className="mb-3 text-sm">
                      <span className="text-[#666666]">Última visita: </span>
                      <span className="font-medium text-[#004D9D]">{zona.ultima_visita}</span>
                    </div>
                  )}
                  
                  {zona.anotaciones && (
                    <p className="text-sm text-[#666666] mb-4 line-clamp-2">{zona.anotaciones}</p>
                  )}

                  <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center flex-1">
                      <p className="text-2xl font-bold text-[#004D9D]">{clientesCount}</p>
                      <p className="text-xs text-[#666666]">Clientes</p>
                    </div>
                    <div className="w-px h-8 bg-gray-300" />
                    <div className="text-center flex-1">
                      <p className="text-2xl font-bold text-green-600">{informesListos}</p>
                      <p className="text-xs text-[#666666]">Listos</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(zona);
                      }}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(zona);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              {editingZona ? 'Editar Zona' : 'Nueva Zona'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Nombre de la zona *
                </label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Valencia Centro"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Última visita
                </label>
                <Input
                  value={formData.ultima_visita}
                  onChange={(e) => setFormData({ ...formData, ultima_visita: e.target.value })}
                  placeholder="Ej: Próxima semana"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Anotaciones
                </label>
                <Textarea
                  value={formData.anotaciones}
                  onChange={(e) => setFormData({ ...formData, anotaciones: e.target.value })}
                  placeholder="Notas sobre la zona..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditingZona(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#004D9D] hover:bg-[#00AEEF]">
                {editingZona ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}