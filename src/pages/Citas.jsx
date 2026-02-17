import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Filter, Calendar } from "lucide-react";

export default function Citas() {
  const [user, setUser] = useState(null);
  const [soloMis, setSoloMis] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  // Clientes con informe de potencias (50%)
  const clientesPotencias = clientes.filter(c => {
    if (soloMis && c.propietario_email !== user?.email) return false;
    if (!c.suministros || c.suministros.length === 0) return false;
    return c.suministros.some(s => s.informe_potencias && !s.informe_comparativo);
  });

  // Clientes con informe final completo (100%)
  const clientesCompletos = clientes.filter(c => {
    if (soloMis && c.propietario_email !== user?.email) return false;
    if (!c.suministros || c.suministros.length === 0) return false;
    return c.suministros.every(s => s.informe_comparativo);
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8" />
            Clientes para Citas
          </h1>
          <p className="text-[#666666]">
            Clientes con informes listos para presentación
          </p>
        </div>
        <Button
          variant={soloMis ? "default" : "outline"}
          onClick={() => setSoloMis(!soloMis)}
          className={soloMis ? "bg-[#004D9D]" : "border-[#004D9D] text-[#004D9D]"}
        >
          <Filter className="w-4 h-4 mr-2" />
          {soloMis ? "Mostrando solo mis clientes" : "Solo mis clientes"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Clientes con informe de potencias (50%) */}
        <Card className="border-l-4 border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-700 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Informe de Potencias Listo - 50% ({clientesPotencias.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientesPotencias.map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900 text-base">{cliente.nombre_negocio}</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Comercial: {cliente.propietario_iniciales}
                      </p>
                    </div>
                    <Badge className="bg-yellow-600 text-white">50%</Badge>
                  </div>
                </div>
              ))}
              {clientesPotencias.length === 0 && (
                <p className="text-center text-[#666666] py-8">
                  No hay clientes con informes de potencias listos
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clientes con informe final completo (100%) */}
        <Card className="border-l-4 border-green-500">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Informe Final Listo - 100% ({clientesCompletos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientesCompletos.map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-green-50 border-2 border-green-400 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900 text-base">{cliente.nombre_negocio}</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Comercial: {cliente.propietario_iniciales}
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">100%</Badge>
                  </div>
                </div>
              ))}
              {clientesCompletos.length === 0 && (
                <p className="text-center text-[#666666] py-8">
                  No hay clientes con informes completos listos
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}