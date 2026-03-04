import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature, Upload, Download, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ContratosAdmin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      if (u.role !== "admin") { navigate(createPageUrl("Dashboard")); return; }
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["documentos_clientes_todos"],
    queryFn: () => base44.entities.DocumentosCliente.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(["clientes"]),
  });

  // Clientes con DNI o CIF pero sin contrato original aún
  const clientesPendientesContrato = clientes.filter(c => {
    const doc = docs.find(d => d.cliente_id === c.id);
    return (doc?.cif || doc?.dni_texto || doc?.dni_archivos?.length > 0 || doc?.iban || doc?.iban_archivo_url) && !c.contrato_original_url;
  });

  // Clientes con contrato original, esperando contrato firmado del comercial
  const clientesEsperandoFirma = clientes.filter(c =>
    c.contrato_original_url && !c.contrato_firmado_url
  );

  // Clientes con contrato firmado, pendiente de confirmación admin
  const clientesPendientesConfirmacion = clientes.filter(c =>
    c.contrato_firmado_url && !c.contrato_presentado_texto
  );

  const handleSubirContrato = async (clienteId, file) => {
    setUploading(prev => ({ ...prev, [clienteId]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateMutation.mutate({ id: clienteId, data: { contrato_original_url: file_url } });
      toast.success("Contrato subido");
    } catch (e) {
      toast.error("Error al subir contrato");
    } finally {
      setUploading(prev => ({ ...prev, [clienteId]: false }));
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ClienteRow = ({ cliente, accion }) => {
    const doc = docs.find(d => d.cliente_id === cliente.id);
    return (
      <Card className="bg-white border border-indigo-100 hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                className="font-semibold text-[#004D9D] hover:underline flex items-center gap-2 text-left"
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                {cliente.nombre_negocio}
              </button>
              <p className="text-xs text-gray-500 mt-1">{cliente.propietario_iniciales}</p>
              {doc?.cif && <p className="text-xs text-gray-600 mt-1">CIF: {doc.cif}</p>}
              {doc?.dni_texto && <p className="text-xs text-gray-600">DNI: {doc.dni_texto}</p>}
            </div>
            <div className="flex-shrink-0">{accion(cliente)}</div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <FileSignature className="w-8 h-8" />
          Área de Contratos
        </h1>
        <p className="text-[#666666]">Gestión de contratos de clientes</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="border-l-4 border-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Pendiente subir contrato</p>
            <p className="text-3xl font-bold text-orange-600">{clientesPendientesContrato.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-blue-400">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Esperando firma comercial</p>
            <p className="text-3xl font-bold text-blue-600">{clientesEsperandoFirma.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-green-400">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Pendiente confirmación</p>
            <p className="text-3xl font-bold text-green-600">{clientesPendientesConfirmacion.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pendientes de subir contrato */}
      {clientesPendientesContrato.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-orange-700 mb-3 flex items-center gap-2">
            📋 Pendiente subir contrato ({clientesPendientesContrato.length})
          </h2>
          <div className="space-y-3">
            {clientesPendientesContrato.map(c => (
              <ClienteRow key={c.id} cliente={c} accion={(cliente) => (
                <>
                  <input type="file" id={`upload-${c.id}`} className="hidden" accept=".pdf"
                    onChange={e => { if (e.target.files[0]) handleSubirContrato(c.id, e.target.files[0]); e.target.value = ""; }} />
                  <Button size="sm" disabled={uploading[c.id]}
                    onClick={() => document.getElementById(`upload-${c.id}`).click()}
                    className="bg-orange-600 hover:bg-orange-700 text-xs">
                    <Upload className="w-3.5 h-3.5 mr-1" /> {uploading[c.id] ? "Subiendo..." : "Subir contrato"}
                  </Button>
                </>
              )} />
            ))}
          </div>
        </div>
      )}

      {/* Esperando firma del comercial */}
      {clientesEsperandoFirma.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">
            ✍️ Esperando firma del comercial ({clientesEsperandoFirma.length})
          </h2>
          <div className="space-y-3">
            {clientesEsperandoFirma.map(c => (
              <ClienteRow key={c.id} cliente={c} accion={(cliente) => (
                <a href={cliente.contrato_original_url} download>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 text-xs">
                    <Download className="w-3.5 h-3.5 mr-1" /> Ver contrato
                  </Button>
                </a>
              )} />
            ))}
          </div>
        </div>
      )}

      {/* Contrato firmado recibido */}
      {clientesPendientesConfirmacion.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
            ✅ Contrato firmado recibido ({clientesPendientesConfirmacion.length})
          </h2>
          <div className="space-y-3">
            {clientesPendientesConfirmacion.map(c => (
              <ClienteRow key={c.id} cliente={c} accion={(cliente) => (
                <div className="flex gap-2">
                  <a href={cliente.contrato_firmado_url} download>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs">
                      <Download className="w-3.5 h-3.5 mr-1" /> Ver firmado
                    </Button>
                  </a>
                  <Button size="sm" variant="outline"
                    onClick={() => navigate(createPageUrl(`DetalleCliente?id=${cliente.id}`))}
                    className="text-xs border-green-300 text-green-700">
                    Confirmar
                  </Button>
                </div>
              )} />
            ))}
          </div>
        </div>
      )}

      {clientesPendientesContrato.length === 0 && clientesEsperandoFirma.length === 0 && clientesPendientesConfirmacion.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay contratos pendientes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}