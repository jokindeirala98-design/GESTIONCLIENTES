import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Zap, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClienteFichaModal({ cups, onClose }) {
  const isOpen = !!cups;

  // Buscar DocumentosCliente por CUPS
  const { data: docsList = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["docs_por_cups", cups],
    queryFn: () => base44.entities.DocumentosCliente.filter({ cups }),
    enabled: isOpen,
  });

  const doc = docsList[0] || null;

  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ["cliente_modal", doc?.cliente_id],
    queryFn: () => base44.entities.Cliente.get(doc.cliente_id),
    enabled: !!doc?.cliente_id,
  });

  const isLoading = loadingDocs || loadingCliente;

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

  return (
    <Dialog open={!!cups} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Ficha del Cliente — CUPS: {cups}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : !doc ? (
          <div className="py-12 text-center text-gray-400">
            <p>No se encontró ningún cliente asociado a este CUPS.</p>
            <p className="text-xs mt-1 text-gray-300">Solo están vinculados los clientes procesados automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Datos del cliente */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-[#004D9D] mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Datos del Cliente
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Negocio", value: cliente?.nombre_negocio },
                  { label: "Cliente", value: cliente?.nombre_cliente },
                  { label: "Teléfono", value: cliente?.telefono },
                  { label: "Email", value: cliente?.email },
                  { label: "Estado", value: cliente?.estado },
                ].filter(f => f.value).map(field => (
                  <div key={field.label} className="bg-white border border-blue-100 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 font-medium">{field.label}</p>
                    <p className="text-gray-800 font-semibold text-sm mt-0.5">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Documentos del cliente */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" /> Documentos del Cliente
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "CUPS", value: doc.cups },
                  { label: "CIF", value: doc.cif },
                  { label: "Nombre empresa", value: doc.nombre_empresa },
                  { label: "Consumo anual (kWh)", value: doc.consumo_anual },
                  { label: "Dirección fiscal", value: doc.direccion_fiscal },
                  { label: "Teléfono", value: doc.telefono },
                  { label: "IBAN", value: doc.iban },
                  { label: "Email", value: doc.email },
                  { label: "DNI/NIE", value: doc.dni_texto },
                ].filter(f => f.value).map(field => (
                  <div key={field.label} className="bg-white border border-purple-100 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 font-medium">{field.label}</p>
                    <p className="text-gray-800 font-semibold text-sm mt-0.5">{field.value}</p>
                  </div>
                ))}
                {doc.cif_archivo_url && (
                  <div className="bg-white border border-purple-100 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 font-medium mb-1">Archivo CIF</p>
                    <a href={doc.cif_archivo_url} download>
                      <Button size="sm" variant="outline" className="text-xs border-purple-300 text-purple-700">
                        <Download className="w-3 h-3 mr-1" /> Descargar
                      </Button>
                    </a>
                  </div>
                )}
                {doc.iban_archivo_url && (
                  <div className="bg-white border border-purple-100 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 font-medium mb-1">Archivo IBAN</p>
                    <a href={doc.iban_archivo_url} download>
                      <Button size="sm" variant="outline" className="text-xs border-purple-300 text-purple-700">
                        <Download className="w-3 h-3 mr-1" /> Descargar
                      </Button>
                    </a>
                  </div>
                )}
              </div>
              {doc.dni_archivos?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">Archivos DNI</p>
                  <div className="flex gap-2 flex-wrap">
                    {doc.dni_archivos.map((a, idx) => (
                      <a key={idx} href={a.url} download={a.nombre}>
                        <Button size="sm" variant="outline" className="text-xs border-purple-300 text-purple-700">
                          <Download className="w-3 h-3 mr-1" /> {a.nombre}
                        </Button>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suministros: Facturas e Informes */}
            {cliente?.suministros?.length > 0 && (
              <div>
                <h3 className="font-semibold text-[#004D9D] mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Suministros, Facturas e Informes
                </h3>
                <div className="space-y-4">
                  {cliente.suministros.map((suministro) => {
                    const tieneInformeFinal = !!(suministro.informe_final?.archivos?.some(a => a?.url && a.url !== 'null') || (suministro.informe_final?.url && suministro.informe_final.url !== 'null'));
                    return (
                      <div key={suministro.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                          <span className="font-semibold text-sm text-gray-800">{suministro.nombre}</span>
                          <Badge className={getTipoColor(suministro.tipo_factura)}>{suministro.tipo_factura}</Badge>
                          {suministro.cerrado && <Badge className="bg-green-600 text-white">Cerrado</Badge>}
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-4">
                          {/* Facturas */}
                          <div>
                            <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> Facturas ({(suministro.facturas || []).length})
                            </p>
                            {(suministro.facturas || []).length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Sin facturas</p>
                            ) : (
                              <div className="space-y-1">
                                {suministro.facturas.map((factura, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded text-xs">
                                    <span className="truncate flex-1 text-gray-700">{factura.nombre}</span>
                                    <a href={factura.url} download={factura.nombre} className="text-blue-600 hover:text-blue-800 ml-2">
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Informes */}
                          <div className="space-y-2">
                            {/* Potencias */}
                            <div className="rounded-lg border p-2 bg-yellow-50 border-yellow-200">
                              <p className="text-xs font-semibold text-yellow-800 mb-1">⚡ Informe de Potencias</p>
                              {suministro.potencias_ignorado ? (
                                <p className="text-xs text-gray-500 italic">Omitido</p>
                              ) : suministro.informe_potencias ? (
                                <div className="flex items-center justify-between bg-white border border-yellow-300 p-1.5 rounded">
                                  <span className="text-xs text-yellow-700 truncate flex-1">{suministro.informe_potencias.nombre}</span>
                                  <a href={suministro.informe_potencias.url} download={suministro.informe_potencias.nombre} className="text-yellow-600 hover:text-yellow-800 ml-2">
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">Pendiente</p>
                              )}
                            </div>

                            {/* Informe final */}
                            <div className="rounded-lg border p-2 bg-green-50 border-green-200">
                              <p className="text-xs font-semibold text-green-800 mb-1">📄 Informe Final</p>
                              {tieneInformeFinal ? (
                                <div className="space-y-1">
                                  {suministro.informe_final?.archivos?.filter(a => a?.url && a.url !== 'null').map((archivo, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white border border-green-300 p-1.5 rounded">
                                      <span className="text-xs text-green-700 truncate flex-1">{archivo.nombre}</span>
                                      <a href={archivo.url} download={archivo.nombre} className="text-green-600 hover:text-green-800 ml-2">
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  ))}
                                  {suministro.informe_final?.url && suministro.informe_final.url !== 'null' && !suministro.informe_final?.archivos?.length && (
                                    <div className="flex items-center justify-between bg-white border border-green-300 p-1.5 rounded">
                                      <span className="text-xs text-green-700 truncate flex-1">{suministro.informe_final.nombre || 'Informe final'}</span>
                                      <a href={suministro.informe_final.url} download={suministro.informe_final.nombre} className="text-green-600 hover:text-green-800 ml-2">
                                        <Download className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">Pendiente</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}