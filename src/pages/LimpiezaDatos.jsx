import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function LimpiezaDatos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [limpiando, setLimpiando] = useState(false);
  const [resultados, setResultados] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== 'admin') {
        navigate(createPageUrl("Dashboard"));
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

  // Analizar cuántos registros tienen problemas
  const analisis = clientes.reduce((acc, cliente) => {
    if (!cliente.suministros || cliente.suministros.length === 0) return acc;
    
    let tieneProblemas = false;
    cliente.suministros.forEach(s => {
      if (s.informe_final) {
        const tieneNombreNull = s.informe_final.nombre === null || s.informe_final.nombre === 'null';
        const tieneUrlNull = s.informe_final.url === null || s.informe_final.url === 'null';
        const noTieneArchivos = !s.informe_final.archivos || s.informe_final.archivos.length === 0;
        
        if (tieneNombreNull && tieneUrlNull && noTieneArchivos) {
          tieneProblemas = true;
          acc.suministrosCorruptos++;
        }
      }
    });
    
    if (tieneProblemas) {
      acc.clientesAfectados++;
    }
    
    return acc;
  }, { clientesAfectados: 0, suministrosCorruptos: 0 });

  const limpiarMutation = useMutation({
    mutationFn: async () => {
      const clientesActualizar = [];
      
      clientes.forEach(cliente => {
        if (!cliente.suministros || cliente.suministros.length === 0) return;
        
        let necesitaLimpieza = false;
        const suministrosLimpios = cliente.suministros.map(s => {
          if (s.informe_final) {
            const tieneNombreNull = s.informe_final.nombre === null || s.informe_final.nombre === 'null';
            const tieneUrlNull = s.informe_final.url === null || s.informe_final.url === 'null';
            const noTieneArchivos = !s.informe_final.archivos || s.informe_final.archivos.length === 0;
            
            if (tieneNombreNull && tieneUrlNull && noTieneArchivos) {
              necesitaLimpieza = true;
              // Eliminar informe_final corrupto
              const { informe_final, ...suministroLimpio } = s;
              return suministroLimpio;
            }
          }
          return s;
        });
        
        if (necesitaLimpieza) {
          clientesActualizar.push({
            id: cliente.id,
            nombre: cliente.nombre_negocio,
            suministros: suministrosLimpios
          });
        }
      });
      
      // Actualizar todos los clientes afectados
      for (const cliente of clientesActualizar) {
        await base44.entities.Cliente.update(cliente.id, {
          suministros: cliente.suministros
        });
      }
      
      return clientesActualizar;
    },
    onSuccess: (clientesActualizados) => {
      queryClient.invalidateQueries(['clientes']);
      setResultados({
        exito: true,
        total: clientesActualizados.length,
        clientes: clientesActualizados
      });
      toast.success(`✓ ${clientesActualizados.length} cliente(s) limpiado(s)`);
      setLimpiando(false);
    },
    onError: (error) => {
      console.error("Error en limpieza:", error);
      setResultados({
        exito: false,
        error: error.message
      });
      toast.error("Error en la limpieza");
      setLimpiando(false);
    }
  });

  const handleLimpiar = () => {
    if (!window.confirm(
      `Se eliminarán ${analisis.suministrosCorruptos} registro(s) corrupto(s) de ${analisis.clientesAfectados} cliente(s).\n\n¿Continuar?`
    )) {
      return;
    }
    
    setLimpiando(true);
    setResultados(null);
    limpiarMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2 flex items-center gap-3">
          <Trash2 className="w-8 h-8" />
          Limpieza de Datos
        </h1>
        <p className="text-[#666666]">
          Herramienta para eliminar registros corruptos de informes finales
        </p>
      </div>

      {/* Card de análisis */}
      <Card className="mb-6 border-l-4 border-orange-500">
        <CardHeader>
          <CardTitle className="text-orange-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Análisis de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Clientes afectados:</span>
              <span className="text-2xl font-bold text-orange-600">
                {analisis.clientesAfectados}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Suministros con datos corruptos:</span>
              <span className="text-2xl font-bold text-red-600">
                {analisis.suministrosCorruptos}
              </span>
            </div>
            
            {analisis.clientesAfectados > 0 && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 mb-3">
                  <strong>Problema detectado:</strong> Hay suministros con <code>informe_final</code> que contiene <code>nombre: null, url: null</code> sin archivos válidos.
                </p>
                <p className="text-sm text-orange-700">
                  La limpieza eliminará estos registros corruptos, permitiendo que los informes aparezcan correctamente.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botón de limpieza */}
      {analisis.clientesAfectados > 0 && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <Button
              onClick={handleLimpiar}
              disabled={limpiando}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              size="lg"
            >
              {limpiando ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Limpiando datos...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 mr-2" />
                  Limpiar Registros Corruptos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {resultados && (
        <Card className={`border-l-4 ${resultados.exito ? 'border-green-500' : 'border-red-500'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${resultados.exito ? 'text-green-700' : 'text-red-700'}`}>
              {resultados.exito ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Limpieza Completada
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Error en la Limpieza
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultados.exito ? (
              <div className="space-y-3">
                <p className="text-green-700 font-semibold">
                  ✓ Se limpiaron {resultados.total} cliente(s) exitosamente
                </p>
                {resultados.clientes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Clientes afectados:</p>
                    <div className="space-y-1">
                      {resultados.clientes.map((c, idx) => (
                        <div key={idx} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          • {c.nombre}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-700">
                Error: {resultados.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info de éxito */}
      {analisis.clientesAfectados === 0 && (
        <Card className="border-l-4 border-green-500">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg text-green-700 font-semibold">
              ¡Base de datos limpia!
            </p>
            <p className="text-gray-600 mt-2">
              No se encontraron registros corruptos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}