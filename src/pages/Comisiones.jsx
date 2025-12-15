import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, Building2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function Comisiones() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role === 'admin') {
        navigate(createPageUrl("ComisionesAdmin"));
        return;
      }
      setUser(currentUser);
    };
    loadUser();
  }, [navigate]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: facturasComercial = [] } = useQuery({
    queryKey: ['facturasComercial'],
    queryFn: () => base44.entities.FacturaComercial.list(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Obtener todos los suministros cerrados del usuario
  const misClientesCerrados = clientes.filter(
    c => c.propietario_email === user.email && c.aprobado_admin === true
  );

  // Extraer todos los suministros cerrados con su información
  const suministrosCerrados = misClientesCerrados.flatMap(cliente => 
    (cliente.suministros || [])
      .filter(s => s.cerrado && s.comision)
      .map(s => ({
        ...s,
        clienteNombre: cliente.nombre_negocio,
        clienteId: cliente.id
      }))
  );

  const suministrosDelMes = suministrosCerrados.filter(
    s => s.mes_comision_suministro === mesSeleccionado
  );

  const totalMes = suministrosDelMes.reduce((sum, s) => sum + (s.comision || 0), 0);

  const mesesDisponibles = [...new Set(suministrosCerrados.map(s => s.mes_comision_suministro))]
    .filter(Boolean)
    .sort()
    .reverse();

  const cambiarMes = (direccion) => {
    const currentIndex = mesesDisponibles.indexOf(mesSeleccionado);
    if (direccion === 'prev' && currentIndex < mesesDisponibles.length - 1) {
      setMesSeleccionado(mesesDisponibles[currentIndex + 1]);
    } else if (direccion === 'next' && currentIndex > 0) {
      setMesSeleccionado(mesesDisponibles[currentIndex - 1]);
    }
  };

  const formatearMes = (mesStr) => {
    if (!mesStr) return "";
    const [year, month] = mesStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy', { locale: es });
  };

  const generarFactura = async () => {
    if (!user) return;

    // Calcular total de comisiones hasta hoy
    const totalComisiones = suministrosCerrados.reduce((sum, s) => sum + (s.comision || 0), 0);

    // Obtener último número de factura
    const misFacturas = facturasComercial.filter(f => f.comercial_email === user.email);
    const ultimoNumero = misFacturas.length > 0 
      ? Math.max(...misFacturas.map(f => f.numero_factura))
      : 0;
    const nuevoNumero = ultimoNumero + 1;

    // Fecha actual
    const fechaHoy = format(new Date(), 'dd/MM/yyyy');
    const fechaISO = format(new Date(), 'yyyy-MM-dd');

    // Guardar registro de factura
    await base44.entities.FacturaComercial.create({
      comercial_email: user.email,
      numero_factura: nuevoNumero,
      fecha_generacion: fechaISO,
      importe: totalComisiones,
      periodo: mesSeleccionado
    });

    // Generar contenido HTML para Word
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .header { text-align: right; margin-bottom: 40px; }
    .factura-title { font-size: 72px; font-weight: bold; margin: 0; }
    .cliente-info { margin-top: 40px; }
    .cliente-info p { margin: 5px 0; }
    .factura-numero { text-align: right; margin-top: -100px; }
    .factura-numero p { margin: 10px 0; font-weight: bold; font-size: 16px; }
    .tabla { width: 100%; margin-top: 40px; border-collapse: collapse; }
    .tabla-header { background-color: black; color: white; padding: 15px; text-align: left; font-weight: bold; }
    .tabla-row { border-bottom: 1px solid #ccc; padding: 20px 15px; }
    .total-row { background-color: black; color: white; padding: 15px; text-align: right; font-weight: bold; font-size: 18px; margin-top: 20px; }
    .pago-info { margin-top: 60px; }
    .pago-info h3 { font-size: 20px; font-weight: bold; }
    .pago-info p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="factura-title">Factura</h1>
  </div>

  <div class="cliente-info">
    <p><strong>Cliente</strong></p>
    <p>Nicolás Imizcoz García</p>
    <p>73464830R</p>
    <p>Travesía Monasterio de Urdax, 4 5ºA</p>
    <p>31011 PAMPLONA</p>
    <p>nicolasvoltis@gmail.com</p>
  </div>

  <div class="factura-numero">
    <p><strong>Factura N°</strong></p>
    <p>${nuevoNumero}</p>
    <br>
    <p><strong>Fecha</strong></p>
    <p>${fechaHoy}</p>
  </div>

  <table class="tabla">
    <tr>
      <td class="tabla-header">DESCRIPCIÓN</td>
      <td class="tabla-header" style="text-align: right; width: 150px;">PRECIO</td>
    </tr>
    <tr>
      <td class="tabla-row">Comisión por mediación comercial y puesta a disposición de cartera de clientes</td>
      <td class="tabla-row" style="text-align: right;">${totalComisiones.toFixed(2)}€</td>
    </tr>
  </table>

  <div class="total-row">
    TOTAL: ${totalComisiones.toFixed(2)}€
  </div>

  <div class="pago-info">
    <h3>Información para el pago</h3>
    <p>Beneficiario: Jokin de Irala</p>
    <p>Dirección: Calle Ixurmendi 34 Cizur Mayor, 31180 Navarra</p>
    <p>NIF: 73468068L</p>
    <p>Teléfono: 618511959</p>
    <p>Número de cuenta: ES2620803625173040135371</p>
  </div>
</body>
</html>
    `;

    // Crear ventana para imprimir a PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Esperar a que cargue y abrir diálogo de impresión
    printWindow.onload = () => {
      printWindow.print();
    };

    toast.success(`Factura N°${nuevoNumero} lista para descargar como PDF`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
            <DollarSign className="w-8 h-8" />
            Comisiones
          </h1>
          <p className="text-[#666666]">
            Gestiona tus comisiones mensuales
          </p>
        </div>
        <Button
          onClick={generarFactura}
          className="bg-[#004D9D] hover:bg-[#00AEEF]"
        >
          📄 Generar Factura
        </Button>
      </div>

      <Card className="border-none shadow-lg mb-6 bg-gradient-to-r from-green-500 to-green-600">
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-white/90 text-sm mb-2">Total del Mes Actual</p>
            <p className="text-5xl font-bold text-white mb-1">
              €{totalMes.toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-2 text-white/90 text-sm mt-3">
              <TrendingUp className="w-4 h-4" />
              <span>{suministrosDelMes.length} suministro(s) cerrado(s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md mb-6">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="text-[#004D9D]">
            {formatearMes(mesSeleccionado)}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('prev')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === mesesDisponibles.length - 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => cambiarMes('next')}
              disabled={mesesDisponibles.indexOf(mesSeleccionado) === 0}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {suministrosDelMes.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-[#666666]">
                No hay comisiones en este mes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suministrosDelMes.map(suministro => (
                <div 
                  key={`${suministro.clienteId}-${suministro.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#004D9D] to-[#00AEEF] flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#004D9D]">
                        {suministro.clienteNombre}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {suministro.nombre}
                      </p>
                      {suministro.fecha_cierre_suministro && (
                        <p className="text-xs text-[#666666]">
                          Cerrado: {format(new Date(suministro.fecha_cierre_suministro), "d 'de' MMMM", { locale: es })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      €{suministro.comision.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="mt-6 pt-6 border-t-2 border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-[#666666]">
                    Total del mes
                  </span>
                  <span className="text-3xl font-bold text-green-600">
                    €{totalMes.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {mesesDisponibles.length > 0 && (
        <Card className="border-none shadow-md">
          <CardHeader className="border-b">
            <CardTitle className="text-[#004D9D]">Historial Mensual</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {mesesDisponibles.map(mes => {
                const suministrosMes = suministrosCerrados.filter(s => s.mes_comision_suministro === mes);
                const totalMesHist = suministrosMes.reduce((sum, s) => sum + (s.comision || 0), 0);
                
                return (
                  <button
                    key={mes}
                    onClick={() => setMesSeleccionado(mes)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                      mes === mesSeleccionado 
                        ? 'bg-[#004D9D] text-white' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">
                      {formatearMes(mes)}
                    </span>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${mes === mesSeleccionado ? 'text-white' : 'text-green-600'}`}>
                        €{totalMesHist.toFixed(2)}
                      </p>
                      <p className={`text-xs ${mes === mesSeleccionado ? 'text-white/80' : 'text-[#666666]'}`}>
                        {suministrosMes.length} suministro(s)
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}