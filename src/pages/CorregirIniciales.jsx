import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CorregirIniciales() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [resultado, setResultado] = useState(null);

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

  const handleCorregir = async () => {
    setCorrigiendo(true);
    setResultado(null);

    try {
      const clientesSinIniciales = clientes.filter(c => 
        !c.propietario_iniciales || c.propietario_iniciales === 'N/A' || c.propietario_iniciales === 'n/a'
      );

      let corregidos = 0;
      const errores = [];

      for (const cliente of clientesSinIniciales) {
        try {
          let iniciales = 'n/s';
          
          if (cliente.propietario_email) {
            if (cliente.propietario_email.includes('jokin')) {
              iniciales = 'JOK';
            } else if (cliente.propietario_email.includes('jose')) {
              iniciales = 'JOS';
            } else {
              // Extraer iniciales del email
              const nombre = cliente.propietario_email.split('@')[0];
              iniciales = nombre.substring(0, 3).toUpperCase();
            }
          }

          await base44.entities.Cliente.update(cliente.id, {
            propietario_iniciales: iniciales
          });
          
          corregidos++;
        } catch (error) {
          errores.push(`${cliente.nombre_negocio}: ${error.message}`);
        }
      }

      setResultado({
        total: clientesSinIniciales.length,
        corregidos,
        errores
      });

      queryClient.invalidateQueries(['clientes']);
      
      if (errores.length === 0) {
        toast.success(`✓ ${corregidos} clientes corregidos`);
      } else {
        toast.warning(`${corregidos} corregidos, ${errores.length} errores`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error("Error al corregir iniciales");
    } finally {
      setCorrigiendo(false);
    }
  };

  if (!user) return null;

  const clientesSinIniciales = clientes.filter(c => 
    !c.propietario_iniciales || c.propietario_iniciales === 'N/A' || c.propietario_iniciales === 'n/a'
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D] mb-2">
          Corregir Iniciales de Propietarios
        </h1>
        <p className="text-[#666666]">
          Herramienta para asignar iniciales a clientes que no las tienen
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-lg font-semibold text-[#004D9D]">
                Clientes sin iniciales: {clientesSinIniciales.length}
              </p>
              <p className="text-sm text-gray-600">
                Total de clientes: {clientes.length}
              </p>
            </div>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              clientesSinIniciales.length > 0 ? 'bg-yellow-100' : 'bg-green-100'
            }`}>
              {clientesSinIniciales.length > 0 ? (
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              )}
            </div>
          </div>

          <Button
            onClick={handleCorregir}
            disabled={corrigiendo || clientesSinIniciales.length === 0}
            className="w-full bg-[#004D9D] hover:bg-[#003875]"
          >
            {corrigiendo ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Corrigiendo...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Corregir Iniciales
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card className={`border-2 ${resultado.errores.length === 0 ? 'border-green-300 bg-green-50' : 'border-yellow-300 bg-yellow-50'}`}>
          <CardContent className="p-6">
            <h3 className="font-bold text-lg mb-4">Resultado</h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ✓ Clientes corregidos: <strong>{resultado.corregidos}</strong>
              </p>
              <p className="text-gray-700">
                Total procesados: <strong>{resultado.total}</strong>
              </p>
              
              {resultado.errores.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="font-semibold text-red-700 mb-2">Errores:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {resultado.errores.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {clientesSinIniciales.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg mb-4">Clientes afectados</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clientesSinIniciales.map(cliente => (
                <div key={cliente.id} className="p-3 bg-gray-50 rounded border text-sm">
                  <p className="font-semibold">{cliente.nombre_negocio}</p>
                  <p className="text-gray-600">Email: {cliente.propietario_email}</p>
                  <p className="text-gray-500">Iniciales actuales: {cliente.propietario_iniciales || 'ninguna'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}