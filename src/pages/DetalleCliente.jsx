
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Building2, User, Phone, Mail, MapPin, FileText,
  Upload, Download, Trash2, Edit, X, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import EditClienteDialog from "../components/clientes/EditClienteDialog.jsx";
import SubirFacturasDialog from "../components/clientes/SubirFacturasDialog.jsx";
import SubirInformeDialog from "../components/clientes/SubirInformeDialog.jsx";

const estadoColors = {
  "Primer contacto": "bg-gray-500",
  "Esperando facturas": "bg-orange-500",
  "Facturas presentadas": "bg-blue-500",
  "Informe listo": "bg-purple-500",
  "Cerrado con éxito": "bg-green-500",
  "Rechazado": "bg-red-500",
};

export default function DetalleCliente() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showFacturasDialog, setShowFacturasDialog] = useState(false);
  const [showInformeDialog, setShowInformeDialog] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const clienteId = urlParams.get('id');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      const clientes = await base44.entities.Cliente.list();
      return clientes.find(c => c.id === clienteId);
    },
    enabled: !!clienteId,
  });

  const { data: zona } = useQuery({
    queryKey: ['zona', cliente?.zona_id],
    queryFn: async () => {
      if (!cliente?.zona_id) return null;
      const zonas = await base44.entities.Zona.list();
      return zonas.find(z => z.id === cliente.zona_id);
    },
    enabled: !!cliente?.zona_id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cliente', clienteId]);
      queryClient.invalidateQueries(['clientes']);
      toast.success("Cliente actualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cliente.delete(id),
    onSuccess: () => {
      toast.success("Cliente eliminado");
      navigate(createPageUrl("Clientes"));
    },
  });

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar el cliente "${cliente.nombre_negocio}"?`)) {
      deleteMutation.mutate(clienteId);
    }
  };

  const handleMarcarRechazado = () => {
    if (window.confirm("¿Marcar este cliente como Rechazado?")) {
      updateMutation.mutate({
        id: clienteId,
        data: { estado: "Rechazado" }
      });
    }
  };

  const handleMarcarCerrado = () => {
    if (window.confirm("¿Marcar este cliente como Cerrado con éxito?")) {
      const fechaCierre = new Date().toISOString().split('T')[0];
      const mesComision = fechaCierre.substring(0, 7);
      
      updateMutation.mutate({
        id: clienteId,
        data: { 
          estado: "Cerrado con éxito",
          fecha_cierre: fechaCierre,
          mes_comision: mesComision
        }
      });
    }
  };

  const handleDeleteFactura = (index) => {
    if (window.confirm("¿Eliminar esta factura?")) {
      const nuevasFacturas = [...cliente.facturas];
      nuevasFacturas.splice(index, 1);
      updateMutation.mutate({
        id: clienteId,
        data: { facturas: nuevasFacturas }
      });
    }
  };

  if (isLoading || !user || !cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Cargando...</p>
        </div>
      </div>
    );
  }

  const isOwner = cliente.propietario_email === user.email;
  const isAdmin = user.role === "admin";
  const canViewFull = isOwner || isAdmin;
  const canEdit = isOwner || isAdmin;

  if (!canViewFull) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("Clientes"))}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-[#666666]">No tienes permisos para ver este cliente</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Button
        variant="outline"
        onClick={() => navigate(createPageUrl("Clientes"))}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <Card className="border-l-4 mb-6" style={{ borderLeftColor: estadoColors[cliente.estado] }}>
        <CardHeader className="bg-gradient-to-r from-[#004D9D] to-[#00AEEF]">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-white text-2xl mb-2 flex items-center gap-3">
                <Building2 className="w-7 h-7" />
                {cliente.nombre_negocio}
              </CardTitle>
              <Badge className={`${estadoColors[cliente.estado]} text-white`}>
                {cliente.estado}
              </Badge>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {cliente.propietario_iniciales}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              {cliente.nombre_cliente && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <User className="w-5 h-5" />
                  <span>{cliente.nombre_cliente}</span>
                </div>
              )}
              {cliente.telefono && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <Phone className="w-5 h-5" />
                  <span>{cliente.telefono}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <Mail className="w-5 h-5" />
                  <span className="break-all">{cliente.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {zona && (
                <div className="flex items-center gap-3 text-[#666666]">
                  <MapPin className="w-5 h-5" />
                  <span>{zona.nombre}</span>
                </div>
              )}
              {cliente.tipo_factura && (
                <div className="text-[#666666]">
                  <strong>Tipo de factura:</strong> {cliente.tipo_factura}
                </div>
              )}
            </div>
          </div>

          {cliente.anotaciones && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-[#004D9D] mb-2">Anotaciones</h3>
              <p className="text-[#666666] whitespace-pre-wrap">{cliente.anotaciones}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
            
            {canEdit && (
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}

            {isOwner && (cliente.estado === "Primer contacto" || cliente.estado === "Esperando facturas" || cliente.estado === "Facturas presentadas") && (
              <Button
                variant="outline"
                onClick={handleMarcarRechazado}
                className="text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Marcar Rechazado
              </Button>
            )}

            {isAdmin && cliente.estado !== "Cerrado con éxito" && cliente.estado !== "Rechazado" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleMarcarRechazado}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleMarcarCerrado}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Cerrar con Éxito
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#004D9D] flex items-center justify-between">
              <span>Facturas</span>
              {isOwner && (!cliente.facturas || cliente.facturas.length < 3) && (
                <Button
                  size="sm"
                  onClick={() => setShowFacturasDialog(true)}
                  className="bg-[#004D9D] hover:bg-[#00AEEF]"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Subir
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!cliente.facturas || cliente.facturas.length === 0 ? (
              <p className="text-[#666666] text-sm text-center py-4">
                No hay facturas subidas
              </p>
            ) : (
              <div className="space-y-2">
                {cliente.facturas.map((factura, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-[#004D9D] flex-shrink-0" />
                      <span className="text-sm truncate">{factura.nombre}</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={factura.url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFactura(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[#004D9D] flex items-center justify-between">
              <span>Informe Final</span>
              {isAdmin && !cliente.informe_final && cliente.estado === "Facturas presentadas" && (
                <Button
                  size="sm"
                  onClick={() => setShowInformeDialog(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Subir
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!cliente.informe_final ? (
              <p className="text-[#666666] text-sm text-center py-4">
                No hay informe final
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="text-sm truncate">{cliente.informe_final.nombre}</span>
                  </div>
                  <a href={cliente.informe_final.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
                {cliente.comision && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-[#666666] mb-1">Comisión</p>
                    <p className="text-2xl font-bold text-green-600">
                      €{cliente.comision.toFixed(2)}
                    </p>
                    {cliente.estado === "Cerrado con éxito" && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Contabilizada en comisiones
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showEditDialog && (
        <EditClienteDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          cliente={cliente}
        />
      )}

      {showFacturasDialog && (
        <SubirFacturasDialog
          open={showFacturasDialog}
          onClose={() => setShowFacturasDialog(false)}
          cliente={cliente}
          user={user}
        />
      )}

      {showInformeDialog && (
        <SubirInformeDialog
          open={showInformeDialog}
          onClose={() => setShowInformeDialog(false)}
          cliente={cliente}
          user={user}
        />
      )}
    </div>
  );
}
