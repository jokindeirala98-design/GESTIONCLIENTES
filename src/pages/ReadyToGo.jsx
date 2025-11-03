
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, MapPin, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ClienteCard from "../components/clientes/ClienteCard.jsx";

export default function ReadyToGo() {
  const navigate = useNavigate();
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

  if (!user) return null;

  const misClientesFacturasPresent = clientes.filter(
    c => c.propietario_email === user.email && c.estado === "Facturas presentadas"
  );

  const clientesPorZona = zonas.map(zona => ({
    zona,
    clientes: misClientesFacturasPresent.filter(c => c.zona_id === zona.id)
  })).filter(grupo => grupo.clientes.length > 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          Ready to Go
        </h1>
        <p className="text-[#666666]">
          Clientes con facturas presentadas listos para cerrar
        </p>
      </div>

      {misClientesFacturasPresent.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No tienes clientes con facturas presentadas
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí una vez hayas subido sus facturas
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
                {clientesZona.map(cliente => (
                  <ClienteCard
                    key={cliente.id}
                    cliente={cliente}
                    user={user}
                    zonas={zonas}
                    onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                  />
                ))}
              </div>
            </div>
          ))}

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-green-800 mb-2">
                    Total: {misClientesFacturasPresent.length} cliente(s) listo(s)
                  </h3>
                  <p className="text-sm text-green-700">
                    Los administradores están revisando las facturas y pronto subirán los informes finales.
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
