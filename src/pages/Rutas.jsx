import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Route, Trash2, Calendar, User, ExternalLink } from "lucide-react";
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

export default function Rutas() {
  const [user, setUser] = useState(null);
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

  const { data: rutasGuardadas = [] } = useQuery({
    queryKey: ['rutas'],
    queryFn: async () => {
      const todasRutas = await base44.entities.Ruta.list('-created_date');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hoy = today.toISOString().split('T')[0];
      
      const rutasHoy = [];
      const rutasAntiguasPromises = [];

      todasRutas.forEach(ruta => {
        const rutaDate = new Date(ruta.fecha);
        rutaDate.setHours(0, 0, 0, 0);
        const rutaFechaString = rutaDate.toISOString().split('T')[0];

        if (rutaFechaString === hoy) {
          rutasHoy.push(ruta);
        } else {
          rutasAntiguasPromises.push(base44.entities.Ruta.delete(ruta.id));
        }
      });
      
      await Promise.all(rutasAntiguasPromises);
      
      return rutasHoy;
    },
    staleTime: 5 * 60 * 1000,
  });

  const deleteRutaMutation = useMutation({
    mutationFn: (id) => base44.entities.Ruta.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rutas']);
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

  const handleEliminarRuta = (ruta, e) => {
    e.stopPropagation();
    if (window.confirm(`¿Estás seguro de que quieres eliminar la ruta "${ruta.titulo || 'Sin título'}"?`)) {
      deleteRutaMutation.mutate(ruta.id);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <Route className="w-8 h-8" />
          Rutas de Hoy
        </h1>
        <p className="text-[#666666]">
          Visualiza y gestiona las rutas planificadas para hoy
        </p>
      </div>

      {rutasGuardadas.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <Route className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-[#666666] text-lg mb-4">
              No hay rutas planificadas para hoy
            </p>
            <p className="text-gray-400 text-sm">
              Ve al Planificador de Rutas IA para crear rutas optimizadas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rutasGuardadas.map((ruta) => {
            const esMiRuta = ruta.comercial_email === user?.email;
            const puedoEliminar = esMiRuta || isAdmin;
            
            return (
              <Card 
                key={ruta.id} 
                className="border-2 border-[#004D9D] hover:shadow-xl transition-all cursor-pointer"
                onClick={() => handleVerRuta(ruta)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-[#004D9D] flex-shrink-0" />
                        <span className="text-sm font-bold text-[#004D9D] truncate">
                          {ruta.comercial_nombre || ruta.comercial_iniciales}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {ruta.pueblos?.slice(0, 3).join(', ')}
                        {ruta.pueblos?.length > 3 && ` +${ruta.pueblos.length - 3} más`}
                      </p>
                    </div>
                    {puedoEliminar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleEliminarRuta(ruta, e)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">⏱️ Tiempo:</span>
                      <p className="font-semibold">{ruta.tiempo_estimado || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">🚗 Distancia:</span>
                      <p className="font-semibold">{ruta.distancia_estimada || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">👥 Clientes:</span>
                      <p className="font-semibold">{ruta.num_clientes || 0}</p>
                    </div>
                    <div>
                      <Badge className={
                        ruta.prioridad === "ALTA" ? "bg-red-600" :
                        ruta.prioridad === "MEDIA" ? "bg-orange-600" : "bg-blue-600"
                      }>
                        {ruta.prioridad}
                      </Badge>
                    </div>
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
      )}

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
                  📍 Pueblos a visitar:
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