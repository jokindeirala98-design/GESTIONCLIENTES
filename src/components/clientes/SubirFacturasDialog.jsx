import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";

export default function SubirFacturasDialog({ open, onClose, cliente, user }) {
  const queryClient = useQueryClient();
  const [archivos, setArchivos] = useState([]);
  const [tipoFactura, setTipoFactura] = useState("");
  const [uploading, setUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cliente', cliente.id]);
      queryClient.invalidateQueries(['clientes']);
      setArchivos([]); // Reset state
      setTipoFactura(""); // Reset state
      onClose(); // Close dialog after success
    },
  });

  const enviarNotificacionAdmins = async (clienteNombre) => {
    const usuarios = await base44.entities.User.list();
    const admins = usuarios.filter(u => u.role === 'admin' && u.notificaciones_email);
    
    for (const admin of admins) {
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `Nuevas facturas presentadas - ${clienteNombre}`,
        body: `${user.iniciales || user.full_name} ha presentado las facturas de ${clienteNombre}.`
      });
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const facturasActuales = cliente.facturas || [];
    const espacioDisponible = 3 - facturasActuales.length;
    
    if (files.length > espacioDisponible) {
      toast.error(`Solo puedes subir ${espacioDisponible} archivo(s) más`);
      return;
    }
    
    setArchivos(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (archivos.length === 0) {
      toast.error("Selecciona al menos un archivo");
      return;
    }
    
    if (!tipoFactura) {
      toast.error("Selecciona el tipo de factura");
      return;
    }

    setUploading(true);
    
    try {
      const facturasSubidas = [];
      
      for (const archivo of archivos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: archivo });
        facturasSubidas.push({
          nombre: archivo.name,
          url: file_url,
          fecha_subida: new Date().toISOString(),
          tipo_archivo: archivo.type
        });
      }

      const facturasActuales = cliente.facturas || [];
      const nuevasFacturas = [...facturasActuales, ...facturasSubidas];

      await updateMutation.mutateAsync({
        id: cliente.id,
        data: {
          facturas: nuevasFacturas,
          tipo_factura: tipoFactura,
          estado: "Facturas presentadas"
        }
      });

      await enviarNotificacionAdmins(cliente.nombre_negocio);

      toast.success("Facturas subidas correctamente");
    } catch (error) {
      toast.error("Error al subir las facturas");
      console.error(error);
    }
    
    setUploading(false);
  };

  const facturasActuales = cliente.facturas || [];
  const espacioDisponible = 3 - facturasActuales.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Subir Facturas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#666666] mb-2 block">
                Tipo de factura *
              </label>
              <Select value={tipoFactura} onValueChange={setTipoFactura} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.0">2.0</SelectItem>
                  <SelectItem value="3.0">3.0</SelectItem>
                  <SelectItem value="6.1">6.1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#666666] mb-2 block">
                Archivos (máx. {espacioDisponible})
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#004D9D] transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-[#666666]">
                    Haz clic o arrastra archivos aquí
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, JPG o PNG
                  </p>
                </label>
              </div>
            </div>

            {archivos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#666666]">
                  Archivos seleccionados:
                </p>
                {archivos.map((archivo, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#004D9D]" />
                      <span className="text-sm">{archivo.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchivos(archivos.filter((_, i) => i !== index))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-[#004D9D] hover:bg-[#00AEEF]"
              disabled={uploading}
            >
              {uploading ? "Subiendo..." : "Subir Facturas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}