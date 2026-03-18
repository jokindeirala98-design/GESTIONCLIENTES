import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, FileText, Edit2, Check, X, Download, CheckCircle2, Zap, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SuministrosSection({ cliente, onUpdate, isOwnerOrAdmin }) {
  const [suministros, setSuministros] = useState(cliente.suministros || []);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const isEditingRef = useRef(false);

  // Sync local state when cliente.suministros changes, but NOT while editing a name
  useEffect(() => {
    if (!isEditingRef.current) {
      setSuministros(cliente.suministros || []);
    }
  }, [cliente.suministros]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [nuevoSuministro, setNuevoSuministro] = useState({ nombre: "", energia: "", tipo_factura: "" });
  const [zipWarning, setZipWarning] = useState(null); // { suministro, files }
  const [facturaExtra, setFacturaExtra] = useState(null);

  const tarifasLuz = ["2.0", "3.0", "6.1", "6.2"];
  const tarifasGas = ["RL1", "RL2", "RL3", "RL4", "RL5", "RL6"];

  const esGas = (tipo) => ["RL1","RL2","RL3","RL4","RL5","RL6"].includes(tipo);

  const handleCreateSuministro = async () => {
    if (!nuevoSuministro.nombre.trim()) { toast.error("El nombre del suministro es obligatorio"); return; }
    if (!nuevoSuministro.tipo_factura) { toast.error("Selecciona el tipo de tarifa"); return; }

    const nuevoId = Date.now().toString();
    const esGasSuministro = esGas(nuevoSuministro.tipo_factura);
    const nuevosSuministros = [...suministros, {
      id: nuevoId,
      nombre: nuevoSuministro.nombre,
      tipo_factura: nuevoSuministro.tipo_factura,
      facturas: [],
      cerrado: false,
      // Gas: potencias siempre omitidas
      ...(esGasSuministro ? { potencias_ignorado: true } : {})
    }];
    const estadoCerrado = cliente.estado === "Firmado con éxito";
    setSuministros(nuevosSuministros);
    onUpdate(estadoCerrado ? { suministros: nuevosSuministros, estado: "Esperando facturas" } : { suministros: nuevosSuministros });
    setShowCreateDialog(false);
    toast.success(estadoCerrado ? "Suministro añadido - Cliente reactivado" : "Suministro añadido");

    // La tarea de prescoring y el PrescoringGALP se crean automáticamente al subir la factura
    // (función processInvoiceAndCreatePrescoring extrae el CUPS y crea la entrada)
  };

  const handleDeleteSuministro = (suministroId) => {
    if (!window.confirm("¿Eliminar este suministro y todas sus facturas?")) return;
    const nuevosSuministros = suministros.filter(s => s.id !== suministroId);
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success("Suministro eliminado");
  };

  const handleSaveName = async (suministroId) => {
    if (!editingName.trim()) { toast.error("El nombre no puede estar vacío"); return; }
    const nuevosSuministros = suministros.map(s => s.id === suministroId ? { ...s, nombre: editingName.trim() } : s);
    setSuministros(nuevosSuministros);
    setEditingId(null);
    try {
      await base44.entities.Cliente.update(cliente.id, { suministros: nuevosSuministros });
      toast.success("Nombre actualizado");
    } catch (e) {
      toast.error("Error al guardar el nombre");
    } finally {
      isEditingRef.current = false;
    }
  };

  const handleIgnorarPotencias = (suministroId) => {
    const nuevosSuministros = suministros.map(s => 
      s.id === suministroId ? { ...s, potencias_ignorado: !s.potencias_ignorado } : s
    );
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success(nuevosSuministros.find(s => s.id === suministroId).potencias_ignorado ? "Informe de potencias omitido" : "Informe de potencias requerido");
  };

  const handleDeleteFactura = (suministroId, facturaIndex) => {
    const nuevosSuministros = suministros.map(s => {
      if (s.id !== suministroId) return s;
      return { ...s, facturas: s.facturas.filter((_, idx) => idx !== facturaIndex) };
    });
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success("Factura eliminada");
  };

  const handleUploadFacturas = async (suministro, files) => {
    const remaining = 3 - (suministro.facturas || []).length;
    const filesToUpload = Array.from(files).slice(0, remaining);
    toast.loading(`Subiendo ${filesToUpload.length} archivo(s)...`, { id: `upload-${suministro.id}` });

    const newFacturas = [];
    for (const file of filesToUpload) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newFacturas.push({ nombre: file.name, url: file_url, fecha_subida: new Date().toISOString(), tipo_archivo: file.type });

      // Process invoice: extract CUPS + create PrescoringGALP if needed (non-blocking)
      base44.functions.invoke('processInvoiceAndCreatePrescoring', {
        file_url,
        cliente_id: cliente.id,
        suministro_id: suministro.id,
        suministro_tipo_factura: suministro.tipo_factura,
      }).catch(e => console.warn("processInvoice error:", e));
    }

    const nuevosSuministros = suministros.map(s => {
      if (s.id !== suministro.id) return s;
      return { ...s, facturas: [...(s.facturas || []), ...newFacturas] };
    });
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success(`${filesToUpload.length} factura(s) subida(s)`, { id: `upload-${suministro.id}` });
  };

  const getTipoColor = (tipo) => {
    if (["RL1","RL2","RL3","RL4","RL5","RL6"].includes(tipo)) return "bg-green-600 text-white";
    switch(tipo) {
      case "6.2": return "bg-purple-600 text-white";
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
            {suministrosActivos.length > 0 && (
              <div className="space-y-6">
                <h3 className="font-semibold text-[#004D9D] text-sm">Suministros Activos</h3>
                {suministrosActivos.map((suministro) => {
                  const tienePotencias = !!(suministro.informe_potencias || suministro.potencias_ignorado);
                  const tieneInformeFinal = !!(suministro.informe_final?.archivos?.some(a => a?.url && a.url !== 'null') || (suministro.informe_final?.url && suministro.informe_final.url !== 'null'));

                  return (
                    <Card key={suministro.id} className="bg-white overflow-hidden">
                      {/* Cabecera del suministro */}
                      <CardHeader className="pb-0 pt-4 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            {editingId === suministro.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(suministro.id); if (e.key === 'Escape') { isEditingRef.current = false; setEditingId(null); } }} />
                                <Button size="sm" onClick={() => handleSaveName(suministro.id)} className="h-8 bg-green-600 hover:bg-green-700"><Check className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => { isEditingRef.current = false; setEditingId(null); }} className="h-8"><X className="w-4 h-4" /></Button>
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-[#004D9D]">{suministro.nombre}</h3>
                                  {isOwnerOrAdmin && <Button size="sm" variant="ghost" onClick={() => { isEditingRef.current = true; setEditingId(suministro.id); setEditingName(suministro.nombre); }} className="h-6 w-6 p-0"><Edit2 className="w-3 h-3" /></Button>}
                                </div>
                                {suministro.cups && (
                                  <p className="text-xs text-gray-400 font-mono mt-0.5">{suministro.cups}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getTipoColor(suministro.tipo_factura)}>{suministro.tipo_factura}</Badge>
                            {isOwnerOrAdmin && <Button size="sm" variant="ghost" onClick={() => handleDeleteSuministro(suministro.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>}
                          </div>
                        </div>
                      </CardHeader>

                      {/* Dos columnas: Facturas | Informes */}
                      <CardContent className="p-4">
                        <div className="grid md:grid-cols-2 gap-4 mt-2">

                          {/* COLUMNA IZQUIERDA: Facturas */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <h4 className="text-sm font-semibold text-blue-800">Facturas</h4>
                              <Badge variant="outline" className="text-xs">{(suministro.facturas || []).length}/3</Badge>
                            </div>

                            {(suministro.facturas || []).length === 0 ? (
                              <p className="text-xs text-gray-400 italic py-2">Sin facturas adjuntas</p>
                            ) : (
                              <div className="space-y-1">
                                {suministro.facturas.map((factura, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded text-sm">
                                    <span className="truncate flex-1 text-xs text-gray-700">{factura.nombre}</span>
                                    <div className="flex items-center gap-1 ml-2">
                                      <a href={factura.url} download={factura.nombre} className="text-blue-600 hover:text-blue-800">
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                      {isOwnerOrAdmin && (
                                        <button onClick={() => handleDeleteFactura(suministro.id, idx)} className="text-red-400 hover:text-red-600 ml-1">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isOwnerOrAdmin && (suministro.facturas || []).length < 3 && (
                              <>
                                <input type="file" id={`upload-${suministro.id}`} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.zip" multiple onChange={async (e) => { await handleUploadFacturas(suministro, e.target.files); e.target.value = ""; }} />
                                <Button size="sm" variant="outline" onClick={() => document.getElementById(`upload-${suministro.id}`).click()} className="w-full text-xs h-7 border-blue-300 text-blue-700">
                                  <Upload className="w-3.5 h-3.5 mr-1" /> Añadir factura(s)
                                </Button>
                              </>
                            )}
                          </div>

                          {/* COLUMNA DERECHA: Informes */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-4 h-4 text-yellow-600" />
                              <h4 className="text-sm font-semibold text-yellow-800">Informes</h4>
                            </div>

                            {/* Informe de Potencias - solo para luz */}
                            {!esGas(suministro.tipo_factura) && (
                              <div className="rounded-lg border p-2 bg-yellow-50 border-yellow-200">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-yellow-800">⚡ Informe de Potencias</p>
                                </div>
                                {suministro.potencias_ignorado ? (
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500 italic">Omitido</p>
                                    {isOwnerOrAdmin && (
                                      <Button size="sm" variant="ghost" onClick={() => handleIgnorarPotencias(suministro.id)} className="h-6 p-0 text-xs text-amber-600 hover:text-amber-800">
                                        <SkipForward className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                ) : suministro.informe_potencias ? (
                                  <a href={suministro.informe_potencias.url} download={suministro.informe_potencias.nombre} className="flex items-center gap-2 bg-white border border-yellow-300 p-2 rounded hover:bg-yellow-50 transition-colors">
                                    <Download className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                    <span className="text-xs text-yellow-700 truncate flex-1">{suministro.informe_potencias.nombre}</span>
                                    {isOwnerOrAdmin && (
                                      <button onClick={(e) => { e.preventDefault(); handleIgnorarPotencias(suministro.id); }} className="text-red-400 hover:text-red-600 ml-1">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </a>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400 italic">Pendiente (José lo adjuntará)</p>
                                    {isOwnerOrAdmin && (
                                      <Button size="sm" variant="outline" onClick={() => handleIgnorarPotencias(suministro.id)} className="h-6 p-1 text-xs text-gray-600 hover:bg-yellow-100">
                                        <SkipForward className="w-3 h-3 mr-0.5" /> Omitir
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Informe Económico */}
                            <div className="rounded-lg border p-2 bg-green-50 border-green-200">
                              <p className="text-xs font-semibold text-green-800 mb-2">📄 Informe Económico</p>
                              {tieneInformeFinal ? (
                                <div className="space-y-1.5">
                                  {suministro.informe_final?.archivos?.filter(a => a?.url && a.url !== 'null').map((archivo, idx) => (
                                    <a
                                      key={idx}
                                      href={archivo.url}
                                      download={archivo.nombre}
                                      className="flex items-center gap-2 bg-white border border-green-300 p-2 rounded hover:bg-green-100 transition-colors active:bg-green-200"
                                    >
                                      <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      <span className="text-xs text-green-700 truncate flex-1 min-w-0">{archivo.nombre}</span>
                                      <Download className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    </a>
                                  ))}
                                  {suministro.informe_final?.url && suministro.informe_final.url !== 'null' && !suministro.informe_final?.archivos?.length && (
                                    <a
                                      href={suministro.informe_final.url}
                                      download={suministro.informe_final.nombre}
                                      className="flex items-center gap-2 bg-white border border-green-300 p-2 rounded hover:bg-green-100 transition-colors active:bg-green-200"
                                    >
                                      <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      <span className="text-xs text-green-700 truncate flex-1 min-w-0">{suministro.informe_final.nombre || 'Informe económico'}</span>
                                      <Download className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    </a>
                                  )}
                                  {suministro.informe_final?.notas_admin && (
                                    <div className="bg-blue-50 border border-blue-200 rounded p-1.5 mt-1">
                                      <p className="text-xs font-semibold text-blue-700">📝 Nota admin:</p>
                                      <p className="text-xs text-blue-600">{suministro.informe_final.notas_admin}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">
                                  {esGas(suministro.tipo_factura)
                                    ? "Pendiente (admin lo adjuntará)"
                                    : tienePotencias ? "Pendiente (Nicolás lo adjuntará)" : "Esperando informe de potencias"}
                                </p>
                              )}
                            </div>
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {suministrosCerrados.length > 0 && (
              <div className="space-y-4 mt-6 pt-6 border-t-2 border-green-300">
                <h3 className="font-semibold text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Suministros Cerrados y Comisionados
                </h3>
                {suministrosCerrados.map((suministro) => (
                  <Card key={suministro.id} className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-green-800">{suministro.nombre}</h3>
                          <Badge className="bg-green-600 text-white">Cerrado</Badge>
                          <Badge className={getTipoColor(suministro.tipo_factura)}>{suministro.tipo_factura}</Badge>
                          {suministro.comision && <Badge className="bg-yellow-600 text-white">{suministro.comision}€</Badge>}
                        </div>
                      </div>
                      {suministro.fecha_cierre_suministro && (
                        <p className="text-xs text-green-700 mb-2">📅 Cerrado: {new Date(suministro.fecha_cierre_suministro).toLocaleDateString('es-ES')}</p>
                      )}
                      {suministro.informe_final && (
                        <div className="space-y-1">
                          <p className="text-xs text-green-700 font-semibold">📄 Informe(s) económico(s):</p>
                          {suministro.informe_final.archivos?.filter(a => a?.url).map((archivo, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white border border-green-300 p-2 rounded">
                              <span className="text-sm text-green-800 truncate">{archivo.nombre}</span>
                              <a href={archivo.url} download={archivo.nombre} className="text-green-600 hover:text-green-800"><Download className="w-4 h-4" /></a>
                            </div>
                          ))}
                          {suministro.informe_final.url && !suministro.informe_final.archivos?.length && (
                            <a href={suministro.informe_final.url} download={suministro.informe_final.nombre} className="text-green-600 hover:underline text-sm flex items-center gap-1">
                              <Download className="w-4 h-4" /> Ver informe
                            </a>
                          )}
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
          <Button onClick={() => { setNuevoSuministro({ nombre: "", energia: "", tipo_factura: "" }); setShowCreateDialog(true); }} variant="outline" className="w-full border-dashed border-2 border-blue-300 text-[#004D9D]">
            <Plus className="w-4 h-4 mr-2" /> Añadir Nuevo Suministro
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
              <Input value={nuevoSuministro.nombre} onChange={(e) => setNuevoSuministro({ ...nuevoSuministro, nombre: e.target.value })} placeholder="Ej: Casa, Restaurante, Local 1" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Energía *</label>
              <div className="flex gap-3">
                {["luz", "gas"].map(e => (
                  <button key={e} type="button" onClick={() => setNuevoSuministro({ ...nuevoSuministro, energia: e, tipo_factura: "" })}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${nuevoSuministro.energia === e ? "border-[#004D9D] bg-[#004D9D] text-white" : "border-gray-200 text-gray-600 hover:border-[#004D9D]"}`}>
                    {e === "luz" ? "⚡ Luz" : "🔥 Gas"}
                  </button>
                ))}
              </div>
            </div>
            {nuevoSuministro.energia && (
              <div>
                <label className="text-sm font-medium mb-2 block">Tarifa *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(nuevoSuministro.energia === "luz" ? tarifasLuz : tarifasGas).map(t => (
                    <button key={t} type="button" onClick={() => setNuevoSuministro({ ...nuevoSuministro, tipo_factura: t })}
                      className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${nuevoSuministro.tipo_factura === t ? "border-[#004D9D] bg-[#004D9D] text-white" : "border-gray-200 text-gray-600 hover:border-[#004D9D]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateSuministro} className="bg-[#004D9D] hover:bg-[#00AEEF]">Crear Suministro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}