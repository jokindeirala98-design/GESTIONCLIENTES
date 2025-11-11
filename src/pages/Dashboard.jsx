
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, CheckCircle2, FileText, TrendingUp, Clock } from "lucide-react";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list('-created_date'),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  if (!user) return null;

  const isAdmin = user.role === "admin";
  
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user.email);

  const clientesPorEstado = {
    primerContacto: misClientes.filter(c => c.estado === "Primer contacto").length,
    esperandoFacturas: misClientes.filter(c => c.estado === "Esperando facturas").length,
    facturasPresent: misClientes.filter(c => c.estado === "Facturas presentadas").length,
    informeListo: misClientes.filter(c => c.estado === "Informe listo").length,
    pendienteFirma: misClientes.filter(c => c.estado === "Pendiente de firma").length,
    pendienteAprobacion: misClientes.filter(c => c.estado === "Pendiente de aprobación").length,
    firmados: misClientes.filter(c => c.estado === "Firmado con éxito").length,
    rechazados: misClientes.filter(c => c.estado === "Rechazado").length,
  };

  const statsCards = [
    {
      title: "Zonas Activas",
      value: zonas.length,
      icon: MapPin,
      color: "from-[#004D9D] to-[#00AEEF]",
      link: createPageUrl("Zonas"),
    },
    {
      title: isAdmin ? "Total Clientes" : "Mis Clientes",
      value: misClientes.length,
      icon: Users,
      color: "from-[#00AEEF] to-[#004D9D]",
      link: createPageUrl("Clientes"),
    },
    {
      title: "Facturas Presentadas",
      value: clientesPorEstado.facturasPresent,
      icon: FileText,
      color: "from-blue-500 to-blue-600",
      link: isAdmin ? createPageUrl("InformesPorPresentar") : createPageUrl("ReadyToGo"),
    },
    {
      title: "Firmado con Éxito",
      value: clientesPorEstado.firmados,
      icon: CheckCircle2,
      color: "from-green-500 to-green-600",
      link: isAdmin ? createPageUrl("CierresVerificados") : createPageUrl("Clientes"),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2">
          Bienvenido, {user.full_name}
        </h1>
        <p className="text-[#666666]">
          {isAdmin ? 'Panel de administración' : 'Tu panel de gestión'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsCards.map((stat) => (
          <Link key={stat.title} to={stat.link}>
            <Card className="hover:shadow-lg transition-all duration-300 border-none h-full cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-[#004D9D] mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-[#666666] font-medium">
                  {stat.title}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
            <CardTitle className="text-white text-lg">Estado de Clientes</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[
                { label: "Primer contacto", value: clientesPorEstado.primerContacto, color: "bg-gray-400" },
                { label: "Esperando facturas", value: clientesPorEstado.esperandoFacturas, color: "bg-orange-500" },
                { label: "Facturas presentadas", value: clientesPorEstado.facturasPresent, color: "bg-blue-500" },
                { label: "Informe listo", value: clientesPorEstado.informeListo, color: "bg-green-500" },
                { label: "Pendiente de firma", value: clientesPorEstado.pendienteFirma, color: "bg-purple-500" },
                { label: "Pendiente de aprobación", value: clientesPorEstado.pendienteAprobacion, color: "bg-yellow-600" },
                { label: "Firmado con éxito", value: clientesPorEstado.firmados, color: "bg-green-700" },
                { label: "Rechazado", value: clientesPorEstado.rechazados, color: "bg-red-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm text-[#666666]">{item.label}</span>
                  </div>
                  <span className="font-semibold text-[#004D9D]">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#00AEEF] to-[#004D9D]">
            <CardTitle className="text-white text-lg">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Link to={createPageUrl("Zonas")}>
                <div className="p-4 rounded-lg border-2 border-gray-200 hover:border-[#004D9D] hover:bg-blue-50 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-[#004D9D] group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="font-medium text-[#004D9D]">Gestionar Zonas</p>
                      <p className="text-xs text-[#666666]">Crear y organizar zonas</p>
                    </div>
                  </div>
                </div>
              </Link>
              
              <Link to={createPageUrl("Clientes")}>
                <div className="p-4 rounded-lg border-2 border-gray-200 hover:border-[#004D9D] hover:bg-blue-50 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-[#004D9D] group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="font-medium text-[#004D9D]">Ver Clientes</p>
                      <p className="text-xs text-[#666666]">Gestionar tu cartera</p>
                    </div>
                  </div>
                </div>
              </Link>

              {!isAdmin && (
                <Link to={createPageUrl("ReadyToGo")}>
                  <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:border-green-500 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="font-medium text-green-700">Ready to Go</p>
                        <p className="text-xs text-green-600">Clientes listos para cerrar</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {isAdmin && (
                <>
                  <Link to={createPageUrl("InformesPorPresentar")}>
                    <div className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50 hover:border-purple-500 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="font-medium text-purple-700">Informes por Presentar</p>
                          <p className="text-xs text-purple-600">Subir informes finales</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <Link to={createPageUrl("CierresVerificados")}>
                    <div className="p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50 hover:border-yellow-500 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-yellow-600 group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="font-medium text-yellow-700">Cierres Verificados</p>
                          <p className="text-xs text-yellow-600">Aprobar o rechazar cierres</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
