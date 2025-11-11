
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Send, 
  Sparkles, 
  Navigation, 
  Clock, 
  TrendingUp,
  Zap,
  Users,
  MessageSquare,
  Calendar,
  Route,
  ExternalLink,
  CheckCircle2,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function PlanificadorRutas() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [routeToConfirm, setRouteToConfirm] = useState(null);
  const [messageWithRoute, setMessageWithRoute] = useState(null);

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

  useEffect(() => {
    if (user) {
      createConversation();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [conversationId]);

  const saveRouteMutation = useMutation({
    mutationFn: (routeData) => base44.entities.Ruta.create(routeData),
    onSuccess: () => {
      queryClient.invalidateQueries(['rutas']);
      toast.success("✅ Ruta guardada correctamente");
      setShowConfirmDialog(false);
      setRouteToConfirm(null);
      setMessageWithRoute(null);
    },
    onError: () => {
      toast.error("Error al guardar la ruta");
    }
  });

  const createConversation = async () => {
    try {
      const conversation = await base44.agents.createConversation({
        agent_name: "planificador_rutas",
        metadata: {
          name: `Planificación Rutas - ${new Date().toLocaleDateString()}`,
          description: "Conversación para optimización de rutas comerciales",
        }
      });
      setConversationId(conversation.id);
      
      setMessages([{
        role: "assistant",
        content: `¡Hola! 👋 Soy tu asistente de rutas.\n\n🔥 Prioridades: 6.1 > 3.0 > 2.0\n🆕 Sugiero pueblos nuevos si hay tiempo\n\n¿Qué ruta necesitas?`
      }]);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Error al iniciar el asistente");
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      const conversation = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: userMessage
      });
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar mensaje");
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt) => {
    setInputMessage(prompt);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // Función mejorada para extraer nombres de áreas/pueblos
  const extractRouteForExport = (messageContent) => {
    // Buscar todos los nombres después de 📍
    const matches = messageContent.match(/📍\s*([A-Za-záéíóúÁÉÍÓÚñÑ\s\-]+?)(?:\n|$)/g);
    
    if (!matches || matches.length === 0) {
      // Intento alternativo: buscar nombres de zonas conocidas
      const zonasEnMensaje = [];
      zonas.forEach(zona => {
        if (messageContent.includes(zona.nombre)) {
          zonasEnMensaje.push(zona.nombre);
        }
      });
      return zonasEnMensaje.length > 0 ? zonasEnMensaje : null;
    }
    
    const pueblos = matches
      .map(match => {
        // Extraer el nombre después de 📍
        let pueblo = match.replace('📍', '').trim();
        // Tomar solo la primera línea
        pueblo = pueblo.split('\n')[0].trim();
        // Limpiar paréntesis y datos extra
        pueblo = pueblo.split('(')[0].trim();
        pueblo = pueblo.split('-')[0].trim();
        return pueblo;
      })
      .filter(p => p.length > 0 && p.length < 50)
      .filter((value, index, self) => self.indexOf(value) === index); // Eliminar duplicados
    
    return pueblos.length > 0 ? pueblos : null;
  };

  const exportToGoogleMaps = (pueblos) => {
    if (!pueblos || pueblos.length === 0) {
      toast.error("No se pudieron extraer las ubicaciones de la ruta");
      return;
    }
    
    const origin = "Ansoáin, Navarra";
    const destination = "Pamplona, Navarra";
    const waypoints = pueblos.map(p => `${p}, Navarra`).join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    
    window.open(url, '_blank');
    toast.success(`Ruta abierta en Google Maps con ${pueblos.length} parada(s)`);
  };

  const handleOpenInMaps = (message) => {
    const pueblos = extractRouteForExport(message.content);
    if (pueblos && pueblos.length > 0) {
      console.log("Pueblos extraídos para Maps:", pueblos);
      exportToGoogleMaps(pueblos);
    } else {
      toast.error("No se pudieron identificar las ubicaciones en la ruta");
    }
  };

  const handleConfirmRoute = (message) => {
    const pueblos = extractRouteForExport(message.content);
    if (!pueblos || pueblos.length === 0) {
      toast.error("No se pudo extraer la ruta del mensaje");
      return;
    }

    // Extraer información del mensaje
    const timeMatch = message.content.match(/(?:Tiempo|Total).*?:\s*(\d+h?\s*\d*m?i?n?)/i);
    const distanceMatch = message.content.match(/Distancia.*?:\s*([^\n]+)/i);
    const clientesMatch = message.content.match(/Clientes?:\s*(\d+)/i);
    const prioridadMatch = message.content.match(/Prioridad:\s*(ALTA|MEDIA|BAJA)/i);

    setRouteToConfirm({
      pueblos,
      tiempo: timeMatch ? timeMatch[1].trim() : "No especificado",
      distancia: distanceMatch ? distanceMatch[1].trim() : "No especificado",
      numClientes: clientesMatch ? parseInt(clientesMatch[1]) : 0,
      prioridad: prioridadMatch ? prioridadMatch[1] : "MEDIA"
    });
    setMessageWithRoute(message);
    setShowConfirmDialog(true);
  };

  const handleSaveRoute = () => {
    if (!routeToConfirm || !user) return;

    const today = new Date().toISOString().split('T')[0];
    const titulo = `Ruta ${routeToConfirm.pueblos[0] || 'Navarra'} - ${new Date().toLocaleDateString()}`;

    const routeData = {
      titulo,
      fecha: today,
      comercial_email: user.email,
      comercial_iniciales: user.iniciales || user.full_name?.substring(0, 2).toUpperCase(),
      comercial_nombre: user.full_name,
      pueblos: routeToConfirm.pueblos,
      clientes_ids: [],
      descripcion_completa: messageWithRoute?.content || "",
      tiempo_estimado: routeToConfirm.tiempo,
      distancia_estimada: routeToConfirm.distancia,
      num_clientes: routeToConfirm.numClientes,
      prioridad: routeToConfirm.prioridad
    };

    saveRouteMutation.mutate(routeData);
  };

  const handleRejectRoute = () => {
    setShowConfirmDialog(false);
    setRouteToConfirm(null);
    setMessageWithRoute(null);
    toast.info("Puedes pedir otra ruta en el chat");
  };

  // Detectar si un mensaje contiene una ruta planificada (solo cuando tiene emoji 📍)
  const messageHasRoute = (message) => {
    if (!message || !message.content) return false;
    // Solo mostrar botones si el mensaje tiene el emoji 📍 (indica planificación de ruta)
    return message.content.includes('📍');
  };

  const isAdmin = user?.role === "admin";
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user?.email);

  const clientesReadyToGo = misClientes.filter(c => c.estado === "Informe listo");
  const clientes61Ready = clientesReadyToGo.filter(c => {
    if (!c.suministros || c.suministros.length === 0) return false;
    return c.suministros.some(s => s.tipo_factura === "6.1");
  }).length;
  const clientes30Ready = clientesReadyToGo.filter(c => {
    if (!c.suministros || c.suministros.length === 0) return false;
    return c.suministros.some(s => s.tipo_factura === "3.0");
  }).length;
  const clientes20Ready = clientesReadyToGo.filter(c => {
    if (!c.suministros || c.suministros.length === 0) return false;
    return c.suministros.some(s => s.tipo_factura === "2.0");
  }).length;
  
  const zonasExistentes = zonas.map(z => z.nombre.toLowerCase());
  const MUNICIPIOS_GRANDES = [
    "Tudela", "Estella-Lizarra", "Tafalla", "Sangüesa", "Corella", "Cintruénigo",
    "Lodosa", "Peralta", "Castejón", "Olite", "Cascante", "Caparroso", "Falces",
    "Fitero", "Mendavia", "Milagro", "Viana", "Ribaforada", "Marcilla", "Cabanillas",
    "Arguedas", "Ablitas", "Fustiñana", "Buñuel", "Orkoien", "Beriáin", "Mutilva Baja",
    "Carcastillo", "Funes", "Larraga", "Andosilla", "Valtierra", "Cadreita"
  ];
  const pueblosSinTrabajar = MUNICIPIOS_GRANDES.filter(
    m => !zonasExistentes.includes(m.toLowerCase())
  ).length;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando asistente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <Navigation className="w-8 h-8" />
          Planificador de Rutas IA
        </h1>
        <p className="text-[#666666]">
          Optimiza tus visitas + identifica nuevas oportunidades
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="border-none shadow-md bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-red-600" />
              <Badge className="bg-red-600 text-white">6.1</Badge>
            </div>
            <p className="text-2xl font-bold text-red-600">{clientes61Ready}</p>
            <p className="text-xs text-red-700">PRIORIDAD MAX</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <Badge className="bg-orange-600 text-white">3.0</Badge>
            </div>
            <p className="text-2xl font-bold text-orange-600">{clientes30Ready}</p>
            <p className="text-xs text-orange-700">Alta Prioridad</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 text-center">
            <div className="flex items-center gap-2 justify-center mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <Badge className="bg-blue-600 text-white">2.0</Badge>
            </div>
            <p className="text-2xl font-bold text-blue-600">{clientes20Ready}</p>
            <p className="text-xs text-blue-700">Prioridad Media</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{clientesReadyToGo.length}</p>
            <p className="text-xs text-green-700">Total Ready</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <MapPin className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-600">{pueblosSinTrabajar}</p>
            <p className="text-xs text-purple-700">Pueblos nuevos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Panel de Acciones Rápidas */}
        <Card className="border-none shadow-md md:col-span-1">
          <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <Button
              onClick={() => handleQuickAction("Dame la planificación de toda la semana (lunes a viernes). Organiza los días brevemente explicando por qué cada día. Incluye oportunidades de prospección en pueblos sin clientes.")}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white justify-start h-auto py-3"
              disabled={isLoading}
            >
              <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="text-left">
                <div className="font-bold">Planificación de Semana</div>
                <div className="text-xs opacity-90">Lun-Vie + prospección</div>
              </div>
            </Button>

            <Button
              onClick={() => handleQuickAction("Dame la ruta óptima para HOY desde las 8:00 hasta las 14:00 (6 horas). Incluye clientes prioritarios y si hay tiempo, sugiere pueblos para prospectar.")}
              className="w-full bg-green-600 hover:bg-green-700 text-white justify-start h-auto py-3"
              disabled={isLoading}
            >
              <Route className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="text-left">
                <div className="font-bold">Ruta para Hoy</div>
                <div className="text-xs opacity-90">8:00-14:00 automático</div>
              </div>
            </Button>

            <Button
              onClick={() => handleQuickAction("Necesito una ruta express desde ahora mismo hasta las 14:00. ¿Cuánto tiempo tengo disponible y qué ruta me recomiendas?")}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white justify-start h-auto py-3"
              disabled={isLoading}
            >
              <Clock className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="text-left">
                <div className="font-bold">Ruta Express</div>
                <div className="text-xs opacity-90">Desde ahora hasta 14:00</div>
              </div>
            </Button>

            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2 font-semibold">🎯 Sistema de Prioridades:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className="flex items-center gap-2">
                  <Badge className="bg-red-600 text-white text-[10px]">6.1</Badge>
                  <span>Máxima prioridad</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="bg-orange-600 text-white text-[10px]">3.0</Badge>
                  <span>Después de 6.1</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white text-[10px]">2.0</Badge>
                  <span>Prioridad media</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white text-[10px]">🆕</Badge>
                  <span>Prospección (si hay tiempo)</span>
                </li>
              </ul>
              <p className="text-xs text-purple-600 mt-3 p-2 bg-purple-50 rounded">
                💡 <strong>Nuevo:</strong> Te sugiero pueblos cercanos para buscar nuevos clientes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Chat */}
        <Card className="border-none shadow-md md:col-span-2">
          <CardHeader className="bg-gradient-to-r from-[#00AEEF] to-[#004D9D]">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat con el Asistente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-[#004D9D] text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                    
                    {message.tool_calls && message.tool_calls.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {message.tool_calls.map((tool, toolIdx) => (
                          <Badge
                            key={toolIdx}
                            variant="outline"
                            className="text-xs bg-blue-50 text-blue-700"
                          >
                            🔧 {tool.name?.replace('entities.', '').replace('.read', '') || "Consultando datos"}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {message.role === "assistant" && messageHasRoute(message) && (
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConfirmRoute(message)}
                          className="text-xs bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Confirmar Ruta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenInMaps(message)}
                          className="text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Abrir en Maps
                        </Button>
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {user.iniciales || user.full_name?.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Ej: Ruta zona norte evitando Tudela..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-[#004D9D] hover:bg-[#00AEEF]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💬 Añade condiciones: "solo mis clientes", "tengo 3 horas", "incluye prospección"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Confirmación de Ruta */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#004D9D] text-xl flex items-center gap-2">
              <Route className="w-6 h-6" />
              ¿Confirmar esta ruta?
            </DialogTitle>
            <DialogDescription>
              La ruta se guardará y será visible para todos los comerciales en la página de Rutas
            </DialogDescription>
          </DialogHeader>

          {routeToConfirm && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-[#004D9D] mb-2">📍 Áreas a visitar:</h3>
                <div className="flex flex-wrap gap-2">
                  {routeToConfirm.pueblos.map((pueblo, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm">
                      {idx + 1}. {pueblo}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">⏱️ Tiempo estimado</p>
                  <p className="font-semibold text-[#004D9D]">{routeToConfirm.tiempo}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">🚗 Distancia</p>
                  <p className="font-semibold text-[#004D9D]">{routeToConfirm.distancia}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">👥 Clientes</p>
                  <p className="font-semibold text-[#004D9D]">{routeToConfirm.numClientes}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">🎯 Prioridad</p>
                  <Badge className={
                    routeToConfirm.prioridad === "ALTA" ? "bg-red-600" :
                    routeToConfirm.prioridad === "MEDIA" ? "bg-orange-600" : "bg-blue-600"
                  }>
                    {routeToConfirm.prioridad}
                  </Badge>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✅ <strong>Al confirmar:</strong> La ruta se guardará con tu nombre y podrás acceder a ella desde la página de Rutas
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleRejectRoute}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              No, buscar otra ruta
            </Button>
            <Button
              onClick={handleSaveRoute}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              disabled={saveRouteMutation.isLoading}
            >
              <CheckCircle2 className="w-4 h-4" />
              Sí, guardar ruta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
