
import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, X, TrendingUp, AlertCircle, FileCheck, ExternalLink, Route, Trash2, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  { nombre: "Mélida", lat: 42.3667, lng: -1.5833 },
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
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);
  const [showRutaDialog, setShowRutaDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackRuta, setFeedbackRuta] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");

  const queryClient = useQueryClient();

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

  const { data: rutasGuardadas = [] } = useQuery({
    queryKey: ['rutas'],
    queryFn: async () => {
      const todasRutas = await base44.entities.Ruta.list('-created_date');
      
      // Get today's date in YYYY-MM-DD format for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      const hoy = today.toISOString().split('T')[0]; // e.g., "2023-10-27"
      
      const rutasHoy = [];
      const rutasAntiguasPromises = [];

      todasRutas.forEach(ruta => {
        // Assuming ruta.fecha is stored in a format New Date() can parse, e.g., ISO string or "YYYY-MM-DD"
        const rutaDate = new Date(ruta.fecha);
        rutaDate.setHours(0, 0, 0, 0); // Normalize to start of day
        const rutaFechaString = rutaDate.toISOString().split('T')[0];

        if (rutaFechaString === hoy) {
          rutasHoy.push(ruta);
        } else {
          rutasAntiguasPromises.push(base44.entities.Ruta.delete(ruta.id));
        }
      });
      
      // Await all deletions. This cleans up old routes.
      // This operation should not automatically invalidate the 'rutas' query itself if implemented correctly.
      await Promise.all(rutasAntiguasPromises);
      
      return rutasHoy;
    },
    // Adding staleTime to prevent unnecessary re-fetches if not invalidated by manual deletion
    // and to ensure cleanup only runs when data is truly stale.
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteRutaMutation = useMutation({
    mutationFn: (id) => base44.entities.Ruta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rutas']); // Invalidate to re-fetch today's routes (and re-run cleanup logic if necessary)
      toast.success("Ruta eliminada");
    },
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: ({ id, feedback }) => base44.entities.Ruta.update(id, { feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries(['rutas']);
      toast.success("Feedback guardado");
      setShowFeedbackDialog(false);
      setFeedbackRuta(null);
      setFeedbackText("");
    },
  });

  const exportToGoogleMaps = (pueblos) => {
    if (!pueblos || pueblos.length === 0) return;
    
    // Assuming a fixed origin and destination for simplicity in this context.
    // In a real application, these might be dynamically determined.
    const origin = "Ansoáin, Navarra"; 
    const destination = "Pamplona, Navarra"; 
    const waypoints = pueblos.map(p => `${p}, Navarra`).join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    
    window.open(url, '_blank');
    toast.success("Ruta abierta en Google Maps");
  };

  const handleVerRuta = (ruta) => {
    setRutaSeleccionada(ruta);
    setShowRutaDialog(true);
  };

  const handleOpenFeedback = (ruta) => {
    setFeedbackRuta(ruta);
    setFeedbackText(ruta.feedback || "");
    setShowFeedbackDialog(true);
  };

  const handleSaveFeedback = () => {
    if (!feedbackText.trim()) {
      toast.error("Escribe tu feedback");
      return;
    }
    updateFeedbackMutation.mutate({ id: feedbackRuta.id, feedback: feedbackText });
  };

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Rutas Guardadas - Barra superior */}
      {rutasGuardadas.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4 overflow-x-auto">
          <div className="flex items-center gap-3 min-w-max">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Route className="w-5 h-5 text-[#004D9D]" />
              <h3 className="font-bold text-[#004D9D]">Rutas de Hoy:</h3>
            </div>
            {rutasGuardadas.map((ruta) => {
              const esMiRuta = ruta.comercial_email === user?.email;
              return (
                <Card 
                  key={ruta.id} 
                  className="flex-shrink-0 w-64 border-2 border-[#004D9D] cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleVerRuta(ruta)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-[#004D9D] flex-shrink-0" />
                          <span className="text-sm font-bold text-[#004D9D] truncate">
                            {ruta.comercial_nombre || ruta.comercial_iniciales}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {ruta.pueblos?.slice(0, 3).join(', ')}
                          {ruta.pueblos?.length > 3 && '...'}
                        </p>
                      </div>
                      {esMiRuta && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de que quieres eliminar esta ruta?')) {
                              deleteRutaMutation.mutate(ruta.id);
                            }
                          }}
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-gray-500">Clientes:</span>
                        <span className="font-semibold ml-1">{ruta.num_clientes || 0}</span>
                      </div>
                      <Badge className={
                        ruta.prioridad === "ALTA" ? "bg-red-600" :
                        ruta.prioridad === "MEDIA" ? "bg-orange-600" : "bg-blue-600"
                      }>
                        {ruta.prioridad}
                      </Badge>
                    </div>

                    {esMiRuta && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFeedback(ruta);
                        }}
                        className="w-full text-xs"
                      >
                        {ruta.feedback ? "Ver/Editar Feedback" : "Dar Feedback"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Mapa */}
      <div className="relative flex-1">
        <div className="absolute inset-0">
          <MapContainer
            center={centroMapa}
            zoom={zoomMapa}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
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
        </div>

        {/* Leyenda flotante */}
        <Card className="absolute top-4 left-4 z-[1000] shadow-xl border-2 hidden md:block bg-white">
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
            
            <Card className="fixed z-[1000] shadow-2xl border-2 overflow-auto bg-white md:top-4 md:right-4 md:bottom-4 md:w-[400px] bottom-0 left-0 right-0 max-h-[80vh] rounded-t-3xl md:rounded-2xl">
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

      {/* Dialog de Detalles de Ruta */}
      <Dialog open={showRutaDialog} onOpenChange={setShowRutaDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D] text-xl flex items-center gap-2">
              <Route className="w-6 h-6" />
              Ruta de {rutaSeleccionada?.comercial_nombre || rutaSeleccionada?.comercial_iniciales}
            </DialogTitle>
          </DialogHeader>

          {rutaSeleccionada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">📅 Fecha</p>
                  <p className="font-semibold text-sm">{new Date(rutaSeleccionada.fecha).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">⏱️ Tiempo</p>
                  <p className="font-semibold text-sm">{rutaSeleccionada.tiempo_estimado}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">🚗 Distancia</p>
                  <p className="font-semibold text-sm">{rutaSeleccionada.distancia_estimada}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">👥 Clientes</p>
                  <p className="font-semibold text-sm">{rutaSeleccionada.num_clientes || 0}</p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-[#004D9D] mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Pueblos a visitar:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rutaSeleccionada.pueblos?.map((pueblo, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm">
                      {idx + 1}. {pueblo}
                    </Badge>
                  ))}
                </div>
              </div>

              {rutaSeleccionada.descripcion_completa && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-[#004D9D] mb-2">📋 Descripción de la ruta:</h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {rutaSeleccionada.descripcion_completa}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                exportToGoogleMaps(rutaSeleccionada.pueblos);
              }}
              className="bg-[#004D9D] hover:bg-[#00AEEF] w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir en Google Maps
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Feedback */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Feedback de la Ruta</DialogTitle>
            <DialogDescription>
              Comparte cómo fue tu ruta para mejorar futuras planificaciones
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Ej: La ruta fue eficiente, pero el tiempo en Tudela se extendió más de lo esperado por tráfico. Los clientes en Cabanillas fueron muy receptivos..."
            rows={8}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFeedback} className="bg-[#004D9D] hover:bg-[#00AEEF]">
              Guardar Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
