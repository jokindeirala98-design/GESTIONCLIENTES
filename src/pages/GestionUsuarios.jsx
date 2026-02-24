import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Mail, Shield, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function GestionUsuarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    nombre: "",
    iniciales: "",
    email: "",
    rol: "user",
  });

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

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ email, data }) => {
      const usuarioActual = usuarios.find(u => u.email === email);
      return base44.entities.User.update(usuarioActual.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['usuarios']);
      toast.success("Usuario actualizado");
    },
  });

  const enviarInvitacion = async (e) => {
    e.preventDefault();
    
    try {
      await base44.integrations.Core.SendEmail({
        from_name: "Voltis Energía",
        to: inviteForm.email,
        subject: "Invitación a Gestor de Clientes Voltis",
        body: `Hola ${inviteForm.nombre},\n\nHas sido invitado a unirte al Gestor de Clientes de Voltis Energía como ${inviteForm.rol === 'admin' ? 'Administrador' : 'Comercial'}.\n\nTus iniciales serán: ${inviteForm.iniciales}\n\nPor favor, accede a la aplicación para completar tu registro.\n\nSaludos,\nEquipo Voltis`
      });

      toast.success("Invitación enviada por correo");
      setShowInviteDialog(false);
      setInviteForm({
        nombre: "",
        iniciales: "",
        email: "",
        rol: "user",
      });
    } catch (error) {
      toast.error("Error al enviar la invitación");
    }
  };

  const toggleNotificaciones = (usuario) => {
    updateUserMutation.mutate({
      email: usuario.email,
      data: {
        notificaciones_email: !usuario.notificaciones_email
      }
    });
  };

  const toggleActivo = (usuario) => {
    updateUserMutation.mutate({
      email: usuario.email,
      data: {
        activo: !usuario.activo
      }
    });
  };

  if (!user) return null;

  const admins = usuarios.filter(u => u.role === 'admin');
  const comerciales = usuarios.filter(u => u.role === 'user');

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8" />
            Gestión de Usuarios
          </h1>
          <p className="text-[#666666]">
            Administra usuarios y permisos
          </p>
        </div>
        <Button
          onClick={() => setShowInviteDialog(true)}
          className="bg-[#004D9D] hover:bg-[#00AEEF] w-full md:w-auto"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Invitar Usuario
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Total Usuarios</p>
                <p className="text-3xl font-bold text-[#004D9D]">{usuarios.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-6 h-6 text-[#004D9D]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Administradores</p>
                <p className="text-3xl font-bold text-purple-600">{admins.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666] mb-1">Comerciales</p>
                <p className="text-3xl font-bold text-green-600">{comerciales.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D]">Administradores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {admins.map(usuario => (
                <div key={usuario.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold">
                          {usuario.iniciales || usuario.full_name?.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-[#004D9D]">{usuario.full_name}</p>
                        <p className="text-sm text-[#666666]">{usuario.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge className="bg-purple-100 text-purple-700">
                        Admin
                      </Badge>
                      
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#666666]" />
                        <Switch
                          checked={usuario.notificaciones_email !== false}
                          onCheckedChange={() => toggleNotificaciones(usuario)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#666666]">Activo</span>
                        <Switch
                          checked={usuario.activo !== false}
                          onCheckedChange={() => toggleActivo(usuario)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D]">Comerciales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {comerciales.map(usuario => (
                <div key={usuario.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                        <span className="text-white font-bold">
                          {usuario.iniciales || usuario.full_name?.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-[#004D9D]">{usuario.full_name}</p>
                        <p className="text-sm text-[#666666]">{usuario.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <Badge className="bg-green-100 text-green-700">
                        Comercial
                      </Badge>
                      {usuario.email === 'jose@voltisenergia.com' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reenviarAccesoWhatsapp(usuario.email)}
                          disabled={enviandoWhatsapp}
                          className="text-green-700 border-green-300 hover:bg-green-50 text-xs"
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Reenviar acceso WhatsApp
                        </Button>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#666666]" />
                        <Switch
                          checked={usuario.notificaciones_email !== false}
                          onCheckedChange={() => toggleNotificaciones(usuario)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#666666]">Activo</span>
                        <Switch
                          checked={usuario.activo !== false}
                          onCheckedChange={() => toggleActivo(usuario)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Invitar Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviarInvitacion}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Nombre completo *
                </label>
                <Input
                  value={inviteForm.nombre}
                  onChange={(e) => setInviteForm({ ...inviteForm, nombre: e.target.value })}
                  placeholder="Ej: Juan García"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Iniciales *
                </label>
                <Input
                  value={inviteForm.iniciales}
                  onChange={(e) => setInviteForm({ ...inviteForm, iniciales: e.target.value.toUpperCase() })}
                  placeholder="Ej: JGA"
                  maxLength={3}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Email *
                </label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[#666666] mb-1 block">
                  Rol *
                </label>
                <Select value={inviteForm.rol} onValueChange={(value) => setInviteForm({ ...inviteForm, rol: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Comercial</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Se enviará un correo de invitación al usuario con instrucciones para acceder.
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#004D9D] hover:bg-[#00AEEF]">
                Enviar Invitación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}