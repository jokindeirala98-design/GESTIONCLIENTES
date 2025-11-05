import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Datos directos de municipios de Navarra
const municipiosNavarra = [
  { nombre: "Pamplona", lat: 42.8125, lng: -1.6458, poblacion: 201653 },
  { nombre: "Tudela", lat: 42.0667, lng: -1.6, poblacion: 35691 },
  { nombre: "Barañáin", lat: 42.8047, lng: -1.6756, poblacion: 19869 },
  { nombre: "Burlada", lat: 42.8289, lng: -1.6086, poblacion: 18847 },
  { nombre: "Zizur Mayor", lat: 42.7833, lng: -1.6833, poblacion: 14926 },
  { nombre: "Villava", lat: 42.8381, lng: -1.6156, poblacion: 10753 },
  { nombre: "Ansoáin", lat: 42.8236, lng: -1.6542, poblacion: 10539 },
  { nombre: "Estella-Lizarra", lat: 42.6717, lng: -2.0264, poblacion: 13892 },
  { nombre: "Tafalla", lat: 42.5292, lng: -1.6764, poblacion: 10670 },
  { nombre: "Berriozar", lat: 42.8358, lng: -1.6681, poblacion: 10106 },
  { nombre: "Huarte", lat: 42.8192, lng: -1.6014, poblacion: 7439 },
  { nombre: "Valle de Egüés", lat: 42.8156, lng: -1.6506, poblacion: 7301 },
  { nombre: "Noáin", lat: 42.7697, lng: -1.6167, poblacion: 7979 },
  { nombre: "Orkoien", lat: 42.8139, lng: -1.6875, poblacion: 3998 },
  { nombre: "Alsasua", lat: 42.9022, lng: -2.1711, poblacion: 7137 },
];

const centroNavarra = { lat: 42.6954, lng: -1.6761, zoom: 9 };

// Componente para centrar el mapa cuando cambia la zona seleccionada
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 12, { animate: true });
    }
  }, [center, zoom, map]);
  
  return null;
}

