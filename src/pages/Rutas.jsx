
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, X, TrendingUp, AlertCircle, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lista completa de municipios de Navarra (principales)
export const MUNICIPIOS_NAVARRA = [
  { nombre: "Pamplona", lat: 42.8125, lng: -1.6458 },
  { nombre: "Tudela", lat: 42.0667, lng: -1.6 },
  { nombre: "Barañáin", lat: 42.8047, lng: -1.6756 },
  { nombre: "Burlada", lat: 42.8289, lng: -1.6086 },
  { nombre: "Zizur Mayor", lat: 42.7833, lng: -1.6833 },
  { nombre: "Villava", lat: 42.8381, lng: -1.6156 },
  { nombre: "Ansoáin", lat: 42.8236, lng: -1.6542 },
  { nombre: "Estella-Lizarra", lat: 42.6717, lng: -2.0264 },
  { nombre: "Tafalla", lat: 42.5292, lng: -1.6764 },
  { nombre: "Berriozar", lat: 42.8358, lng: -1.6681 },
  { nombre: "Huarte", lat: 42.8192, lng: -1.6014 },
  { nombre: "Valle de Egüés", lat: 42.8156, lng: -1.6506 },
  { nombre: "Noáin", lat: 42.7697, lng: -1.6167 },
  { nombre: "Orkoien", lat: 42.8139, lng: -1.6875 },
  { nombre: "Alsasua", lat: 42.9022, lng: -2.1711 },
  { nombre: "Sangüesa", lat: 42.5753, lng: -1.2817 },
  { nombre: "Peralta", lat: 42.3469, lng: -1.8158 },
  { nombre: "Irurtzun", lat: 42.9103, lng: -1.8167 },
  { nombre: "Puente la Reina", lat: 42.6719, lng: -1.8128 },
  { nombre: "Lodosa", lat: 42.4167, lng: -2.0833 },
  { nombre: "Corella", lat: 42.1167, lng: -1.7833 },
  { nombre: "Villafranca", lat: 42.6667, lng: -1.95 },
  { nombre: "Aoiz", lat: 42.7878, lng: -1.3578 },
  { nombre: "Cintruénigo", lat: 42.0531, lng: -1.7853 },
  { nombre: "Vera de Bidasoa", lat: 43.2547, lng: -1.6583 },
  { nombre: "Cascante", lat: 41.9833, lng: -1.6833 },
  { nombre: "Andosilla", lat: 42.3833, lng: -1.9667 },
  { nombre: "Beriáin", lat: 42.7167, lng: -1.6333 },
  { nombre: "Falces", lat: 42.3831, lng: -1.7972 },
  { nombre: "Caparroso", lat: 42.3397, lng: -1.6569 },
  { nombre: "Lesaka", lat: 43.2369, lng: -1.6917 },
  { nombre: "Viana", lat: 42.5167, lng: -2.3667 },
  { nombre: "Mendavia", lat: 42.4833, lng: -2.2167 },
  { nombre: "Lekunberri", lat: 43.0167, lng: -1.85 },
  { nombre: "Olite", lat: 42.4833, lng: -1.65 },
  { nombre: "Castejón", lat: 42.1833, lng: -1.6833 },
  { nombre: "Funes", lat: 42.3833, lng: -1.75 },
  { nombre: "Fitero", lat: 42.0583, lng: -1.8667 },
  { nombre: "Marcilla", lat: 42.3333, lng: -1.7 },
  { nombre: "Mélida", lat: 42.3667, lng: -1.5833 }, // Corrected: removed duplicate 'lng'
  { nombre: "Baztan", lat: 43.1167, lng: -1.5 },
  { nombre: "Cadreita", lat: 42.2, lng: -1.6333 },
  { nombre: "Carcastillo", lat: 42.3667, lng: -1.5167 },
  { nombre: "Fontellas", lat: 42.0333, lng: -1.5833 },
  { nombre: "Los Arcos", lat: 42.5667, lng: -2.1833 },
  { nombre: "Larraga", lat: 42.5667, lng: -1.8333 },
  { nombre: "Milagro", lat: 42.25, lng: -1.75 },
  { nombre: "Murillo el Fruto", lat: 42.2667, lng: -1.6 },
  { nombre: "Ribaforada", lat: 42.0667, lng: -1.5 },
  { nombre: "Santacara", lat: 42.4, lng: -1.55 },
  { nombre: "Sesma", lat: 42.5333, lng: -2.0833 },
  { nombre: "Urdax", lat: 43.2333, lng: -1.4667 },
  { nombre: "Valtierra", lat: 42.2333, lng: -1.6 },
];

const centroNavarra = { lat: 42.6954, lng: -1.6761, zoom: 9 };

function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  
  return null;
}

