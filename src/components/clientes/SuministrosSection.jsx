import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, FileText, Edit2, Check, X, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SuministrosSection({ cliente, onUpdate, isOwnerOrAdmin }) {
  const [suministros, setSuministros] = useState(cliente.suministros || []);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [nuevoSuministro, setNuevoSuministro] = useState({
    nombre: "",
    tipo_factura: "3.0"
  });

  const handleOpenCreateDialog = () => {
    setNuevoSuministro({ nombre: "", tipo_factura: "3.0" });
    setShowCreateDialog(true);
  };

  const handleCreateSuministro = () => {
    if (!nuevoSuministro.nombre.trim()) {
      toast.error("El nombre del suministro es obligatorio");
      return;
    }

    const nuevoId = Date.now().toString();
    const nuevosSuministros = [
      ...suministros,
      {
        id: nuevoId,
        nombre: nuevoSuministro.nombre,
        tipo_factura: nuevoSuministro.tipo_factura,
        facturas: [],
        cerrado: false
      }
    ];
    
    // Si el cliente estaba cerrado, cambiar a "Esperando facturas" al añadir nuevo suministro
    const estadoCerrado = cliente.estado === "Firmado con éxito";
    const updateData = estadoCerrado 
      ? { suministros: nuevosSuministros, estado: "Esperando facturas" }
      : { suministros: nuevosSuministros };
    
    setSuministros(nuevosSuministros);
    onUpdate(updateData);
    setShowCreateDialog(false);
    toast.success(estadoCerrado ? "Suministro añadido - Cliente reactivado" : "Suministro añadido");
  };

  const handleDeleteSuministro = (suministroId) => {
    if (!window.confirm("¿Eliminar este suministro y todas sus facturas?")) return;
    const nuevosSuministros = suministros.filter(s => s.id !== suministroId);
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success("Suministro eliminado");
  };

  const handleEditName = (suministro) => {
    setEditingId(suministro.id);
    setEditingName(suministro.nombre);
  };

  const handleSaveName = (suministroId) => {
    const nuevosSuministros = suministros.map(s => {
      if (s.id === suministroId) {
        let suministroActualizado = { ...s, nombre: editingName };
        // LIMPIEZA PREVENTIVA
        if (s.informe_final) {
          const archivosValidos = s.informe_final.archivos?.filter(a => 
            a && a.url && a.url.trim() && a.url !== 'null'
          ) || [];
          const tieneUrlLegacy = s.informe_final.url && 
            s.informe_final.url.trim() && s.informe_final.url !== 'null';

          if (archivosValidos.length === 0 && !tieneUrlLegacy) {
            const { informe_final, ...resto } = suministroActualizado;
            return resto;
          }
        }
        return suministroActualizado;
      }
      return s;
    });
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    setEditingId(null);
    toast.success("Nombre actualizado");
  };



  const handleDeleteFactura = (suministroId, facturaIndex) => {
    const nuevosSuministros = suministros.map(s => {
      if (s.id === suministroId) {
        const nuevasFacturas = s.facturas.filter((_, idx) => idx !== facturaIndex);

        let suministroActualizado = { ...s, facturas: nuevasFacturas };
        // LIMPIEZA PREVENTIVA
        if (s.informe_final) {
          const archivosValidos = s.informe_final.archivos?.filter(a => 
            a && a.url && a.url.trim() && a.url !== 'null'
          ) || [];
          const tieneUrlLegacy = s.informe_final.url && 
            s.informe_final.url.trim() && s.informe_final.url !== 'null';

          if (archivosValidos.length === 0 && !tieneUrlLegacy) {
            const { informe_final, ...resto } = suministroActualizado;
            return resto;
          }
        }
        return suministroActualizado;
      }
      return s;
    });
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success("Factura eliminada");
  };

  const getTipoColor = (tipo) => {
    switch(tipo) {
      case "6.1": return "bg-red-600 text-white";
      case "3.0": return "bg-orange-600 text-white";
      case "2.0": return "bg-blue-600 text-white";
      default: return "bg-gray-600 text-white";
    }
  };

  const suministrosActivos = suministros.filter(s => !s.cerrado);
  const suministrosCerrados = suministros.filter(s => s.cerrado);

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-[#004D9D] flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Suministros del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suministros.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay suministros. Añade uno para empezar.</p>
          </div>
        ) : (
          <>
            {/* Suministros Activos */}
            {suministrosActivos.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#004D9D] text-sm">Suministros Activos</h3>
                {suministrosActivos.map((suministro, idx) => (
            <Card key={suministro.id} className="bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {editingId === suministro.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Ej: Casa, Restaurante"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveName(suministro.id)}
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="h-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-[#004D9D]">{suministro.nombre}</h3>
                        {isOwnerOrAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditName(suministro)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getTipoColor(suministro.tipo_factura)}>
                      {suministro.tipo_factura}
                    </Badge>
                    <Badge variant="outline">
                      {(suministro.facturas || []).length}/3 facturas
                    </Badge>
                    {isOwnerOrAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSuministro(suministro.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(suministro.facturas || []).map((factura, facturaIdx) => (
                  <div
                    key={facturaIdx}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm truncate">{factura.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={factura.url}
                        download={factura.nombre}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Descargar
                      </a>
                      {isOwnerOrAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFactura(suministro.id, facturaIdx)}
                          className="h-6 w-6 p-0 text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {isOwnerOrAdmin && (suministro.facturas || []).length < 3 && (
                  <div>
                    <input
                      type="file"
                      id={`upload-${suministro.id}`}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        const remaining = 3 - (suministro.facturas || []).length;
                        const filesToUpload = files.slice(0, remaining);
                        
                        // Subir todos los archivos en paralelo
                        toast.loading(`Subiendo ${filesToUpload.length} archivo(s)...`, { id: `upload-${suministro.id}` });
                        
                        try {
                          const uploads = await Promise.all(
                            filesToUpload.map(file => base44.integrations.Core.UploadFile({ file }))
                          );
                          
                          const nuevosSuministros = suministros.map(s => {
                            if (s.id === suministro.id) {
                              const nuevasFacturas = [
                                ...(s.facturas || []),
                                ...uploads.map((upload, idx) => ({
                                  nombre: filesToUpload[idx].name,
                                  url: upload.file_url,
                                  fecha_subida: new Date().toISOString(),
                                  tipo_archivo: filesToUpload[idx].type
                                }))
                              ];

                              // LIMPIEZA PREVENTIVA: Eliminar informe_final corrupto
                              let suministroActualizado = { ...s, facturas: nuevasFacturas };
                              if (s.informe_final) {
                                const archivosValidos = s.informe_final.archivos?.filter(a => 
                                  a && a.url && a.url.trim() && a.url !== 'null'
                                ) || [];
                                const tieneUrlLegacy = s.informe_final.url && 
                                  s.informe_final.url.trim() && s.informe_final.url !== 'null';

                                if (archivosValidos.length === 0 && !tieneUrlLegacy) {
                                  const { informe_final, ...resto } = suministroActualizado;
                                  suministroActualizado = resto;
                                }
                              }
                              return suministroActualizado;
                            }
                            return s;
                          });

                          setSuministros(nuevosSuministros);
                          onUpdate({ suministros: nuevosSuministros });
                          toast.success(`${filesToUpload.length} factura(s) subida(s)`, { id: `upload-${suministro.id}` });
                        } catch (error) {
                          console.error("Error uploading:", error);
                          toast.error("Error al subir facturas", { id: `upload-${suministro.id}` });
                        }
                        
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById(`upload-${suministro.id}`).click()}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Añadir Factura(s) ({(suministro.facturas || []).length}/3)
                    </Button>
                  </div>
                )}

                {suministro.informe_final && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">📄 Informe(s) Final(es):</p>
                    {suministro.informe_final.archivos && suministro.informe_final.archivos.length > 0 ? (
                      <div className="space-y-2">
                        {suministro.informe_final.archivos.map((archivo, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded">
                            <span className="text-sm text-green-700 truncate">{archivo.nombre}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(archivo.url, '_blank')}
                              className="text-xs text-green-600 hover:text-green-700 h-auto py-1 px-2"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Descargar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : suministro.informe_final.url ? (
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded">
                        <span className="text-sm text-green-700">{suministro.informe_final.nombre || 'Informe final'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(suministro.informe_final.url, '_blank')}
                          className="text-xs text-green-600 hover:text-green-700 h-auto py-1 px-2"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Descargar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
                ))}
              </div>
            )}

            {/* Suministros Cerrados */}
            {suministrosCerrados.length > 0 && (
              <div className="space-y-4 mt-6 pt-6 border-t-2 border-green-300">
                <h3 className="font-semibold text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Suministros Cerrados y Comisionados
                </h3>
                {suministrosCerrados.map((suministro) => (
                  <Card key={suministro.id} className="bg-green-50 border-green-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-green-800">{suministro.nombre}</h3>
                          <Badge className="bg-green-600 text-white">Cerrado</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getTipoColor(suministro.tipo_factura)}>
                            {suministro.tipo_factura}
                          </Badge>
                          {suministro.comision && (
                            <Badge className="bg-yellow-600 text-white">
                              {suministro.comision}€
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {suministro.fecha_cierre_suministro && (
                        <p className="text-xs text-green-700">
                          📅 Cerrado: {new Date(suministro.fecha_cierre_suministro).toLocaleDateString('es-ES')}
                        </p>
                      )}
                      {suministro.informe_final && (
                        <div className="mt-2">
                          <p className="text-xs text-green-700 mb-2 font-semibold">📄 Informe(s):</p>
                          {suministro.informe_final.archivos && suministro.informe_final.archivos.length > 0 ? (
                            <div className="space-y-2">
                              {suministro.informe_final.archivos.map((archivo, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white border border-green-300 p-2 rounded">
                                  <span className="text-sm text-green-800 truncate">{archivo.nombre}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(archivo.url, '_blank')}
                                    className="text-xs text-green-700 hover:text-green-800"
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    Ver
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : suministro.informe_final.url ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(suministro.informe_final.url, '_blank')}
                              className="text-xs text-green-700"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Ver informe
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {isOwnerOrAdmin && (
          <Button
            onClick={handleOpenCreateDialog}
            variant="outline"
            className="w-full border-dashed border-2 border-blue-300 text-[#004D9D]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Nuevo Suministro
          </Button>
        )}
      </CardContent>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">Nuevo Suministro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre del suministro *</label>
              <Input
                value={nuevoSuministro.nombre}
                onChange={(e) => setNuevoSuministro({ ...nuevoSuministro, nombre: e.target.value })}
                placeholder="Ej: Casa, Restaurante, Local 1"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo de factura *</label>
              <Select
                value={nuevoSuministro.tipo_factura}
                onValueChange={(value) => setNuevoSuministro({ ...nuevoSuministro, tipo_factura: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6.1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-600 text-white text-xs">6.1</Badge>
                      <span>Máxima prioridad</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="3.0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-600 text-white text-xs">3.0</Badge>
                      <span>Alta prioridad</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="2.0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white text-xs">2.0</Badge>
                      <span>Prioridad media</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSuministro} className="bg-[#004D9D] hover:bg-[#00AEEF]">
              Crear Suministro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}