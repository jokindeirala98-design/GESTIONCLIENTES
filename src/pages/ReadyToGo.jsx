
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin, Building2, X, Edit3, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ReadyToGo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Estado actualizado");
    },
  });

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Todos los clientes con informe listo (de todos los usuarios)
  const clientesInformeListo = clientes.filter(c => c.estado === "Informe listo");

  const handleCambiarEstado = (e, clienteId, nuevoEstado) => {
    e.stopPropagation();
    
    if (nuevoEstado === "Firmado con éxito") {
      const fechaCierre = new Date().toISOString().split('T')[0];
      const mesComision = fechaCierre.substring(0, 7);
      
      updateMutation.mutate({
        id: clienteId,
        data: { 
          estado: nuevoEstado,
          fecha_cierre: fechaCierre,
          mes_comision: mesComision
        }
      });
    } else {
      updateMutation.mutate({
        id: clienteId,
        data: { estado: nuevoEstado }
      });
    }
  };

  const clientesPorZona = zonas.map(zona => ({
    zona,
    clientes: clientesInformeListo
      .filter(c => c.zona_id === zona.id)
      .sort((a, b) => (b.propietario_email === user.email ? 1 : -1) - (a.propietario_email === user.email ? 1 : -1))
  })).filter(grupo => grupo.clientes.length > 0)
    .sort((a, b) => b.clientes.length - a.clientes.length);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          Ready to Go
        </h1>
        <p className="text-[#666666]">
          Clientes con informe listo para presentar y cerrar
        </p>
      </div>

      {clientesInformeListo.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay clientes con informe listo
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando el admin suba sus informes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {clientesPorZona.map(({ zona, clientes: clientesZona }) => (
            <div key={zona.id}>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[#004D9D]">
                <MapPin className="w-6 h-6 text-[#004D9D]" />
                <h2 className="text-xl font-bold text-[#004D9D]">{zona.nombre}</h2>
                <span className="ml-auto bg-[#004D9D] text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {clientesZona.length} cliente(s)
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientesZona.map(cliente => {
                  const isOwner = cliente.propietario_email === user.email;
                  const canViewDetails = isOwner || isAdmin;

                  return (
                    <Card 
                      key={cliente.id}
                      className="hover:shadow-lg transition-all duration-300 border-l-4 border-green-500"
                    >
                      <CardContent className="p-5">
                        <div 
                          className="cursor-pointer"
                          onClick={() => canViewDetails && navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-5 h-5 text-[#004D9D]" />
                                <h3 className="font-bold text-[#004D9D]">
                                  {canViewDetails ? cliente.nombre_negocio : `Cliente de ${cliente.propietario_iniciales}`}
                                </h3>
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <button className="text-left">
                                    <Badge className="bg-green-500 text-white text-xs hover:opacity-80 cursor-pointer">
                                      ✓ Informe listo ▼
                                    </Badge>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                  {!isAdmin && isOwner && (
                                    <>
                                      <DropdownMenuItem onClick={(e) => handleCambiarEstado(e, cliente.id, "Rechazado")}>
                                        <X className="w-4 h-4 mr-2 text-red-600" />
                                        <span className="text-red-600">Rechazado</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => handleCambiarEstado(e, cliente.id, "Pendiente de firma")}>
                                        <Edit3 className="w-4 h-4 mr-2 text-purple-600" />
                                        <span className="text-purple-600">✍️ Pendiente de firma</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => handleCambiarEstado(e, cliente.id, "Firmado con éxito")}>
                                        <CheckCircle2 className="w-4 h-4 mr-2 text-yellow-600" />
                                        <span className="text-yellow-600">🏆 Firmado con éxito</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuItem onClick={(e) => handleCambiarEstado(e, cliente.id, "Rechazado")}>
                                        <X className="w-4 h-4 mr-2 text-red-600" />
                                        <span className="text-red-600">Rechazado</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => handleCambiarEstado(e, cliente.id, "Firmado con éxito")}>
                                        <CheckCircle2 className="w-4 h-4 mr-2 text-yellow-600" />
                                        <span className="text-yellow-600">🏆 Firmado con éxito</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {cliente.propietario_iniciales}
                              </span>
                            </div>
                          </div>

                          {canViewDetails && (
                            <>
                              {cliente.nombre_cliente && (
                                <p className="text-sm text-[#666666] mb-1">👤 {cliente.nombre_cliente}</p>
                              )}
                              {cliente.telefono && (
                                <p className="text-sm text-[#666666] mb-1">📞 {cliente.telefono}</p>
                              )}
                            </>
                          )}

                          {!canViewDetails && (
                            <p className="text-sm text-gray-400 italic mt-2">
                              Solo puedes ver la advertencia de este cliente
                            </p>
                          )}
                        </div>

                        {/* Informes disponibles para descargar */}
                        {cliente.informes_finales && cliente.informes_finales.length > 0 && (
                          <div className="mt-4 pt-3 border-t space-y-2">
                            <p className="text-xs font-semibold text-purple-600 mb-2">
                              📄 Informes disponibles:
                            </p>
                            {cliente.informes_finales.map((informe, index) => (
                              <a
                                key={index}
                                href={informe.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-between p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <Download className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  <span className="text-sm text-purple-700 truncate">
                                    {informe.nombre}
                                  </span>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-green-800 mb-2">
                    Total: {clientesInformeListo.length} cliente(s) listo(s)
                  </h3>
                  <p className="text-sm text-green-700">
                    Los informes están preparados. Puedes presentarlos a los clientes para su firma.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