export default function Rutas() {
  const [user, setUser] = useState(null);
  const [puebloSeleccionado, setPuebloSeleccionado] = useState(null);
  const [centroMapa, setCentroMapa] = useState([centroNavarra.lat, centroNavarra.lng]);
  const [zoomMapa, setZoomMapa] = useState(centroNavarra.zoom);

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

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
  });

  const isAdmin = user?.role === "admin";

  // Agrupar clientes por pueblo (zona.nombre)
  const clientesPorPueblo = useMemo(() => {
    const agrupacion = {};
    
    clientes.forEach(cliente => {
      const zona = zonas.find(z => z.id === cliente.zona_id);
      if (!zona) return;
      
      const pueblo = zona.nombre;
      if (!agrupacion[pueblo]) {
        agrupacion[pueblo] = [];
      }
      agrupacion[pueblo].push(cliente);
    });
    
    return agrupacion;
  }, [clientes, zonas]);

  // Calcular estado de cada pueblo según la lógica especificada
  const getEstadoPueblo = (clientesPueblo) => {
    if (!clientesPueblo || clientesPueblo.length === 0) {
      return "gris";
    }

    const total = clientesPueblo.length;
    const informesListos = clientesPueblo.filter(c => c.estado === "Informe listo").length;
    const firmadosRechazados = clientesPueblo.filter(
      c => c.estado === "Firmado con éxito" || c.estado === "Rechazado"
    ).length;
    
    if (informesListos / total > 0.7) {
      return "verde";
    }
    
    if (firmadosRechazados / total > 0.5) {
      return "rojo";
    }
    
    const enProceso = clientesPueblo.filter(
      c => c.estado === "Primer contacto" || 
           c.estado === "Esperando facturas" || 
           c.estado === "Facturas presentadas"
    ).length;
    
    if (enProceso > 0) {
      return "amarillo";
    }
    
    return "gris";
  };

  const coloresEstado = {
    verde: "#10B981",
    amarillo: "#F59E0B",
    gris: "#D1D5DB",
    rojo: "#EF4444"
  };

  const pueblosConDatos = MUNICIPIOS_NAVARRA.map(pueblo => {
    const clientesPueblo = clientesPorPueblo[pueblo.nombre] || [];
    const estado = getEstadoPueblo(clientesPueblo);
    const misClientes = clientesPueblo.filter(c => c.propietario_email === user?.email);
    
    return {
      ...pueblo,
      clientes: clientesPueblo,
      misClientes: misClientes.length,
      estado,
      color: coloresEstado[estado]
    };
  });

  const handleClickPueblo = (pueblo) => {
    setPuebloSeleccionado(pueblo);
    setCentroMapa([pueblo.lat, pueblo.lng]);
    setZoomMapa(13);
  };

  const cerrarPanel = () => {
    setPuebloSeleccionado(null);
    setCentroMapa([centroNavarra.lat, centroNavarra.lng]);
    setZoomMapa(centroNavarra.zoom);
  };

  // Calcular radio del círculo según número de clientes
  const getRadio = (numClientes) => {
    if (numClientes === 0) return 4;
    if (numClientes <= 2) return 6;
    if (numClientes <= 5) return 8;
    if (numClientes <= 10) return 11;
    return 14;
  };

  // Estadísticas por estado en el pueblo seleccionado
  const getEstadisticasPueblo = (pueblo) => {
    const clientesPueblo = pueblo.clientes;
    return {
      total: clientesPueblo.length,
      primerContacto: clientesPueblo.filter(c => c.estado === "Primer contacto").length,
      esperandoFacturas: clientesPueblo.filter(c => c.estado === "Esperando facturas").length,
      facturasPresent: clientesPueblo.filter(c => c.estado === "Facturas presentadas").length,
      informeListo: clientesPueblo.filter(c => c.estado === "Informe listo").length,
      pendienteFirma: clientesPueblo.filter(c => c.estado === "Pendiente de firma").length,
      firmados: clientesPueblo.filter(c => c.estado === "Firmado con éxito").length,
      rechazados: clientesPueblo.filter(c => c.estado === "Rechazado").length,
    };
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Mapa */}
      <MapContainer
        center={centroMapa}
        zoom={zoomMapa}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        {/* Tile layer minimalista - CartoDB Positron (sin relieves, ríos, etc.) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapController center={centroMapa} zoom={zoomMapa} />
        
        {/* Oficinas Voltis */}
        <CircleMarker
          center={[42.8156, -1.6506]}
          radius={12}
          pathOptions={{ 
            color: "#004D9D", 
            fillColor: "#004D9D", 
            fillOpacity: 1,
            weight: 3
          }}
        >
          <Popup>
            <div className="text-center font-semibold">
              📍 Oficinas Voltis
              <br />
              <span className="text-xs">Parque Empresarial Ansoáin</span>
            </div>
          </Popup>
        </CircleMarker>
        
        {/* Pueblos */}
        {pueblosConDatos.map((pueblo, idx) => (
          <CircleMarker
            key={idx}
            center={[pueblo.lat, pueblo.lng]}
            radius={getRadio(pueblo.clientes.length)}
            pathOptions={{
              color: pueblo.color,
              fillColor: pueblo.color,
              fillOpacity: 0.8,
              weight: 2
            }}
            eventHandlers={{
              click: () => handleClickPueblo(pueblo)
            }}
          >
            <Popup>
              <div className="text-center">
                <strong className="text-sm">{pueblo.nombre}</strong>
                <br />
                {pueblo.clientes.length > 0 && (
                  <span className="text-xs text-gray-600">
                    {pueblo.clientes.length} cliente(s)
                  </span>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Leyenda flotante */}
      <Card className="absolute top-4 left-4 z-[1000] shadow-xl border-2 hidden md:block">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coloresEstado.verde }} />
            <span className="text-xs text-[#666666]">🟢 Ready (>70% informe listo)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coloresEstado.amarillo }} />
            <span className="text-xs text-[#666666]">🟡 En proceso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coloresEstado.gris }} />
            <span className="text-xs text-[#666666]">⚪ Sin clientes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coloresEstado.rojo }} />
            <span className="text-xs text-[#666666]">🔴 Cerrado (>50%)</span>
          </div>
        </CardContent>
      </Card>

      {/* Panel lateral flotante */}
      {puebloSeleccionado && (
        <>
          {/* Overlay para cerrar en móvil */}
          <div 
            className="fixed inset-0 bg-black/50 z-[999] md:hidden"
            onClick={cerrarPanel}
          />
          
          <Card className={`
            fixed z-[1000] shadow-2xl border-2 overflow-auto
            md:top-4 md:right-4 md:bottom-4 md:w-[400px]
            bottom-0 left-0 right-0 max-h-[80vh] rounded-t-3xl md:rounded-2xl
          `}>
            <CardHeader className="border-b bg-gradient-to-r from-[#004D9D] to-[#00AEEF] sticky top-0 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {puebloSeleccionado.nombre}
                  </CardTitle>
                  <Badge 
                    className="mt-2"
                    style={{ backgroundColor: puebloSeleccionado.color }}
                  >
                    {puebloSeleccionado.estado.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cerrarPanel}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Resumen de clientes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-600">
                    {puebloSeleccionado.clientes.length}
                  </p>
                  <p className="text-xs text-blue-700">Total clientes</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-600">
                    {puebloSeleccionado.misClientes}
                  </p>
                  <p className="text-xs text-green-700">Mis clientes</p>
                </div>
              </div>

              {/* Estadísticas por estado */}
              {puebloSeleccionado.clientes.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-[#004D9D] mb-3 text-sm">
                    📊 Estados
                  </h3>
                  <div className="space-y-2">
                    {(() => {
                      const stats = getEstadisticasPueblo(puebloSeleccionado);
                      return [
                        { label: "Primer contacto", value: stats.primerContacto, color: "bg-gray-400" },
                        { label: "Esperando facturas", value: stats.esperandoFacturas, color: "bg-orange-500" },
                        { label: "Facturas presentadas", value: stats.facturasPresent, color: "bg-blue-500" },
                        { label: "Informe listo", value: stats.informeListo, color: "bg-green-500" },
                        { label: "Pendiente de firma", value: stats.pendienteFirma, color: "bg-purple-500" },
                        { label: "Firmado con éxito", value: stats.firmados, color: "bg-yellow-600" },
                        { label: "Rechazado", value: stats.rechazados, color: "bg-red-500" },
                      ].map((item) => item.value > 0 && (
                        <div key={item.label} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                            <span className="text-gray-600">{item.label}</span>
                          </div>
                          <span className="font-semibold text-[#004D9D]">{item.value}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Lista de clientes */}
              {puebloSeleccionado.clientes.length > 0 ? (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-[#004D9D] mb-3 text-sm">
                    👥 Clientes en este pueblo
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {puebloSeleccionado.clientes.map((cliente) => {
                      const esMio = cliente.propietario_email === user.email;
                      const puedoVer = esMio || isAdmin;
                      
                      return (
                        <div
                          key={cliente.id}
                          className={`p-3 rounded-lg text-xs ${
                            esMio ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#004D9D] truncate">
                                {puedoVer ? cliente.nombre_negocio : `Cliente de ${cliente.propietario_iniciales}`}
                              </p>
                              <p className="text-gray-600 mt-1 flex items-center gap-1">
                                {cliente.estado === "Informe listo" && <FileCheck className="w-3 h-3 text-green-600" />}
                                {cliente.estado === "Rechazado" && <AlertCircle className="w-3 h-3 text-red-600" />}
                                {cliente.estado}
                              </p>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00AEEF] to-[#004D9D] flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-bold text-[10px]">
                                {cliente.propietario_iniciales}
                              </span>
                            </div>
                          </div>
                          {esMio && (
                            <Badge className="mt-2 text-[10px] bg-green-600">
                              Tu cliente
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin clientes en este pueblo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
