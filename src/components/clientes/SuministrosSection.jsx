import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, FileText, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function SuministrosSection({ cliente, onUpdate, isOwnerOrAdmin }) {
  const [suministros, setSuministros] = useState(cliente.suministros || []);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const handleAddSuministro = () => {
    const nuevoId = Date.now().toString();
    const nuevosSuministros = [
      ...suministros,
      {
        id: nuevoId,
        nombre: `Suministro ${suministros.length + 1}`,
        facturas: []
      }
    ];
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
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
    const nuevosSuministros = suministros.map(s =>
      s.id === suministroId ? { ...s, nombre: editingName } : s
    );
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    setEditingId(null);
    toast.success("Nombre actualizado");
  };

  const handleUploadFactura = async (suministroId, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const nuevosSuministros = suministros.map(s => {
        if (s.id === suministroId) {
          const nuevasFacturas = [
            ...(s.facturas || []),
            {
              nombre: file.name,
              url: file_url,
              fecha_subida: new Date().toISOString(),
              tipo_archivo: file.type
            }
          ];
          return { ...s, facturas: nuevasFacturas };
        }
        return s;
      });

      setSuministros(nuevosSuministros);
      onUpdate({ suministros: nuevosSuministros });
      toast.success("Factura subida correctamente");
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Error al subir la factura");
    }
  };

  const handleDeleteFactura = (suministroId, facturaIndex) => {
    const nuevosSuministros = suministros.map(s => {
      if (s.id === suministroId) {
        const nuevasFacturas = s.facturas.filter((_, idx) => idx !== facturaIndex);
        return { ...s, facturas: nuevasFacturas };
      }
      return s;
    });
    setSuministros(nuevosSuministros);
    onUpdate({ suministros: nuevosSuministros });
    toast.success("Factura eliminada");
  };

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
          suministros.map((suministro, idx) => (
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
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver
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
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleUploadFactura(suministro.id, file);
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
                      Añadir Factura ({(suministro.facturas || []).length}/3)
                    </Button>
                  </div>
                )}

                {suministro.informe_final && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2 font-semibold">📄 Informe Final:</p>
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded">
                      <span className="text-sm text-green-700">{suministro.informe_final.nombre}</span>
                      <a
                        href={suministro.informe_final.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        Descargar
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}

        {isOwnerOrAdmin && (
          <Button
            onClick={handleAddSuministro}
            variant="outline"
            className="w-full border-dashed border-2 border-blue-300 text-[#004D9D]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Nuevo Suministro
          </Button>
        )}
      </CardContent>
    </Card>
  );
}