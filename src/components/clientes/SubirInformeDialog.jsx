import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

export default function SubirInformeDialog({ open, onClose, cliente, user }) {
  const queryClient = useQueryClient();
  const [archivos, setArchivos] = useState([]);
  const [comision, setComision] = useState("");
  const [uploading, setUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['cliente', cliente.id]);
      queryClient.invalidateQueries(['clientes']);
    },
  });

  const enviarNotificacionComercial = async (clienteNombre, comercialEmail) => {
    const usuarios = await base44.entities.User.list();
    const comercial = usuarios.find(u => u.email === comercialEmail);
    
    if (comercial && comercial.notificaciones_email) {
      await base44.integrations.Core.SendEmail({
        to: comercialEmail,
        subject: `Informe final subido - ${clienteNombre}`,
        body: `${user.iniciales || user.full_name} ha subido el informe de ${clienteNombre}.`
      });
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 2) {
      toast.error("Solo puedes subir hasta 2 archivos");
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
    
    if (!comision || isNaN(parseFloat(comision))) {
      toast.error("Introduce una comisión válida");
      return;
    }

    setUploading(true);
    
    try {
      const informesSubidos = [];
      
      for (const archivo of archivos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: archivo });
        informesSubidos.push({
          nombre: archivo.name,
          url: file_url,
          fecha_subida: new Date().toISOString(),
          subido_por_email: user.email,
          subido_por_iniciales: user.iniciales || user.full_name?.substring(0, 3).toUpperCase()
        });
      }
      
      await updateMutation.mutateAsync({
        id: cliente.id,
        data: {
          informes_finales: informesSubidos,
          comision: parseFloat(comision),
          estado: "Informe listo"
        }
      });

      await enviarNotificacionComercial(cliente.nombre_negocio, cliente.propietario_email);

      toast.success("Informe(s) subido(s) correctamente");
      onClose();
      setArchivos([]);
      setComision("");
    } catch (error) {
      toast.error("Error al subir el informe");
      console.error(error);
    }
    
    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-purple-600">Subir Informe Final</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#666666] mb-2 block">
                Archivos del informe (1-2 archivos) *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.zip"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                  id="informe-upload"
                />
                <label htmlFor="informe-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-sm text-[#666666]">
                    Haz clic para seleccionar 1 o 2 informes
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, JPG, PNG o ZIP (máx. 2 archivos)
                  </p>
                </label>
              </div>
            </div>

            {archivos.length > 0 && (
              <div className="space-y-2">
                {archivos.map((archivo, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium">{archivo.name}</span>
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

            <div>
              <label className="text-sm font-medium text-[#666666] mb-2 block">
                Comisión (€) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                placeholder="Ej: 150.50"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                La comisión se contabilizará cuando el cliente se cierre con éxito
              </p>
            </div>
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
              className="bg-purple-600 hover:bg-purple-700"
              disabled={uploading}
            >
              {uploading ? "Subiendo..." : "Subir Informe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}