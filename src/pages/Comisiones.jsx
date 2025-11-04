
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Building2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Comisiones() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') {
        navigate(createPageUrl("Dashboard"));
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [navigate]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  if (!user) return null;

  const misClientesCerrados = clientes.filter(
    c => c.propietario_email === user.email && 
         c.estado === "Firmado con éxito" && 
         c.comision
  );

  const clientesDelMes = misClientesCerrados.filter(
    c => c.mes_comision === mesSeleccionado
  );

  const totalMes = clientesDelMes.reduce((sum, c) => sum + (c.comision || 0), 0);

  const mesesDisponibles = [...new Set(misClientesCerrados.map(c => c.mes_comision))]
    .filter(Boolean)
    .sort()
    .reverse();

  const cambiarMes = (direccion) => {
    const currentIndex = mesesDisponibles.indexOf(mesSeleccionado);
    if (direccion === 'prev' && currentIndex < mesesDisponibles.length - 1) {
      setMesSeleccionado(mesesDisponibles[currentIndex + 1]);
    } else if (direccion === 'next' && currentIndex > 0) {
      setMesSeleccionado(mesesDisponibles[currentIndex - 1]);
    }
  };

  const formatearMes = (mesStr) => {
    if (!mesStr) return "";
    const [year, month] = mesStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy', { locale: es });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <DollarSign className="w-8 h-8" />
          Comisiones
        </h1>
        <p className="text-[#666666]">
          Gestiona tus comisiones mensuales
        </p>
      </div>

      <Card className="border-none shadow-lg mb-6 bg-gradient-to-r from-green-500 to-green-600">
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-white/90 text-sm mb-2">Total del Mes Actual</p>
            <p className="text-5xl font-bold text-white mb-1">
              €{totalMes.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-2 text-white/90 text-sm mt-3">
              <TrendingUp className="w-4 h-4" />
              <span>{clientesDelMes.length} cliente(s) cerrado(s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md mb-6">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="text-[#004D9D]">
            {formatearMes(mesSeleccionado)}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('prev')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === mesesDisponibles.length - 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('next')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {clientesDelMes.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-[#666666]">
                No hay comisiones en este mes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientesDelMes.map(cliente => (
                <div 
                  key={cliente.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#004D9D]">
                        {cliente.nombre_negocio}
                      </p>
                      {cliente.fecha_cierre && (
                        <p className="text-xs text-[#666666]">
                          Cerrado: {format(new Date(cliente.fecha_cierre), "d 'de' MMMM", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      €{cliente.comision.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="mt-6 pt-6 border-t-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-[#666666]">
                    Total del mes
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    €{totalMes.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {mesesDisponibles.length > 0 && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D]">Historial Mensual</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {mesesDisponibles.map(mes => {
                const clientesMes = misClientesCerrados.filter(c => c.mes_comision === mes);
                const totalMesHist = clientesMes.reduce((sum, c) => sum + (c.comision || 0), 0);
                
                return (
                  <button
                    key={mes}
                    onClick={() => setMesSeleccionado(mes)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                      mes === mesSeleccionado 
                        ? 'bg-[#004D9D] text-white' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">
                      {formatearMes(mes)}
                    </span>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${mes === mesSeleccionado ? 'text-white' : 'text-green-600'}`}>
                        €{totalMesHist.toFixed(2)}
                      </p>
                      <p className={`text-xs ${mes === mesSeleccionado ? 'text-white/80' : 'text-[#666666]'}`}>
                        {clientesMes.length} cliente(s)
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
