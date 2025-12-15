import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download } from "lucide-react";

export default function GenerarFacturaDialog({ open, onClose, mesSeleccionado, totalMes, user }) {
  const queryClient = useQueryClient();
  const facturaRef = useRef(null);
  
  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas'],
    queryFn: () => base44.entities.Factura.list(),
  });

  const [editableData, setEditableData] = useState({
    numero: facturas.length + 1,
    fecha: new Date().toISOString().split('T')[0],
    precio: totalMes.toFixed(2),
    total: totalMes.toFixed(2)
  });

  const createFacturaMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.Factura.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['facturas']);
      toast.success("Factura generada correctamente");
      onClose();
    },
  });

  const handleDescargar = async () => {
    try {
      // Generar PDF
      const element = facturaRef.current;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Descargar PDF
      const fileName = `Factura_${editableData.numero}_${user.full_name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);

      // Convertir a blob y subir
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Guardar en base de datos
      await createFacturaMutation.mutateAsync({
        numero_factura: parseInt(editableData.numero),
        fecha_creacion: editableData.fecha,
        mes_comision: mesSeleccionado,
        comercial_email: user.email,
        comercial_nombre: user.full_name,
        importe_comision: parseFloat(editableData.precio),
        importe_total: parseFloat(editableData.total),
        estado: "pendiente_revision",
        pdf_url: file_url
      });

    } catch (error) {
      console.error("Error al generar factura:", error);
      toast.error("Error al generar la factura");
    }
  };

  const formatearFecha = (fecha) => {
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Generar Factura</DialogTitle>
        </DialogHeader>

        <div ref={facturaRef} className="bg-white p-8 border rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start mb-12">
            <h1 className="text-6xl font-bold">Factura</h1>
            <div className="w-8 h-8 bg-black"></div>
          </div>

          {/* Cliente y Factura N° */}
          <div className="flex justify-between mb-8">
            <div>
              <h2 className="font-bold text-lg mb-2">CLIENTE</h2>
              <p>Nicolás Imizcoz García</p>
              <p>73464830R</p>
              <p>Travesía Monasterio de Urdax, 4 5ºA</p>
              <p>31011 Pamplona</p>
              <p>nicolasvoltis@gmail.com</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-lg mb-2">Factura N°</h2>
                <Input
                  type="number"
                  value={editableData.numero}
                  onChange={(e) => setEditableData({...editableData, numero: e.target.value})}
                  className="w-64 h-12 text-center border-2 border-blue-500"
                />
              </div>
              
              <div>
                <h2 className="font-bold text-lg mb-2">Fecha</h2>
                <Input
                  type="text"
                  value={formatearFecha(editableData.fecha)}
                  onChange={(e) => {
                    // Permitir editar en formato dd/mm/yyyy
                    const valor = e.target.value;
                    if (valor.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                      const [day, month, year] = valor.split('/');
                      setEditableData({...editableData, fecha: `${year}-${month}-${day}`});
                    } else {
                      setEditableData({...editableData, fecha: valor});
                    }
                  }}
                  className="w-64 h-12 text-center border-2 border-blue-500"
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>
          </div>

          {/* Tabla de descripción */}
          <div className="mb-8">
            <div className="flex bg-black text-white p-3">
              <div className="flex-1 font-bold">DESCRIPCIÓN</div>
              <div className="w-64 font-bold text-right">PRECIO</div>
            </div>
            
            <div className="flex border-b border-gray-300 py-6">
              <div className="flex-1">
                <p>Comisión por mediación comercia y puesta</p>
                <p>a disposición de cartera de clientes</p>
              </div>
              <div className="w-64">
                <Input
                  type="number"
                  step="0.01"
                  value={editableData.precio}
                  onChange={(e) => setEditableData({...editableData, precio: e.target.value, total: e.target.value})}
                  className="h-12 text-center border-2 border-blue-500"
                />
              </div>
            </div>

            <div className="border-b border-gray-300 py-3"></div>
            <div className="border-b border-gray-300 py-3"></div>

            {/* Total */}
            <div className="flex items-center justify-end mt-8">
              <div className="bg-black text-white px-6 py-2 mr-4 font-bold">TOTAL</div>
              <Input
                type="number"
                step="0.01"
                value={editableData.total}
                onChange={(e) => setEditableData({...editableData, total: e.target.value})}
                className="w-64 h-12 text-center border-2 border-blue-500"
              />
            </div>
          </div>

          {/* Información para el pago */}
          <div className="border-t-2 border-black pt-6">
            <h2 className="font-bold text-xl mb-4">INFORMACIÓN PARA EL PAGO</h2>
            <div className="space-y-1">
              <div className="flex">
                <span className="font-bold w-48">BENEFICIARIO:</span>
                <span>Jokin de Irala</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">DIRECCIÓN:</span>
                <span>Calle Ixurmendi 34 Cizur Mayor</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48"></span>
                <span>31180 Navarra</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">NIF:</span>
                <span>73468068L</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">TELÉFONO:</span>
                <span>618511959</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">NÚMERO DE CUENTA:</span>
                <span>ES2620803625173040135371</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleDescargar} className="bg-[#004D9D]">
            <Download className="w-4 h-4 mr-2" />
            Descargar Factura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}