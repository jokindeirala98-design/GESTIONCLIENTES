import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Building2, MapPin, FileText, Download, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ clienteId, nuevoEstado }) => 
      base44.entities.Cliente.update(clienteId, { estado: nuevoEstado }),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientes']);
      toast.success("Estado actualizado");
    },
  });

  const handleCambiarEstado = (clienteId, nuevoEstado) => {
    updateStatusMutation.mutate({ clienteId, nuevoEstado });
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Clientes con informes listos
  const clientesReady = clientes.filter(c => c.estado === "Informe listo");

  // Filtrar por propietario si no es admin
  const misClientesReady = isAdmin 
    ? clientesReady 
    : clientesReady.filter(c => c.propietario_email === user.email);

  // Agrupar por zona
  const clientesPorZona = misClientesReady.reduce((acc, cliente) => {
    const zona = zonas.find(z => z.id === cliente.zona_id);
    const zonaNombre = zona?.nombre || "Sin zona";
    
    if (!acc[zonaNombre]) {
      acc[zonaNombre] = [];
    }
    acc[zonaNombre].push(cliente);
    return acc;
  }, {});

  // Ordenar zonas por número de clientes (descendente)
  const zonasOrdenadas = Object.keys(clientesPorZona).sort((a, b) => 
    clientesPorZona[b].length - clientesPorZona[a].length
  );

  const getTipoMaximo = (cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return null;
    const orden = { "6.1": 3, "3.0": 2, "2.0": 1 };
    return cliente.suministros.reduce((max, s) => {
      const actual = orden[s.tipo_factura] || 0;
      const maxActual = orden[max] || 0;
      return actual > maxActual ? s.tipo_factura : max;
    }, "2.0");
  };

  const tipoColors = {
    "6.1": "bg-red-600 text-white",
    "3.0": "bg-orange-600 text-white",
    "2.0": "bg-blue-600 text-white"
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle className="w-8 h-8" />
          Ready to Go
        </h1>
        <p className="text-[#666666]">
          {isAdmin ? "Todos los clientes" : "Tus clientes"} con informes listos para presentar
        </p>
      </div>

      {/* Resumen */}
      <Card className="mb-6 border-l-4 border-green-500">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#666666] mb-1">Total clientes listos</p>
              <p className="text-4xl font-bold text-green-600">{misClientesReady.length}</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clientes por zona */}
      {zonasOrdenadas.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">No hay clientes con informes listos</p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando el administrador suba los informes finales
            </p>
          </CardContent>
        </Card>
      ) : (
        zonasOrdenadas.map(zonaNombre => (
          <div key={zonaNombre} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-6 h-6 text-[#004D9D]" />
              <h2 className="text-xl font-bold text-[#004D9D]">{zonaNombre}</h2>
              <Badge variant="outline">{clientesPorZona[zonaNombre].length} cliente(s)</Badge>
            </div>

            <div className="space-y-4">
              {clientesPorZona[zonaNombre].map(cliente => {
                const esMio = cliente.propietario_email === user.email;
                const puedoActualizar = esMio || isAdmin;
                const tipoMax = getTipoMaximo(cliente);

                return (
                  <Card 
                    key={cliente.id}
                    className="hover:shadow-lg transition-all duration-300 border-l-4 border-green-500"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1">
                          <div 
                            className="flex items-start gap-3 mb-3 cursor-pointer"
                            onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                          >
                            <Building2 className="w-6 h-6 text-[#004D9D] flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <h3 className="font-bold text-[#004D9D] text-lg mb-1 hover:underline">
                                {cliente.nombre_negocio}
                              </h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-600">{cliente.propietario_iniciales}</span>
                                {tipoMax && (
                                  <Badge className={tipoColors[tipoMax]}>
                                    Max: {tipoMax}
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {cliente.suministros?.length || 0} suministro(s)
                                </Badge>
                                {cliente.comision && (
                                  <Badge className="bg-yellow-600 text-white">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    {cliente.comision}€
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Suministros con informes */}
                          {cliente.suministros && cliente.suministros.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-green-600" />
                                <p className="text-sm font-semibold text-green-700">Informes disponibles:</p>
                              </div>
                              {cliente.suministros.map(suministro => (
                                <div key={suministro.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Badge className={tipoColors[suministro.tipo_factura]} variant="outline">
                                        {suministro.tipo_factura}
                                      </Badge>
                                      <span className="text-sm font-medium text-gray-700 truncate">{suministro.nombre}</span>
                                      {suministro.comision && (
                                        <span className="text-sm text-green-600 font-semibold">
                                          ({suministro.comision}€)
                                        </span>
                                      )}
                                    </div>
                                    {suministro.informe_final ? (
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(suministro.informe_final.url, '_blank');
                                        }}
                                        className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                                      >
                                        <Download className="w-4 h-4 mr-1" />
                                        Descargar
                                      </Button>
                                    ) : (
                                      <Badge variant="outline" className="text-red-600 border-red-300 flex-shrink-0">
                                        Sin informe
                                      </Badge>
                                    )}
                                  </div>
                                  {suministro.informe_final && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      📄 {suministro.informe_final.nombre}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {puedoActualizar && (
                          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-sm font-semibold text-gray-600 mb-1">Cambiar estado:</p>
                            <Select
                              value={cliente.estado}
                              onValueChange={(value) => handleCambiarEstado(cliente.id, value)}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Informe listo">Informe listo</SelectItem>
                                <SelectItem value="Pendiente de firma">Pendiente de firma</SelectItem>
                                {isAdmin && (
                                  <>
                                    <SelectItem value="Firmado con éxito">Firmado con éxito</SelectItem>
                                    <SelectItem value="Rechazado">Rechazado</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}