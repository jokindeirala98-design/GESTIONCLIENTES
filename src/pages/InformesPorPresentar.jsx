import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, User, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import SubirInformeDialog from "../components/clientes/SubirInformeDialog.jsx";

const tipoFacturaOrder = {
  "6.1": 1,
  "3.0": 2,
  "2.0": 3
};

const tipoFacturaColors = {
  "6.1": "bg-red-500",
  "3.0": "bg-orange-500",
  "2.0": "bg-blue-500"
};

export default function InformesPorPresentar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [showInformeDialog, setShowInformeDialog] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("Dashboard"));
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [navigate]);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  if (!user) return null;

  const clientesFacturasPresent = clientes.filter(
    c => c.estado === "Facturas presentadas"
  );

  const clientesOrdenados = [...clientesFacturasPresent].sort((a, b) => {
    const orderA = tipoFacturaOrder[a.tipo_factura] || 999;
    const orderB = tipoFacturaOrder[b.tipo_factura] || 999;
    return orderA - orderB;
  });

  const conteo = {
    "6.1": clientesFacturasPresent.filter(c => c.tipo_factura === "6.1").length,
    "3.0": clientesFacturasPresent.filter(c => c.tipo_factura === "3.0").length,
    "2.0": clientesFacturasPresent.filter(c => c.tipo_factura === "2.0").length,
  };

  const handleSubirInforme = (e, cliente) => {
    e.stopPropagation();
    setClienteSeleccionado(cliente);
    setShowInformeDialog(true);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8" />
          Informes por Presentar
        </h1>
        <p className="text-[#666666]">
          Clientes con facturas listas para subir informe final
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-l-4 border-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Tipo 6.1</p>
                <p className="text-3xl font-bold text-red-600">{conteo["6.1"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Tipo 3.0</p>
                <p className="text-3xl font-bold text-orange-600">{conteo["3.0"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Tipo 2.0</p>
                <p className="text-3xl font-bold text-blue-600">{conteo["2.0"]}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clientesOrdenados.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg">
              No hay informes pendientes
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Los clientes aparecerán aquí cuando suban facturas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clientesOrdenados.map(cliente => {
            const zona = zonas.find(z => z.id === cliente.zona_id);
            
            return (
              <Card 
                key={cliente.id}
                className="hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4"
                style={{ borderLeftColor: tipoFacturaColors[cliente.tipo_factura] || '#004D9D' }}
                onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-3">
                        <Building2 className="w-6 h-6 text-[#004D9D] flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-bold text-[#004D9D] text-lg mb-1">
                            {cliente.nombre_negocio}
                          </h3>
                          {zona && (
                            <p className="text-sm text-[#666666]">{zona.nombre}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-[#666666]">
                        <User className="w-4 h-4" />
                        <span>Propietario: {cliente.propietario_iniciales}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Badge 
                        className={`${tipoFacturaColors[cliente.tipo_factura]} text-white justify-center`}
                      >
                        Tipo {cliente.tipo_factura}
                      </Badge>
                      
                      {cliente.facturas && cliente.facturas.length > 0 && (
                        <div className="text-xs text-[#666666] text-center">
                          {cliente.facturas.length} factura(s)
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => handleSubirInforme(e, cliente)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Subir Informe
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {clienteSeleccionado && (
        <SubirInformeDialog
          open={showInformeDialog}
          onClose={() => {
            setShowInformeDialog(false);
            setClienteSeleccionado(null);
          }}
          cliente={clienteSeleccionado}
          user={user}
        />
      )}
    </div>
  );
}