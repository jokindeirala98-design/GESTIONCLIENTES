
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
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
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function PlanificadorRutas() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
      
      const horaActual = new Date().getHours();
      const minutoActual = new Date().getMinutes();
      const horaFormateada = `${horaActual}:${minutoActual.toString().padStart(2, '0')}`;
      const tiempoDisponible = (14 - horaActual - (minutoActual > 0 ? 1 : 0));
      
      setMessages([{
        role: "assistant",
        content: `¡Hola! 👋 Soy tu asistente inteligente de planificación de rutas.\n\n**⏰ Hora actual:** ${horaFormateada}\n**⌛ Tiempo disponible:** ${tiempoDisponible}h hasta las 14:00\n\n**Mi especialidad:**\n✅ Priorizar clientes tipo 6.1 (máxima rentabilidad)\n✅ Optimizar rutas circulares desde Ansoáin\n✅ Maximizar cierres con "Informe listo"\n✅ Identificar pueblos nuevos para prospectar\n\n**🔥 Prioridades:**\n🔴 Tipo 6.1 + Informe listo (20 min/visita) - MÁXIMA\n🟠 Tipo 3.0 + Informe listo (15 min/visita)\n🟡 Tipo 2.0 + Informe listo (15 min/visita)\n🆕 Pueblos sin clientes (30 min prospección)\n\n💡 **Si hay tiempo libre**, te sugiero pueblos cercanos para prospectar (comercios, polígonos, oficinas...)\n\n¿Qué tipo de ruta necesitas planificar?`
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

  const extractRouteForExport = (messageContent) => {
    const pueblosMatch = messageContent.match(/📍.*?(?=\n|$)/g);
    if (!pueblosMatch) return null;
    
    const pueblos = pueblosMatch
      .map(p => p.replace(/📍|Nombre:|PUEBLO/gi, '').trim())
      .filter(p => p.length > 0);
    
    return pueblos.length > 0 ? pueblos : null;
  };

  const exportToGoogleMaps = (pueblos) => {
    if (!pueblos || pueblos.length === 0) return;
    
    const origin = "Ansoáin, Navarra";
    const destination = "Pamplona, Navarra";
    const waypoints = pueblos.slice(0, -1).join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    
    window.open(url, '_blank');
    toast.success("Ruta abierta en Google Maps");
  };

  const isAdmin = user?.role === "admin";
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user?.email);

  const clientesReadyToGo = misClientes.filter(c => c.estado === "Informe listo");
  const clientes61Ready = clientesReadyToGo.filter(c => c.tipo_factura === "6.1").length;
  const clientes30Ready = clientesReadyToGo.filter(c => c.tipo_factura === "3.0").length;
  const clientes20Ready = clientesReadyToGo.filter(c => c.tipo_factura === "2.0").length;
  
  // Calcular pueblos sin trabajar (prospección)
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

      {/* Stats por tipo de factura + prospección */}
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
            <div className="flex items-center justify-center gap-2 mb-2">
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
              onClick={() => handleQuickAction(`Son las ${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}. Dame la ruta óptima para HOY hasta las 14:00. Incluye clientes prioritarios y si hay tiempo, sugiere pueblos para prospectar.`)}
              className="w-full bg-green-600 hover:bg-green-700 text-white justify-start h-auto py-3"
              disabled={isLoading}
            >
              <Route className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="text-left">
                <div className="font-bold">Ruta para Hoy</div>
                <div className="text-xs opacity-90">Plan completo + tiempo real</div>
              </div>
            </Button>

            <Button
              onClick={() => handleQuickAction("Necesito una ruta express. ¿Cuánto tiempo tengo disponible?")}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white justify-start h-auto py-3"
              disabled={isLoading}
            >
              <Clock className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="text-left">
                <div className="font-bold">Ruta Express</div>
                <div className="text-xs opacity-90">Tiempo limitado</div>
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

                    {message.role === "assistant" && message.content.includes("📍") && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const pueblos = extractRouteForExport(message.content);
                            if (pueblos) {
                              exportToGoogleMaps(pueblos);
                            } else {
                              toast.error("No se pudo extraer la ruta");
                            }
                          }}
                          className="w-full text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-2" />
                          Exportar a Google Maps
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
    </div>
  );
}
