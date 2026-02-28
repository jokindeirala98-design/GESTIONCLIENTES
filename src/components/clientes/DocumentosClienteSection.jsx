import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderOpen, Upload, Download, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function DocumentosClienteSection({ cliente, isOwnerOrAdmin, isAdmin }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState({});

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documentos_cliente", cliente.id],
    queryFn: async () => {
      const all = await base44.entities.DocumentosCliente.list();
      return all.find(d => d.cliente_id === cliente.id) || null;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data) => {
      if (docs?.id) {
        return base44.entities.DocumentosCliente.update(docs.id, data);
      } else {
        return base44.entities.DocumentosCliente.create({
          cliente_id: cliente.id,
          cliente_nombre: cliente.nombre_negocio,
          ...data,
        });
      }
    },
    onSuccess: async (savedDoc, data) => {
      queryClient.invalidateQueries(["documentos_cliente", cliente.id]);
      setEditando(false);
      toast.success("Documentos guardados");

      // Si se acaba de guardar DNI o CIF y no había tarea ya creada → crear tarea en Iranzu
      const docActual = docs;
      const teniaDni = docActual?.dni_texto || docActual?.dni_archivos?.length > 0;
      const teniaCif = docActual?.cif;
      const tarea_ya_creada = docActual?.tarea_contrato_creada;
      const ahoraTieneDni = data.dni_texto || (data.dni_archivos && data.dni_archivos.length > 0);
      const ahoraTieneCif = data.cif;

      if (!tarea_ya_creada && (ahoraTieneDni || ahoraTieneCif) && (!teniaDni && !teniaCif)) {
        try {
          await base44.entities.TareaCorcho.create({
            descripcion: `Generar contrato ${cliente.nombre_negocio}`,
            notas: `Cliente: ${cliente.nombre_negocio}. CIF: ${data.cif || "pendiente"}. DNI: ${data.dni_texto || "adjunto"}`,
            completada: false,
            prioridad: "rojo",
            orden: 0,
            propietario_email: "iranzu@voltisenergia.com",
            creador_email: "sistema",
          });
          // Marcar tarea creada
          if (savedDoc?.id) {
            await base44.entities.DocumentosCliente.update(savedDoc.id, { tarea_contrato_creada: true });
          }
          toast.info("Tarea de contrato creada para Iranzu");
        } catch (e) {
          console.error("Error creando tarea:", e);
        }
      }
    },
  });

  const handleEditar = () => {
    setForm({
      cups: docs?.cups || "",
      cif: docs?.cif || "",
      nombre_empresa: docs?.nombre_empresa || "",
      consumo_anual: docs?.consumo_anual || "",
      direccion_fiscal: docs?.direccion_fiscal || "",
      telefono: docs?.telefono || "",
      iban: docs?.iban || "",
      email: docs?.email || "",
      dni_texto: docs?.dni_texto || "",
      dni_archivos: docs?.dni_archivos || [],
    });
    setEditando(true);
  };

  const handleGuardar = () => {
    const data = {
      ...form,
      consumo_anual: form.consumo_anual ? parseFloat(form.consumo_anual) : undefined,
    };
    upsertMutation.mutate(data);
  };

  const handleUploadArchivo = async (campo, file) => {
    setUploading(prev => ({ ...prev, [campo]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (campo === "dni") {
        setForm(prev => ({
          ...prev,
          dni_archivos: [...(prev.dni_archivos || []), { nombre: file.name, url: file_url, fecha_subida: new Date().toISOString() }],
        }));
      } else {
        setForm(prev => ({ ...prev, [`${campo}_archivo_url`]: file_url }));
      }
      toast.success("Archivo subido");
    } catch (e) {
      toast.error("Error al subir archivo");
    } finally {
      setUploading(prev => ({ ...prev, [campo]: false }));
    }
  };

  const campos = [
    { key: "cups", label: "CUPS", tipo: "texto" },
    { key: "cif", label: "CIF", tipo: "texto" },
    { key: "nombre_empresa", label: "Nombre empresa", tipo: "texto" },
    { key: "consumo_anual", label: "Consumo anual (kWh)", tipo: "numero" },
    { key: "direccion_fiscal", label: "Dirección fiscal", tipo: "texto" },
    { key: "telefono", label: "Teléfono", tipo: "texto" },
    { key: "iban", label: "IBAN", tipo: "texto" },
    { key: "email", label: "Email", tipo: "texto" },
    { key: "dni_texto", label: "DNI/NIE", tipo: "texto" },
  ];

  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Documentos del Cliente
          </CardTitle>
          {isOwnerOrAdmin && !editando && (
            <Button size="sm" onClick={handleEditar} variant="outline" className="border-purple-400 text-purple-700">
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : editando ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {campos.map(campo => (
                <div key={campo.key}>
                  <Label className="text-sm font-medium text-gray-700">{campo.label}</Label>
                  <Input
                    type={campo.tipo === "numero" ? "number" : "text"}
                    value={form[campo.key] || ""}
                    onChange={e => setForm(prev => ({ ...prev, [campo.key]: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>

            {/* DNI archivos */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Archivos DNI (máx. 2)</Label>
              <div className="space-y-1 mt-1">
                {(form.dni_archivos || []).map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white border border-purple-200 p-2 rounded text-sm">
                    <span className="flex-1 truncate">{a.nombre}</span>
                    <button onClick={() => setForm(prev => ({ ...prev, dni_archivos: prev.dni_archivos.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(form.dni_archivos || []).length < 2 && (
                  <>
                    <input type="file" id="upload-dni" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { if (e.target.files[0]) handleUploadArchivo("dni", e.target.files[0]); e.target.value = ""; }} />
                    <Button size="sm" variant="outline" disabled={uploading.dni} onClick={() => document.getElementById("upload-dni").click()} className="border-purple-300 text-purple-700 w-full text-xs">
                      <Upload className="w-3.5 h-3.5 mr-1" /> {uploading.dni ? "Subiendo..." : "Adjuntar DNI"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* IBAN archivo */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Archivo IBAN</Label>
              {form.iban_archivo_url ? (
                <div className="flex items-center gap-2 bg-white border border-purple-200 p-2 rounded text-sm mt-1">
                  <span className="flex-1 text-purple-700">Archivo adjunto</span>
                  <a href={form.iban_archivo_url} download className="text-purple-600"><Download className="w-4 h-4" /></a>
                  <button onClick={() => setForm(prev => ({ ...prev, iban_archivo_url: "" }))} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <input type="file" id="upload-iban" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { if (e.target.files[0]) handleUploadArchivo("iban", e.target.files[0]); e.target.value = ""; }} />
                  <Button size="sm" variant="outline" disabled={uploading.iban} onClick={() => document.getElementById("upload-iban").click()} className="border-purple-300 text-purple-700 w-full text-xs mt-1">
                    <Upload className="w-3.5 h-3.5 mr-1" /> {uploading.iban ? "Subiendo..." : "Adjuntar IBAN"}
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleGuardar} disabled={upsertMutation.isPending} className="bg-purple-700 hover:bg-purple-800">
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
              <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
            </div>
          </div>
        ) : docs ? (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {campos.map(campo => docs[campo.key] ? (
              <div key={campo.key} className="bg-white border border-purple-100 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium mb-1">{campo.label}</p>
                <p className="text-gray-800 font-semibold">{docs[campo.key]}</p>
              </div>
            ) : null)}
            {docs.dni_archivos?.length > 0 && (
              <div className="bg-white border border-purple-100 rounded-lg p-3 md:col-span-2">
                <p className="text-xs text-gray-500 font-medium mb-2">Archivos DNI</p>
                <div className="flex gap-2 flex-wrap">
                  {docs.dni_archivos.map((a, idx) => (
                    <a key={idx} href={a.url} download={a.nombre}>
                      <Button size="sm" variant="outline" className="text-xs border-purple-300 text-purple-700">
                        <Download className="w-3 h-3 mr-1" /> {a.nombre}
                      </Button>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {docs.iban_archivo_url && (
              <div className="bg-white border border-purple-100 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-medium mb-1">Archivo IBAN</p>
                <a href={docs.iban_archivo_url} download>
                  <Button size="sm" variant="outline" className="text-xs border-purple-300 text-purple-700"><Download className="w-3 h-3 mr-1" /> Descargar</Button>
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <FolderOpen className="w-10 h-10 mx-auto text-purple-300 mb-2" />
            <p className="text-sm text-gray-500">No hay documentos. Haz clic en "Editar" para añadir.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}