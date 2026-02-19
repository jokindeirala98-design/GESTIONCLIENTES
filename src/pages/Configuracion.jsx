import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, User, Mail, Download, Save, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export default function Configuracion() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    iniciales: "",
    notificaciones_email: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setFormData({
        full_name: currentUser.full_name || "",
        iniciales: currentUser.iniciales || "",
        notificaciones_email: currentUser.notificaciones_email !== false,
      });
    };
    loadUser();
  }, []);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: user?.role === 'admin',
  });

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => base44.entities.Zona.list(),
    enabled: user?.role === 'admin',
  });

  const updateMeMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['me']);
      toast.success("Perfil actualizado correctamente");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMeMutation.mutate(formData);
  };

  const exportarExcel = async () => {
    setIsExporting(true);
    try {
      const zonasMap = {};
      zonas.forEach(z => {
        zonasMap[z.id] = z.nombre;
      });

      const rows = clientes.map(cliente => {
        const zonaNombre = zonasMap[cliente.zona_id] || 'Sin zona';
        return {
          'Zona': zonaNombre,
          'Cliente': cliente.nombre_negocio || '',
          'Estado': cliente.estado || ''
        };
      });

      // Ordenar por zona y luego por nombre de cliente
      rows.sort((a, b) => {
        if (a.Zona !== b.Zona) return a.Zona.localeCompare(b.Zona);
        return a.Cliente.localeCompare(b.Cliente);
      });

      const headers = ['Zona', 'Cliente', 'Estado'];
      const csvContent = [
        headers.join(','),
        ...rows.map(row => headers.map(header => {
          const value = row[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `voltis_clientes_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Exportación completada");
    } catch (error) {
      toast.error("Error al exportar datos");
      console.error(error);
    }
    setIsExporting(false);
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Configuración
        </h1>
        <p className="text-[#666666]">
          Gestiona tu perfil y preferencias
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              Mi Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#666666] mb-1 block">
                    Nombre completo
                  </label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#666666] mb-1 block">
                    Iniciales
                  </label>
                  <Input
                    value={formData.iniciales}
                    onChange={(e) => setFormData({ ...formData, iniciales: e.target.value.toUpperCase() })}
                    placeholder="TUS"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Estas iniciales se mostrarán en los clientes que crees
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#666666] mb-1 block">
                    Email
                  </label>
                  <Input
                    value={user.email}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El email no se puede modificar
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#666666] mb-1 block">
                    Rol
                  </label>
                  <Input
                    value={isAdmin ? 'Administrador' : 'Comercial'}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[#666666]" />
                    <div>
                      <p className="font-medium text-[#004D9D]">
                        Notificaciones por email
                      </p>
                      <p className="text-xs text-[#666666]">
                        Recibir avisos cuando haya cambios importantes
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.notificaciones_email}
                    onCheckedChange={(checked) => setFormData({ ...formData, notificaciones_email: checked })}
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="bg-[#004D9D] hover:bg-[#00AEEF] w-full md:w-auto"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-gradient-to-r from-green-500 to-green-600">
            <CardTitle className="text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Bot de WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <p className="text-[#666666]">
                Conecta tu WhatsApp para procesar facturas de Naturgy automáticamente.
              </p>
              <a 
                href={base44.agents.getWhatsAppConnectURL('procesar_facturas_whatsapp')} 
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-green-600 hover:bg-green-700 w-full md:w-auto">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  💬 Conectar WhatsApp
                </Button>
              </a>
              <p className="text-xs text-gray-500">
                Envía fotos de facturas de Naturgy y el bot extraerá los datos automáticamente
              </p>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-orange-500 to-orange-600">
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Bot de Tareas WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-[#666666]">
                  Envía correos de acceso al Bot de Tareas a Nicolás y Jokin para que puedan añadir tareas al corcho por WhatsApp.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Se enviará a:</p>
                  <p className="text-sm text-orange-800">📧 nicolasvoltis@gmail.com</p>
                  <p className="text-sm text-orange-800">📧 jokin@voltisenergia.com</p>
                </div>
                <Button
                  onClick={async () => {
                    setIsSendingInvites(true);
                    try {
                      await base44.functions.invoke('enviarInvitacionCorcho');
                      toast.success("Correos enviados correctamente a Nicolás y Jokin");
                    } catch (error) {
                      toast.error("Error al enviar los correos");
                    }
                    setIsSendingInvites(false);
                  }}
                  disabled={isSendingInvites}
                  className="bg-orange-500 hover:bg-orange-600 w-full md:w-auto"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSendingInvites ? "Enviando..." : "📨 Enviar acceso por correo"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-purple-500 to-purple-600">
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5" />
                Exportar Datos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-[#666666]">
                  Exporta todos los datos de clientes, zonas y comisiones a un archivo CSV/Excel.
                </p>
                <Button
                  onClick={exportarExcel}
                  disabled={isExporting}
                  className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? "Exportando..." : "📤 Exportar todo a Excel"}
                </Button>
                <p className="text-xs text-gray-500">
                  El archivo incluirá: zonas, clientes, facturas, informes y comisiones
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-md border-l-4 border-[#004D9D]">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <div>
                <h3 className="font-bold text-[#004D9D] mb-2">
                  Voltis Energía - Gestor de Clientes
                </h3>
                <p className="text-sm text-[#666666] mb-2">
                  Versión 1.0.0
                </p>
                <p className="text-xs text-gray-500">
                  Aplicación desarrollada para la gestión eficiente de zonas y clientes comerciales.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}