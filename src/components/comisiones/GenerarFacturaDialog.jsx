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

export default function GenerarFacturaDialog({ open, onClose, mesSeleccionado, totalMes, user, suministrosDelMes }) {
  const queryClient = useQueryClient();
  const facturaRef = useRef(null);
  
  const { data: facturas = [] } = useQuery({
    queryKey: ['facturas'],
    queryFn: () => base44.entities.Factura.list(),
  });

  // Calcular número de factura progresivo por comercial
  const numeroFactura = (facturas.filter(f => f.comercial_email === user.email).length || 0) + 1;

  const [baseImponible, setBaseImponible] = useState(totalMes.toFixed(2));

  // Actualizar base imponible cuando cambia totalMes
  React.useEffect(() => {
    setBaseImponible(totalMes.toFixed(2));
  }, [totalMes]);

  // Cálculos automáticos
  const calcularFactura = (base) => {
    const baseNum = parseFloat(base) || 0;
    const iva = baseNum * 0.21;
    const retencion = baseNum * -0.15;
    const total = baseNum + iva + retencion;
    
    return {
      base: baseNum.toFixed(2),
      iva: iva.toFixed(2),
      retencion: retencion.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const valores = calcularFactura(baseImponible);
  const fechaHoy = new Date().toISOString().split('T')[0];

  // Datos de beneficiario según el comercial
  const datosComerciales = {
    "jokin@voltisenergia.com": {
      nombre: "Jokin de Irala",
      direccion: "Calle Ixurmendi 34 Cizur Mayor",
      direccion2: "31180 Navarra",
      nif: "73468068L",
      telefono: "618511959",
      cuenta: "ES2620803625173040135371"
    },
    "jose@voltisenergia.com": {
      nombre: "Jose García González",
      direccion: "Calle Sancho El Mayor 5 4º izda",
      direccion2: "31001 Pamplona, Navarra",
      nif: "73140962L",
      telefono: "663768060",
      cuenta: "ES0900495280522416157219"
    }
  };

  const datosComercial = datosComerciales[user.email] || datosComerciales["jokin@voltisenergia.com"];

  const generarFacturaMutation = useMutation({
    mutationFn: async ({ file_url, suministrosIds }) => {
      console.log("🚀 INICIANDO GENERACIÓN DE FACTURA");
      console.log("📦 Suministros a facturar:", JSON.stringify(suministrosIds, null, 2));
      
      // PASO 1: Obtener lista fresca de clientes
      console.log("📥 Obteniendo lista actualizada de clientes...");
      const clientesList = await base44.entities.Cliente.list();
      console.log(`✅ ${clientesList.length} clientes obtenidos de BD`);
      
      // PASO 2: Actualizar cada suministro secuencialmente (no paralelo para evitar race conditions)
      for (const suministroInfo of suministrosIds) {
        const cliente = clientesList.find(c => c.id === suministroInfo.cliente_id);
        
        if (!cliente) {
          console.error(`❌ Cliente no encontrado: ${suministroInfo.cliente_id}`);
          continue;
        }
        
        console.log(`\n📝 Procesando: ${cliente.nombre_negocio}`);
        console.log(`   Suministro ID: ${suministroInfo.suministro_id}`);
        
        const suministroOriginal = cliente.suministros.find(s => s.id === suministroInfo.suministro_id);
        if (!suministroOriginal) {
          console.error(`❌ Suministro no encontrado en cliente: ${suministroInfo.suministro_id}`);
          continue;
        }
        
        console.log(`   Estado actual facturado:`, suministroOriginal.facturado);
        
        const suministrosActualizados = cliente.suministros.map(s => {
          if (s.id === suministroInfo.suministro_id) {
            console.log(`   ✅ Marcando como facturado: true (boolean)`);
            return { ...s, facturado: true };
          }
          return s;
        });
        
        console.log(`   ⏳ Guardando en BD...`);
        await base44.entities.Cliente.update(cliente.id, { suministros: suministrosActualizados });
        console.log(`   ✅ Cliente actualizado en BD`);
      }

      console.log("\n✅ TODOS LOS SUMINISTROS MARCADOS COMO FACTURADOS");

      // PASO 3: Crear la factura
      console.log("\n📄 Creando registro de factura...");
      const nuevaFactura = await base44.entities.Factura.create({
        numero_factura: numeroFactura,
        fecha_creacion: fechaHoy,
        mes_comision: mesSeleccionado,
        comercial_email: user.email,
        comercial_nombre: user.full_name,
        importe_comision: parseFloat(valores.base),
        importe_total: parseFloat(valores.total),
        estado: "pendiente_revision",
        pdf_url: file_url,
        suministros_incluidos: suministrosIds
      });
      console.log("✅ Factura creada:", nuevaFactura.id);
      
      return { success: true };
    },
    onSuccess: async () => {
      console.log("\n🔄 SINCRONIZANDO FRONTEND CON BD...");
      
      // Invalidar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      
      // Esperar a que las queries se refresquen completamente
      console.log("⏳ Esperando refetch completo...");
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['clientes'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['facturas'], type: 'active' })
      ]);
      
      console.log("✅ REFETCH COMPLETADO");
      
      // Verificación exhaustiva
      const clientesActualizados = queryClient.getQueryData(['clientes']);
      console.log("\n🔍 VERIFICACIÓN FINAL:");
      console.log(`   Total clientes en cache: ${clientesActualizados?.length || 0}`);
      
      const todosLosSuministros = clientesActualizados?.flatMap(c => 
        (c.suministros || []).map(s => ({
          cliente: c.nombre_negocio,
          suministro: s.nombre || s.id,
          facturado: s.facturado,
          tipoFacturado: typeof s.facturado
        }))
      ) || [];
      
      const facturados = todosLosSuministros.filter(s => s.facturado === true);
      console.log(`   Suministros facturados en cache: ${facturados.length}`);
      
      if (facturados.length > 0) {
        console.log("\n   Detalle de facturados:");
        facturados.forEach(s => {
          console.log(`      - ${s.cliente} / ${s.suministro}: facturado=${s.facturado} (${s.tipoFacturado})`);
        });
      }
      
      toast.success("✅ Factura generada correctamente");
      
      // Pequeño delay antes de cerrar para asegurar que React procese los cambios
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log("🚪 Cerrando diálogo\n");
      onClose();
    },
    onError: (error) => {
      console.error("\n❌ ERROR CRÍTICO:", error);
      console.error("Stack:", error.stack);
      toast.error("Error al generar la factura");
    }
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
      const fileName = `Factura_${numeroFactura}_${user.full_name.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);

      // Convertir a blob y subir
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Guardar en base de datos con los suministros incluidos
      const suministrosIds = suministrosDelMes.map(s => ({
        cliente_id: s.clienteId,
        suministro_id: s.id,
        comision: s.comision
      }));

      // Ejecutar mutation que actualiza suministros y crea factura
      await generarFacturaMutation.mutateAsync({ file_url, suministrosIds });

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
          <div className="flex justify-between items-start mb-8">
            <h1 className="text-6xl font-bold">Factura</h1>
            <div className="w-16 h-16 border-8 border-black border-r-0 border-t-0"></div>
          </div>

          {/* Cliente y Factura N° */}
          <div className="flex justify-between mb-8">
            <div>
              <h2 className="font-bold text-lg mb-2">CLIENTE</h2>
              <p>Nicolás Imízcoz García</p>
              <p>73464830R</p>
              <p>Travesía Monasterio de Urdax, 4 5ºA 31011</p>
              <p>Pamplona</p>
              <p>nicolasvoltis@gmail.com</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-lg mb-2">Factura N°</h2>
                <div className="w-64 h-12 border-2 border-blue-500 flex items-center justify-center text-xl font-semibold">
                  {numeroFactura}
                </div>
              </div>
              
              <div>
                <h2 className="font-bold text-lg mb-2">Fecha</h2>
                <div className="w-64 h-12 border-2 border-blue-500 flex items-center justify-center text-xl font-semibold">
                  {formatearFecha(fechaHoy)}
                </div>
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
              <div className="w-64 flex items-center justify-end gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={baseImponible}
                  onChange={(e) => setBaseImponible(e.target.value)}
                  className="h-12 text-right border-2 border-blue-500 flex-1 font-semibold"
                />
              </div>
            </div>

            <div className="border-b border-gray-300 py-3"></div>
            <div className="border-b border-gray-300 py-3"></div>

            {/* Desglose de impuestos */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-end items-center">
                <span className="mr-4">Base imponible:…………………………</span>
                <div className="w-32 h-10 border-2 border-blue-500 flex items-center justify-center font-semibold">
                  {valores.base} €
                </div>
              </div>
              
              <div className="flex justify-end items-center">
                <span className="mr-4">21% IVA:……………………………………</span>
                <div className="w-32 h-10 border-2 border-blue-500 flex items-center justify-center font-semibold">
                  {valores.iva} €
                </div>
              </div>
              
              <div className="flex justify-end items-center">
                <span className="mr-4">Retención IRPF -15%:……………</span>
                <div className="w-32 h-10 border-2 border-blue-500 flex items-center justify-center font-semibold">
                  {valores.retencion} €
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-end mt-6">
              <div className="bg-black text-white px-8 py-3 mr-4 font-bold text-lg">TOTAL</div>
              <div className="w-64 h-14 border-2 border-blue-500 flex items-center justify-center text-2xl font-bold">
                {valores.total} €
              </div>
            </div>
          </div>

          {/* Información para el pago */}
          <div className="border-t-2 border-black pt-6">
            <h2 className="font-bold text-xl mb-4">INFORMACIÓN PARA EL PAGO</h2>
            <div className="space-y-1">
              <div className="flex">
                <span className="font-bold w-48">BENEFICIARIO:</span>
                <span>{datosComercial.nombre}</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">DIRECCIÓN:</span>
                <span>{datosComercial.direccion}</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48"></span>
                <span>{datosComercial.direccion2}</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">NIF:</span>
                <span>{datosComercial.nif}</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">TELÉFONO:</span>
                <span>{datosComercial.telefono}</span>
              </div>
              <div className="flex">
                <span className="font-bold w-48">NÚMERO DE CUENTA:</span>
                <span>{datosComercial.cuenta}</span>
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