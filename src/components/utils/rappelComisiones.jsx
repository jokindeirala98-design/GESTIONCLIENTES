/**
 * Sistema de cálculo de rappel automático para comisiones de Gas y Luz 2.0
 */

/**
 * Determina si un suministro es de tipo Gas
 */
export const esGas = (nombreSuministro) => {
  if (!nombreSuministro) return false;
  return nombreSuministro.toLowerCase().includes('gas');
};

/**
 * Determina si un suministro es de tipo Luz 2.0
 */
export const esLuz20 = (nombreSuministro, tipoFactura) => {
  if (!nombreSuministro || tipoFactura !== '2.0') return false;
  return nombreSuministro.toLowerCase().includes('luz');
};

/**
 * Calcula la comisión de Gas según rappel
 * 1-2: 30€, 3-4: 35€, 5+: 40€
 */
export const calcularComisionGas = (cantidad) => {
  if (cantidad <= 0) return 0;
  if (cantidad <= 2) return 30;
  if (cantidad <= 4) return 35;
  return 40; // 5 o más
};

/**
 * Calcula la comisión de Luz 2.0 según rappel
 * 1-2: 1€, 3-5: 50€, 6-8: 60€, 9-10: 65€, 11+: 70€
 */
export const calcularComisionLuz20 = (cantidad) => {
  if (cantidad <= 0) return 0;
  if (cantidad <= 2) return 1;
  if (cantidad <= 5) return 50;
  if (cantidad <= 8) return 60;
  if (cantidad <= 10) return 65;
  return 70; // 11 o más
};

/**
 * Recalcula todas las comisiones de rappel para un comercial en un mes específico
 * @param {Array} todosClientes - Lista completa de clientes
 * @param {string} comercialEmail - Email del comercial
 * @param {string} mesComision - Mes en formato YYYY-MM
 * @returns {Object} - Objeto con los suministros actualizados por cliente
 */
export const recalcularRappelComercial = (todosClientes, comercialEmail, mesComision) => {
  // 1. Recopilar TODOS los suministros de gas y luz 2.0 del comercial en ese mes
  const suministrosGas = [];
  const suministrosLuz20 = [];
  
  todosClientes.forEach(cliente => {
    if (cliente.propietario_email !== comercialEmail) return;
    
    (cliente.suministros || []).forEach(suministro => {
      // Solo considerar suministros cerrados en el mes específico
      if (suministro.mes_comision_suministro !== mesComision) return;
      
      if (esGas(suministro.nombre)) {
        suministrosGas.push({
          clienteId: cliente.id,
          suministroId: suministro.id,
          nombre: suministro.nombre
        });
      } else if (esLuz20(suministro.nombre, suministro.tipo_factura)) {
        suministrosLuz20.push({
          clienteId: cliente.id,
          suministroId: suministro.id,
          nombre: suministro.nombre
        });
      }
    });
  });

  // 2. Calcular comisiones según rappel
  const comisionGas = calcularComisionGas(suministrosGas.length);
  const comisionLuz20 = calcularComisionLuz20(suministrosLuz20.length);

  // 3. Preparar actualizaciones por cliente
  const actualizacionesPorCliente = {};

  // Actualizar suministros de gas
  suministrosGas.forEach(({ clienteId, suministroId }) => {
    if (!actualizacionesPorCliente[clienteId]) {
      actualizacionesPorCliente[clienteId] = {};
    }
    actualizacionesPorCliente[clienteId][suministroId] = comisionGas;
  });

  // Actualizar suministros de luz 2.0
  suministrosLuz20.forEach(({ clienteId, suministroId }) => {
    if (!actualizacionesPorCliente[clienteId]) {
      actualizacionesPorCliente[clienteId] = {};
    }
    actualizacionesPorCliente[clienteId][suministroId] = comisionLuz20;
  });

  return {
    actualizacionesPorCliente,
    stats: {
      totalGas: suministrosGas.length,
      comisionGas,
      totalLuz20: suministrosLuz20.length,
      comisionLuz20
    }
  };
};

/**
 * Aplica las actualizaciones de rappel a un cliente específico
 * @param {Object} cliente - Cliente a actualizar
 * @param {Object} actualizacionesSuministros - Mapa de suministroId -> comisión
 * @returns {Object} - Cliente actualizado con nuevas comisiones
 */
export const aplicarActualizacionesRappel = (cliente, actualizacionesSuministros) => {
  if (!actualizacionesSuministros || Object.keys(actualizacionesSuministros).length === 0) {
    return cliente;
  }

  const nuevosSuministros = (cliente.suministros || []).map(s => {
    if (actualizacionesSuministros[s.id] !== undefined) {
      return {
        ...s,
        comision: actualizacionesSuministros[s.id]
      };
    }
    return s;
  });

  const comisionTotal = nuevosSuministros.reduce((sum, s) => sum + (s.comision || 0), 0);

  return {
    ...cliente,
    suministros: nuevosSuministros,
    comision: comisionTotal
  };
};