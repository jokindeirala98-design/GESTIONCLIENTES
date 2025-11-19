import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, Plus, Trash2, Users, TrendingUp, FileCheck
} from "lucide-react";
import { toast } from "sonner";
import ClienteCard from "../components/clientes/ClienteCard.jsx";
import CreateClienteDialog from "../components/clientes/CreateClienteDialog.jsx";

export default function DetalleZona() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showCreateCliente, setShowCreateCliente] = useState(false);

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

  const deleteZonaMutation = useMutation({
    mutationFn: async (id) => {
      const clientesEnZona = clientes.filter(c => c.zona_id === id);
      for (const cliente of clientesEnZona) {
        await base44.entities.Cliente.delete(cliente.id);
      }
      return base44.entities.Zona.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['zonas']);
      queryClient.invalidateQueries(['clientes']);
      toast.success("Área y sus clientes eliminados correctamente");
      navigate(createPageUrl("Zonas"));
    },
  });

  const handleDeleteZona = () => {
    const clientesEnZona = clientes.filter(c => c.zona_id === zonaId).length; // Moved here to ensure it's up-to-date

    if (!window.confirm(`¿Estás seguro de eliminar el área "${zona.nombre}"?\n\n⚠️ Se eliminarán también ${clientesEnZona} cliente(s) asociados a esta área.\n\nEsta acción no se puede deshacer.`)) {
      return;
    }
    
    deleteZonaMutation.mutate(zonaId);
  };

  const getClientesEnZona = (id) => {
    return clientes.filter(c => c.zona_id === id);
  };

  const getClientesInformeListo = (id) => {
    const clientesZona = getClientesEnZona(id);
    return clientesZona.filter(c => c.estado === "Informe listo").length;
  };

  const isPriorityZone = (id) => {
    const clientesZona = getClientesEnZona(id);
    if (clientesZona.length === 0) return false;
    const informesListos = getClientesInformeListo(id);
    return (informesListos / clientesZona.length) > 0.7;
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
  
  // TODOS ven TODOS los clientes de la zona (anonimizados para no propietarios)
  const clientesParaMostrar = clientesDeZona;
  
  const misClientesDeZona = clientesDeZona.filter(c => c.propietario_email === user.email);
  const clientesInformeListo = clientesDeZona.filter(c => c.estado === "Informe listo").length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Button
        variant="outline"
        onClick={() => navigate(createPageUrl("Zonas"))}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Áreas
      </Button>

      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 md:p-8 mb-6 text-white shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{zona.nombre}</h1>
        
        {zona.ultima_visita && (
          <p className="text-white/80 mb-6">Última visita: {zona.ultima_visita}</p>
        )}

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-white/80" />
            <p className="text-2xl md:text-3xl font-bold">{misClientesDeZona.length}</p>
            <p className="text-sm text-white/70">Mis Clientes</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-white/80" />
            <p className="text-2xl md:text-3xl font-bold">{clientesDeZona.length}</p>
            <p className="text-sm text-white/70">Clientes Totales</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
            <FileCheck className="w-8 h-8 mx-auto mb-2 text-white/80" />
            <p className="text-2xl md:text-3xl font-bold">{clientesInformeListo}</p>
            <p className="text-sm text-white/70">Informes Listos</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-[#004D9D]">
          Clientes en {zona.nombre}
        </h2>
        <Button
          onClick={() => setShowCreateCliente(true)}
          className="bg-[#6366F1] hover:bg-[#5558E3] w-full md:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Añadir Cliente
        </Button>
      </div>

      {clientesParaMostrar.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg mb-2">
              No hay clientes en esta área
            </p>
            <p className="text-gray-400 text-sm mb-4">
              Comienza agregando un cliente
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {clientesParaMostrar.map((cliente, index) => {
            const esMio = cliente.propietario_email === user.email;
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
            
            return (
              <Card 
                key={cliente.id}
                className={`border-l-4 cursor-pointer hover:shadow-lg transition-all duration-300`}
                style={{ borderLeftColor: estadoColors[cliente.estado] }}
                onClick={() => esMio ? navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`)) : null}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-[#004D9D] text-lg">
                      {esMio ? cliente.nombre_negocio : `${zona.nombre} ${index + 1}`}
                    </h3>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {cliente.propietario_iniciales}
                      </span>
                    </div>
                  </div>
                  <Badge className={`${estadoColors[cliente.estado]} text-white`}>
                    {cliente.estado}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-2 border-red-200 bg-red-50 mt-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-red-900 mb-1">Zona de peligro</h3>
              <p className="text-sm text-red-700">
                Eliminar el área "{zona.nombre}" y todos sus clientes ({clientesDeZona.length} clientes)
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteZona}
              className="bg-red-600 hover:bg-red-700 w-full md:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar Área y Todos los Clientes
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateClienteDialog
        open={showCreateCliente}
        onClose={() => setShowCreateCliente(false)}
        user={user}
        zonas={todasZonas}
        zonaPreseleccionada={zonaId}
      />
    </div>
  );
}