export default function Rutas() {
  const [user, setUser] = useState(null);
  const [municipioSeleccionado, setMunicipioSeleccionado] = useState(null);
  const [municipiosRuta, setMunicipiosRuta] = useState([]);
  const [mostrandoRuta, setMostrandoRuta] = useState(false);
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

  // Agrupar clientes por municipio (zona.nombre)
  const clientesPorMunicipio = useMemo(() => {
    const agrupacion = {};
    
    clientes.forEach(cliente => {
      const zona = zonas.find(z => z.id === cliente.zona_id);
      if (!zona) return;
      
      const municipio = zona.nombre;
      if (!agrupacion[municipio]) {
        agrupacion[municipio] = [];
      }
      agrupacion[municipio].push(cliente);
    });
    
    return agrupacion;
  }, [clientes, zonas]);

  // Calcular estado de cada municipio según la lógica especificada
  const getEstadoMunicipio = (clientesMunicipio) => {
    if (!clientesMunicipio || clientesMunicipio.length === 0) {
      return "blanco";
    }

    const total = clientesMunicipio.length;
    const informesListos = clientesMunicipio.filter(c => c.estado === "Informe listo").length;
    const firmadosRechazados = clientesMunicipio.filter(
      c => c.estado === "Firmado con éxito" || c.estado === "Rechazado"
    ).length;
    
    if (informesListos / total > 0.7) {
      return "verde";
    }
    
    if (firmadosRechazados / total > 0.5) {
      return "rojo";
    }
    
    const enProceso = clientesMunicipio.filter(
      c => c.estado === "Primer contacto" || 
           c.estado === "Esperando facturas" || 
           c.estado === "Facturas presentadas"
    ).length;
    
    if (enProceso > 0) {
      return "amarillo";
    }
    
    return "blanco";
  };

  const coloresEstado = {
    verde: "#2ECC71",
    amarillo: "#F1C40F",
    blanco: "#CCCCCC",
    rojo: "#E74C3C"
  };

  const municipiosConDatos = municipiosNavarra.map(muni => {
    const clientesMuni = clientesPorMunicipio[muni.nombre] || [];
    const estado = getEstadoMunicipio(clientesMuni);
    
    return {
      ...muni,
      clientes: clientesMuni,
      estado,
      color: coloresEstado[estado]
    };
  });

  const handleClickMunicipio = (municipio) => {
    setMunicipioSeleccionado(municipio);
    setMostrandoRuta(false);
    setMunicipiosRuta([]);
    setCentroMapa([municipio.lat, municipio.lng]);
    setZoomMapa(12);
  };

  const toggleMunicipioRuta = (municipio) => {
    if (municipiosRuta.find(m => m.nombre === municipio.nombre)) {
      setMunicipiosRuta(municipiosRuta.filter(m => m.nombre !== municipio.nombre));
    } else {
      setMunicipiosRuta([...municipiosRuta, municipio]);
    }
  };

  const calcularRutaOptima = () => {
    if (municipiosRuta.length === 0) return;
    
    const origen = { lat: 42.8156, lng: -1.6506 };
    
    const rutaOrdenada = [...municipiosRuta].sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.lat - origen.lat, 2) + Math.pow(a.lng - origen.lng, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.lat - origen.lat, 2) + Math.pow(b.lng - origen.lng, 2)
      );
      return distA - distB;
    });
    
    setMunicipiosRuta(rutaOrdenada);
    setMostrandoRuta(true);
  };

  const municipiosConClientes = municipiosConDatos.filter(m => m.clientes.length > 0);

  const coordenadasRuta = mostrandoRuta && municipiosRuta.length > 0
    ? [
        [42.8156, -1.6506],
        ...municipiosRuta.map(m => [m.lat, m.lng])
      ]
    : [];

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
    <div className="p-4 md:p-8 max-w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <MapPin className="w-8 h-8" />
          Planificación de Rutas
        </h1>
        <p className="text-[#666666]">
          Visualiza clientes en el mapa y planifica tus visitas
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
              <CardTitle className="text-white">Mapa de Navarra</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div style={{ height: "600px", width: "100%" }}>
                <MapContainer
                  center={centroMapa}
                  zoom={zoomMapa}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  <MapController center={centroMapa} zoom={zoomMapa} />
                  
                  <CircleMarker
                    center={[42.8156, -1.6506]}
                    radius={10}
                    pathOptions={{ color: "#004D9D", fillColor: "#004D9D", fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <strong>📍 Oficinas Voltis</strong>
                      <br />
                      Parque Empresarial Ansoáin
                    </Popup>
                  </CircleMarker>
                  
                  {municipiosConDatos.map((municipio, idx) => (
                    <CircleMarker
                      key={idx}
                      center={[municipio.lat, municipio.lng]}
                      radius={municipio.clientes.length > 0 ? 8 : 5}
                      pathOptions={{
                        color: municipio.color,
                        fillColor: municipio.color,
                        fillOpacity: 0.7,
                        weight: 2
                      }}
                      eventHandlers={{
                        click: () => handleClickMunicipio(municipio)
                      }}
                    >
                      <Popup>
                        <div className="text-center">
                          <strong>{municipio.nombre}</strong>
                          <br />
                          {municipio.clientes.length > 0 ? (
                            <>
                              <Badge className="mt-2" style={{ backgroundColor: municipio.color }}>
                                {municipio.clientes.length} cliente(s)
                              </Badge>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">Sin clientes</span>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                  
                  {mostrandoRuta && coordenadasRuta.length > 0 && (
                    <Polyline
                      positions={coordenadasRuta}
                      pathOptions={{ color: "#1F78B4", weight: 4, dashArray: "10, 10" }}
                    />
                  )}
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4 border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: coloresEstado.verde }} />
                  <span className="text-sm text-[#666666]">🟢 Pendientes de firmar (más del 70% informe listo)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: coloresEstado.amarillo }} />
                  <span className="text-sm text-[#666666]">🟡 Facturas recogidas (en proceso)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: coloresEstado.blanco }} />
                  <span className="text-sm text-[#666666]">⚪ Por visitar (sin clientes)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: coloresEstado.rojo }} />
                  <span className="text-sm text-[#666666]">🔴 Cerrado (más del 50% finalizados)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-green-500 to-green-600">
              <CardTitle className="text-white flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Planificar Ruta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <p className="text-sm text-[#666666]">
                  Selecciona los municipios que quieres visitar:
                </p>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {municipiosConClientes.map((municipio) => (
                    <div
                      key={municipio.nombre}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={municipiosRuta.some(m => m.nombre === municipio.nombre)}
                        onCheckedChange={() => toggleMunicipioRuta(municipio)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: municipio.color }}
                          />
                          <span className="text-sm font-medium">{municipio.nombre}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {municipio.clientes.length} cliente(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={calcularRutaOptima}
                  disabled={municipiosRuta.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Calcular Ruta Óptima ({municipiosRuta.length})
                </Button>

                {mostrandoRuta && municipiosRuta.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-green-700 mb-2">
                      📍 Ruta sugerida:
                    </p>
                    <ol className="text-xs space-y-1 text-green-600">
                      <li>0. Oficinas Voltis (Ansoáin)</li>
                      {municipiosRuta.map((m, idx) => (
                        <li key={idx}>{idx + 1}. {m.nombre}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {municipioSeleccionado && (
            <Card className="border-none shadow-md">
              <CardHeader className="border-b bg-gradient-to-r from-purple-500 to-purple-600">
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {municipioSeleccionado.nombre}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#666666]">Total clientes:</span>
                    <Badge>{municipioSeleccionado.clientes.length}</Badge>
                  </div>

                  {municipioSeleccionado.clientes.length > 0 ? (
                    <>
                      <div className="pt-3 border-t space-y-2">
                        <p className="text-xs font-semibold text-[#666666]">Clientes:</p>
                        {municipioSeleccionado.clientes.map((cliente) => {
                          const canView = isAdmin || cliente.propietario_email === user.email;
                          return (
                            <div
                              key={cliente.id}
                              className="p-2 bg-gray-50 rounded text-xs"
                            >
                              <div className="font-medium text-[#004D9D]">
                                {canView ? cliente.nombre_negocio : `Cliente de ${cliente.propietario_iniciales}`}
                              </div>
                              <div className="text-gray-500 flex items-center gap-1 mt-1">
                                {cliente.estado === "Informe listo" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                {cliente.estado === "Rechazado" && <AlertCircle className="w-3 h-3 text-red-600" />}
                                <span>{cliente.estado}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay clientes en este municipio
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}