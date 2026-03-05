import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSignature, Upload, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ContratoClienteSection({ cliente, isAdmin, isOwner }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadingFirmado, setUploadingFirmado] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState(cliente.contrato_presentado_texto || "");
  const [fechaValidacion, setFechaValidacion] = useState(cliente.fecha_validacion_contrato || "");

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Cliente.update(cliente.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["cliente", cliente.id]);
      queryClient.invalidateQueries(["clientes"]);
      toast.success("Contrato actualizado");
    },
  });

  const handleSubirContratoOriginal = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateMutation.mutate({ contrato_original_url: file_url });
    } catch (e) {
      toast.error("Error al subir el contrato");
    } finally {
      setUploading(false);
    }
  };

  const handleSubirContratoFirmado = async (file) => {
    setUploadingFirmado(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const fechaCierre = new Date().toISOString().split("T")[0];
      const mesComision = fechaCierre.substring(0, 7);
      const comisionTotal = (cliente.suministros || []).reduce((sum, s) => sum + (s.comision || 0), 0);
      updateMutation.mutate({ 
        contrato_firmado_url: file_url,
        estado: "Firmado con éxito",
        fecha_cierre: fechaCierre,
        mes_comision: mesComision,
        comision: comisionTotal,
        aprobado_admin: false
      });
      toast.success("Contrato firmado adjuntado. ¡Cliente marcado como Firmado con éxito!");
    } catch (e) {
      toast.error("Error al subir el contrato");
    } finally {
      setUploadingFirmado(false);
    }
  };

  const handleGuardarConfirmacion = () => {
    if (!textoConfirmacion.trim()) { toast.error("Escribe el texto de confirmación"); return; }
    updateMutation.mutate({
      contrato_presentado_texto: textoConfirmacion,
      fecha_validacion_contrato: fechaValidacion || new Date().toISOString().split("T")[0],
    });
  };

  const tieneContratoOriginal = !!cliente.contrato_original_url;
  const tieneContratoFirmado = !!cliente.contrato_firmado_url;

  return (
    <Card className="border-2 border-indigo-200 bg-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-indigo-800 flex items-center gap-2">
          <FileSignature className="w-5 h-5" />
          Contrato del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Admin sube contrato original */}
        {isAdmin && (
          <div className="bg-white border border-indigo-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-indigo-800 mb-2">📄 Contrato original (admin)</p>
            {tieneContratoOriginal ? (
              <div className="flex items-center gap-2">
                <a href={cliente.contrato_original_url} download="contrato_original.pdf">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs">
                    <Download className="w-3.5 h-3.5 mr-1" /> Descargar contrato
                  </Button>
                </a>
                <Button size="sm" variant="outline" disabled={uploading}
                  onClick={() => document.getElementById("upload-contrato-original").click()}
                  className="border-indigo-300 text-indigo-700 text-xs">
                  {uploading ? "Subiendo..." : "Reemplazar"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={uploading}
                onClick={() => document.getElementById("upload-contrato-original").click()}
                className="border-indigo-300 text-indigo-700 text-xs">
                <Upload className="w-3.5 h-3.5 mr-1" /> {uploading ? "Subiendo..." : "Subir contrato"}
              </Button>
            )}
            <input type="file" id="upload-contrato-original" className="hidden" accept=".pdf"
              onChange={e => { if (e.target.files[0]) handleSubirContratoOriginal(e.target.files[0]); e.target.value = ""; }} />
          </div>
        )}

        {/* Comercial ve y firma el contrato */}
        {tieneContratoOriginal && (
          <div className="bg-white border border-indigo-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-indigo-800 mb-2">✍️ Firma y devuelve el contrato</p>
            <div className="space-y-2">
              <a href={cliente.contrato_original_url} download="contrato.pdf">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs w-full">
                  <Download className="w-3.5 h-3.5 mr-1" /> Descargar para firmar
                </Button>
              </a>
              {tieneContratoFirmado ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 flex-1">Contrato firmado subido</span>
                  <a href={cliente.contrato_firmado_url} download>
                    <Button size="sm" variant="outline" className="text-xs h-6 border-green-300 text-green-700"><Download className="w-3 h-3" /></Button>
                  </a>
                </div>
              ) : (
                (isOwner || isAdmin) && (
                  <>
                    <Button size="sm" variant="outline" disabled={uploadingFirmado}
                      onClick={() => document.getElementById("upload-contrato-firmado").click()}
                      className="border-green-400 text-green-700 text-xs w-full">
                      <Upload className="w-3.5 h-3.5 mr-1" /> {uploadingFirmado ? "Subiendo..." : "Subir contrato firmado"}
                    </Button>
                    <input type="file" id="upload-contrato-firmado" className="hidden" accept=".pdf"
                      onChange={e => { if (e.target.files[0]) handleSubirContratoFirmado(e.target.files[0]); e.target.value = ""; }} />
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* Admin: confirmación y fecha activación */}
        {isAdmin && tieneContratoFirmado && (
          <div className="bg-white border border-indigo-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-indigo-800 mb-3">✅ Presentar contrato (admin)</p>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-600">Texto de confirmación</Label>
                <Input value={textoConfirmacion} onChange={e => setTextoConfirmacion(e.target.value)}
                  placeholder="Ej: Contrato enviado a gestoría el 01/03/2026" className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Fecha de activación (cliente activo desde)</Label>
                <Input type="date" value={fechaValidacion} onChange={e => setFechaValidacion(e.target.value)} className="mt-1 text-sm" />
              </div>
              <Button onClick={handleGuardarConfirmacion} disabled={updateMutation.isPending} className="bg-indigo-700 hover:bg-indigo-800 w-full">
                Guardar confirmación
              </Button>
            </div>
          </div>
        )}

        {/* Mostrar info si ya está confirmado */}
        {cliente.contrato_presentado_texto && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Contrato presentado</p>
                <p className="text-xs text-green-700 mt-1">{cliente.contrato_presentado_texto}</p>
                {cliente.fecha_validacion_contrato && (
                  <p className="text-xs text-green-600 mt-1">
                    📅 Activo desde: {new Date(cliente.fecha_validacion_contrato).toLocaleDateString("es-ES")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!tieneContratoOriginal && !isAdmin && (
          <p className="text-sm text-gray-400 italic text-center py-2">El admin aún no ha subido el contrato</p>
        )}
      </CardContent>
    </Card>
  );
}