import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MapPin, Calendar, Sparkles, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function Zonas() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUltimaVisita, setEditingUltimaVisita] = useState(null);
  const [ultimaVisitaValue, setUltimaVisitaValue] = useState("");
  const [formData, setFormData] = useState({
    nombre: "",
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
      setEditingUltimaVisita(null);
      toast.success("Última visita actualizada");
    },
  });

  const resetForm = () => {
    setFormData({ nombre: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      nombre: formData.nombre,
      fecha_creacion_zona: new Date().toISOString().split('T')[0],
      creador_email: user?.email,
    };

    createMutation.mutate(dataToSave);
  };

  const handleUltimaVisitaClick = (zona, e) => {
    e.stopPropagation();
    setEditingUltimaVisita(zona.id);
    setUltimaVisitaValue(zona.ultima_visita || "");
  };

  const handleUltimaVisitaSubmit = (zona) => {
    updateMutation.mutate({
      id: zona.id,
      data: { ultima_visita: ultimaVisitaValue }
    });
  };



  const getClientesEnZona = (zonaId) => {
    return clientes.filter(c => c.zona_id === zonaId);
  };

  const getClientesInformeListo = (zonaId) => {
    return getClientesEnZona(zonaId).filter(c => c.estado === "Informe listo").length;
  };

  const getClientesFacturasPresentadas = (zonaId) => {
    return getClientesEnZona(zonaId).filter(c => c.estado === "Facturas presentadas").length;
  };

  const getPorcentajeInformesListos = (zonaId) => {
    const clientesZona = getClientesEnZona(zonaId);
    if (clientesZona.length === 0) return 0;
    const informesListos = getClientesInformeListo(zonaId);
    return Math.round((informesListos / clientesZona.length) * 100);
  };

  const isPriorityZone = (zonaId) => {
    const clientesZona = getClientesEnZona(zonaId);
    if (clientesZona.length === 0) return false;
    const informesListos = getClientesInformeListo(zonaId);
    return (informesListos / clientesZona.length) > 0.7;
  };

  const sortedZonas = [...zonas].sort((a, b) => {
    // Si ambas tienen orden manual, ordenar por orden
    if (a.orden !== undefined && b.orden !== undefined) {
      return a.orden - b.orden;
    }
    // Si solo una tiene orden, ponerla primero
    if (a.orden !== undefined) return -1;
    if (b.orden !== undefined) return 1;
    
    // Orden automático (si no hay orden manual)
    const aPriority = isPriorityZone(a.id);
    const bPriority = isPriorityZone(b.id);
    
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;
    
    const aVisita = a.ultima_visita ? new Date(a.ultima_visita) : null;
    const bVisita = b.ultima_visita ? new Date(b.ultima_visita) : null;
    const aCreacion = new Date(a.fecha_creacion_zona || a.created_date);
    const bCreacion = new Date(b.fecha_creacion_zona || b.created_date);
    
    const aFecha = aVisita || aCreacion;
    const bFecha = bVisita || bCreacion;
    
    return bFecha - aFecha;
  });

  const filteredZonas = sortedZonas.filter(zona => 
    zona.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(filteredZonas);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Actualizar el orden de todas las zonas
    const updates = items.map((zona, index) => ({
      id: zona.id,
      orden: index
    }));
    
    // Actualizar todas las zonas con su nuevo orden
    try {
      await Promise.all(
        updates.map(({ id, orden }) => 
          base44.entities.Zona.update(id, { orden })
        )
      );
      queryClient.invalidateQueries(['zonas']);
      toast.success("Orden actualizado");
    } catch (error) {
      toast.error("Error al actualizar el orden");
    }
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2">Gestión de Áreas</h1>
        <p className="text-[#666666]">Organiza tus clientes por ubicación geográfica</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          placeholder="Buscar área..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:max-w-md"
        />
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-[#6366F1] hover:bg-[#5558E3] text-white"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Área
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="zonas">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
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
                  <p className="text-[#666666]">No hay áreas creadas</p>
                </div>
              ) : (
                filteredZonas.map((zona, index) => {
            const clientesCount = getClientesEnZona(zona.id).length;
            const misClientesCount = getClientesEnZona(zona.id).filter(c => c.propietario_email === user.email).length;
            const informesListos = getClientesInformeListo(zona.id);
            const facturasPresent = getClientesFacturasPresentadas(zona.id);
            const porcentajeReady = getPorcentajeInformesListos(zona.id);
            const isPriority = isPriorityZone(zona.id);

            return (
              <Draggable key={zona.id} draggableId={zona.id} index={index}>
                {(provided, snapshot) => (
                  <Card 
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`hover:shadow-xl transition-all duration-300 cursor-pointer border-2 overflow-hidden ${
                      isPriority ? 'border-green-500 shadow-lg shadow-green-100' : 'border-gray-100'
                    } ${snapshot.isDragging ? 'shadow-2xl scale-105' : ''}`}
                    onClick={() => navigate(createPageUrl(`DetalleZona?id=${zona.id}`))}
                  >
                    <div 
                      {...provided.dragHandleProps}
                      className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm rounded-lg p-2 hover:bg-white transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-4 h-4 text-gray-600" />
                    </div>
                <CardHeader className={`p-0 ${
                  isPriority 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                }`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      {isPriority && (
                        <div className="flex items-center gap-1 bg-yellow-400/90 backdrop-blur-sm px-2 py-1 rounded-full">
                          <Sparkles className="w-3 h-3 text-yellow-900" />
                          <span className="text-xs font-bold text-yellow-900">
                            {porcentajeReady}% Ready ¡Visita recomendada!
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{zona.nombre}</h3>
                    
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white/90 text-sm">Total clientes:</span>
                        <span className="font-bold text-white text-xl">{clientesCount}</span>
                      </div>
                    </div>
                    
                    {editingUltimaVisita === zona.id ? (
                      <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                        <Input
                          value={ultimaVisitaValue}
                          onChange={(e) => setUltimaVisitaValue(e.target.value)}
                          placeholder="Última visita..."
                          className="h-8 text-sm bg-white/90"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUltimaVisitaSubmit(zona);
                            if (e.key === 'Escape') setEditingUltimaVisita(null);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUltimaVisitaSubmit(zona)}
                          className="h-8 bg-white/90 text-indigo-600 hover:bg-white"
                        >
                          OK
                        </Button>
                      </div>
                    ) : (
                      <div 
                        onClick={(e) => handleUltimaVisitaClick(zona, e)}
                        className="flex items-center gap-2 text-white/90 text-sm hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>{zona.ultima_visita || "Click para añadir fecha"}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="p-5 bg-white">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Mis clientes:</span>
                      <span className="font-bold text-indigo-600 text-lg">{misClientesCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Informes listos:</span>
                      <span className="font-bold text-green-600 text-lg">{informesListos}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm pb-3 border-b">
                      <span className="text-gray-600">Facturas presentadas:</span>
                      <span className="font-bold text-blue-600 text-lg">{facturasPresent}</span>
                    </div>

                    {isPriority && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <p className="text-xs font-semibold text-green-700">
                          ⚡ +70% con informe listo
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                  </Card>
                )}
              </Draggable>
            );
          })
        )}
        {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Nueva Área</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Nombre del área *
                </label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Tudela, Tafalla, Zona Sur..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  El planificador IA identificará la ubicación automáticamente
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#6366F1] hover:bg-[#5558E3]">
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}