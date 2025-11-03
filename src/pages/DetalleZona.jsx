import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, MapPin, Calendar, Plus, Edit, Trash2, Users, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import ClienteCard from "../components/clientes/ClienteCard.jsx";
import CreateClienteDialog from "../components/clientes/CreateClienteDialog.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DetalleZona() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [showEditZona, setShowEditZona] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: "",
    ultima_visita: "",
    anotaciones: "",
  });

  const urlParams = new URLSearchParams(window.location.search);
  const zonaId = urlParams.get('id');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: zona, isLoading: loadingZona } = useQuery({
    queryKey: ['zona', zonaId],
    queryFn: async () => {
      const zonas = await base44.entities.Zona.list();
      return zonas.find(z => z.id === zonaId);
    },
    enabled: !!zonaId,
  });

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  const { data: todasZonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateZonaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Zona.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['zona', zonaId]);
      queryClient.invalidateQueries(['zonas']);
      setShowEditZona(false);
      toast.success("Zona actualizada correctamente");
    },
  });

  const deleteZonaMutation = useMutation({
    mutationFn: (id) => base44.entities.Zona.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['zonas']);
      toast.success("Zona eliminada correctamente");
      navigate(createPageUrl("Zonas"));
    },
  });

  useEffect(() => {
    if (zona) {
      setEditForm({
        nombre: zona.nombre || "",
        ultima_visita: zona.ultima_visita || "",
        anotaciones: zona.anotaciones || "",
      });
    }
  }, [zona]);

  const handleEditZona = (e) => {
    e.preventDefault();
    updateZonaMutation.mutate({ id: zonaId, data: editForm });
  };

  const handleDeleteZona = () => {
    const clientesEnZona = clientesDeZona.length;
    
    if (clientesEnZona > 0) {
      if (!window.confirm(`Esta zona tiene ${clientesEnZona} cliente(s). ¿Estás seguro de eliminarla? Los clientes quedarán sin zona asignada.`)) {
        return;
      }
    }
    
    if (window.confirm(`¿Eliminar la zona "${zona.nombre}"?`)) {
      deleteZonaMutation.mutate(zonaId);
    }
  };

  if (loadingZona || loadingClientes || !user || !zona) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const clientesDeZona = clientes.filter(c => c.zona_id === zonaId);
  const misClientesDeZona = isAdmin 
    ? clientesDeZona 
    : clientesDeZona.filter(c => c.propietario_email === user.email);
  
  const clientesInformeListo = clientesDeZona.filter(c => c.estado === "Informe listo").length;
  const isPriorityZone = clientesDeZona.length > 0 && (clientesInformeListo / clientesDeZona.length) > 0.7;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Button
        variant="outline"
        onClick={() => navigate(createPageUrl("Zonas"))}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Zonas
      </Button>

      <Card 
        className={`border-none shadow-lg mb-6 ${
          isPriorityZone ? 'border-2 border-green-500' : ''
        }`}
      >
        <CardHeader className={`${
          isPriorityZone 
            ? 'bg-gradient-to-r from-green-500 to-green-600' 
            : 'bg-gradient-to-r from-[#004D9D] to-[#00AEEF]'
        }`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-8 h-8 text-white" />
                <CardTitle className="text-white text-2xl">{zona.nombre}</CardTitle>
                {isPriorityZone && (
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                )}
              </div>
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <Calendar className="w-4 h-4" />
                Creada: {zona.fecha_creacion_zona 
                  ? format(new Date(zona.fecha_creacion_zona), "d 'de' MMMM, yyyy", { locale: es })
                  : format(new Date(zona.created_date), "d 'de' MMMM, yyyy", { locale: es })
                }
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditZona(true)}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteZona}
                  className="bg-red-500/20 text-white border-red-300/20 hover:bg-red-500/30"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {zona.ultima_visita && (
              <div>
                <p className="text-sm text-[#666666] mb-1">Última visita</p>
                <p className="font-medium text-[#004D9D]">{zona.ultima_visita}</p>
              </div>
            )}
            
            <div>
              <p className="text-sm text-[#666666] mb-1">Total de clientes</p>
              <p className="text-2xl font-bold text-[#004D9D]">{clientesDeZona.length}</p>
            </div>

            <div>
              <p className="text-sm text-[#666666] mb-1">Informes listos</p>
              <p className="text-2xl font-bold text-green-600">{clientesInformeListo}</p>
            </div>
          </div>

          {zona.anotaciones && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-[#004D9D] mb-2">Anotaciones</h3>
              <p className="text-[#666666] whitespace-pre-wrap">{zona.anotaciones}</p>
            </div>
          )}

          {isPriorityZone && (
            <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Zona Prioritaria</p>
                  <p className="text-sm text-green-700">
                    Más del 70% de los clientes tienen informe listo
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#004D9D] flex items-center gap-3">
          <Users className="w-7 h-7" />
          Clientes en esta zona
        </h2>
        <Button
          onClick={() => setShowCreateCliente(true)}
          className="bg-[#004D9D] hover:bg-[#00AEEF]"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {misClientesDeZona.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg mb-2">
              No hay clientes en esta zona
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Comienza agregando tu primer cliente
            </p>
            <Button
              onClick={() => setShowCreateCliente(true)}
              variant="outline"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {misClientesDeZona.map(cliente => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              user={user}
              zonas={todasZonas}
              onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
            />
          ))}
        </div>
      )}

      <CreateClienteDialog
        open={showCreateCliente}
        onClose={() => setShowCreateCliente(false)}
        user={user}
        zonas={todasZonas}
        zonaPreseleccionada={zonaId}
      />

      <Dialog open={showEditZona} onOpenChange={setShowEditZona}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Editar Zona</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditZona}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Nombre de la zona *
                </label>
                <Input
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  placeholder="Ej: Valencia Centro"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Última visita
                </label>
                <Input
                  value={editForm.ultima_visita}
                  onChange={(e) => setEditForm({ ...editForm, ultima_visita: e.target.value })}
                  placeholder="Ej: Próxima semana"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Anotaciones
                </label>
                <Textarea
                  value={editForm.anotaciones}
                  onChange={(e) => setEditForm({ ...editForm, anotaciones: e.target.value })}
                  placeholder="Notas sobre la zona..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditZona(false)}
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
    </div>
  );
}