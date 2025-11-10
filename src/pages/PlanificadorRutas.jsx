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
  MessageSquare
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

  // Crear conversación al cargar
  useEffect(() => {
    if (user) {
      createConversation();
    }
  }, [user]);

  // Auto-scroll a último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Suscribirse a actualizaciones de la conversación
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
      
      // Mensaje de bienvenida
      setMessages([{
        role: "assistant",
        content: `¡Hola! 👋 Soy tu asistente de planificación de rutas.\n\nPuedo ayudarte a:\n✅ Generar rutas optimizadas para hoy\n✅ Identificar pueblos con clientes ready to go\n✅ Calcular distancias y tiempos de viaje\n✅ Priorizar visitas según estado de clientes\n\n**Tu disponibilidad:** 8:00 AM - 2:00 PM (6 horas)\n**Punto de partida:** Oficinas Voltis, Ansoáin\n\n¿Qué ruta quieres planificar hoy?`
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
      // Obtener conversación actual
      const conversation = await base44.agents.getConversation(conversationId);
      
      // Enviar mensaje
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
    setTimeout(() => handleSendMessage(), 100);
  };

  const isAdmin = user?.role === "admin";
  const misClientes = isAdmin 
    ? clientes 
    : clientes.filter(c => c.propietario_email === user?.email);

  const clientesReadyToGo = misClientes.filter(c => c.estado === "Informe listo").length;
  const clientesPendientes = misClientes.filter(
    c => c.estado === "Pendiente de firma" || c.estado === "Facturas presentadas"
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <Navigation className="w-8 h-8" />
          Planificador de Rutas IA
        </h1>
        <p className="text-[#666666]">
          Optimiza tus visitas con inteligencia artificial
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-none shadow-md bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <Sparkles className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{clientesReadyToGo}</p>
            <p className="text-xs text-green-700">Ready to Go</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">6h</p>
            <p className="text-xs text-blue-700">Disponibles</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-600">{clientesPendientes}</p>
            <p className="text-xs text-purple-700">En Proceso</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">{misClientes.length}</p>
            <p className="text-xs text-orange-700">Total Clientes</p>
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
              onClick={() => handleQuickAction("Dame una ruta óptima para hoy priorizando clientes con informe listo")}
              className="w-full bg-green-600 hover:bg-green-700 text-white justify-start"
              disabled={isLoading}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Ruta Óptima Hoy
            </Button>

            <Button
              onClick={() => handleQuickAction("¿Qué pueblos tienen más clientes con informe listo? Dame los top 5")}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Pueblos Ready to Go
            </Button>

            <Button
              onClick={() => handleQuickAction("Dame una ruta cercana a las oficinas que pueda completar en 3 horas")}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <Clock className="w-4 h-4 mr-2" />
              Ruta Corta (3h)
            </Button>

            <Button
              onClick={() => handleQuickAction("¿Compensa hacer una ruta a Tudela y zona sur hoy?")}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Analizar Zona Sur
            </Button>

            <Button
              onClick={() => handleQuickAction("Dame estadísticas de mis clientes por estado y pueblo")}
              variant="outline"
              className="w-full justify-start"
              disabled={isLoading}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Ver Estadísticas
            </Button>

            <div className="pt-3 border-t">
              <p className="text-xs text-gray-500 mb-2">💡 Consejos:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Prioriza pueblos con >70% ready</li>
                <li>• Agrupa visitas por zona</li>
                <li>• ~30-45 min por cliente</li>
                <li>• Sal a las 8:00 AM</li>
              </ul>
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
            {/* Área de mensajes */}
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
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-[#004D9D] text-white"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                    
                    {/* Tool calls (funciones ejecutadas) */}
                    {message.tool_calls && message.tool_calls.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {message.tool_calls.map((tool, toolIdx) => (
                          <Badge
                            key={toolIdx}
                            variant="outline"
                            className="text-xs bg-blue-50 text-blue-700"
                          >
                            🔧 {tool.name || "Consultando datos"}
                          </Badge>
                        ))}
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

            {/* Input de mensaje */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Pregunta sobre rutas, pueblos, clientes..."
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
                💡 Ejemplo: "Dame una ruta para visitar 5 pueblos con clientes ready to go"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}