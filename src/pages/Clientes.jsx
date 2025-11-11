
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ClienteCard from "../components/clientes/ClienteCard.jsx";
import CreateClienteDialog from "../components/clientes/CreateClienteDialog.jsx";

export default function Clientes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterZona, setFilterZona] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Filtrar: cada usuario ve solo sus clientes (admin ve todos)
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user.email);

  const filteredClientes = misClientes.filter(cliente => {
    const matchSearch = 
      cliente.nombre_negocio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.nombre_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefono?.includes(searchTerm);
    
    const matchEstado = filterEstado === "all" || cliente.estado === filterEstado;
    const matchZona = filterZona === "all" || cliente.zona_id === filterZona;
    
    return matchSearch && matchEstado && matchZona;
  });

  const sortedClientes = [...filteredClientes].sort((a, b) => 
    (a.nombre_negocio || "").localeCompare(b.nombre_negocio || "")
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2">
            {isAdmin ? 'Todos los Clientes' : 'Mis Clientes'}
          </h1>
          <p className="text-[#666666]">Gestiona tu cartera de clientes</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-[#004D9D] hover:bg-[#00AEEF] w-full md:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      <Card className="mb-6 border-none shadow-md">
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="Primer contacto">Primer contacto</SelectItem>
                <SelectItem value="Esperando facturas">Esperando facturas</SelectItem>
                <SelectItem value="Facturas presentadas">Facturas presentadas</SelectItem>
                <SelectItem value="Informe listo">Informe listo</SelectItem>
                <SelectItem value="Pendiente de firma">Pendiente de firma</SelectItem>
                <SelectItem value="Pendiente de aprobación">Pendiente de aprobación</SelectItem>
                <SelectItem value="Firmado con éxito">Firmado con éxito</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterZona} onValueChange={setFilterZona}>
              <SelectTrigger>
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {zonas.map(zona => (
                  <SelectItem key={zona.id} value={zona.id}>{zona.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48 bg-gray-100" />
            </Card>
          ))
        ) : sortedClientes.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] mb-4">No se encontraron clientes</p>
            {searchTerm || filterEstado !== "all" || filterZona !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setFilterEstado("all");
                  setFilterZona("all");
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          sortedClientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              user={user}
              zonas={zonas}
              onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
            />
          ))
        )}
      </div>

      <CreateClienteDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        user={user}
        zonas={zonas}
      />
    </div>
  );
}
