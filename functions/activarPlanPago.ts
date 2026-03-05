import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Los pagos trimestrales caen siempre el día 27 de los meses de cierre de trimestre:
// Q1 → 27 marzo, Q2 → 27 junio, Q3 → 27 septiembre, Q4 → 27 diciembre
// El primer pago es el día 27 del SIGUIENTE trimestre después de la activación.
function calcularFechaVencimientoTrimestral(fechaActivacion, numeroCuota) {
  const fecha = new Date(fechaActivacion + 'T12:00:00');
  const mesActivacion = fecha.getMonth(); // 0-11
  const anioActivacion = fecha.getFullYear();

  // Meses de cierre de trimestre (0-indexed): marzo=2, junio=5, septiembre=8, diciembre=11
  const mesesCierre = [2, 5, 8, 11];

  // Encontrar el próximo mes de cierre DESPUÉS de la fecha de activación
  // Si la activación cae exactamente en el mes de cierre, también va al siguiente
  let mesProximoCierre = null;
  let anioProximoCierre = anioActivacion;

  for (const mes of mesesCierre) {
    const fechaCierre = new Date(anioActivacion, mes, 27);
    if (fechaCierre > fecha) {
      mesProximoCierre = mes;
      anioProximoCierre = anioActivacion;
      break;
    }
  }

  // Si no encontramos cierre este año, el primero del año siguiente
  if (mesProximoCierre === null) {
    mesProximoCierre = 2; // marzo
    anioProximoCierre = anioActivacion + 1;
  }

  // Avanzar (numeroCuota - 1) trimestres desde ese punto
  const indicePrimero = mesesCierre.indexOf(mesProximoCierre);
  const indiceObjetivo = indicePrimero + (numeroCuota - 1);
  const aniosExtra = Math.floor(indiceObjetivo / 4);
  const indiceReal = indiceObjetivo % 4;

  const mesObjetivo = mesesCierre[indiceReal];
  const anioObjetivo = anioProximoCierre + aniosExtra;

  return `${anioObjetivo}-${String(mesObjetivo + 1).padStart(2, '0')}-27`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const {
    cliente_id,
    cliente_nombre,
    comercial_email,
    tipo_plan,
    frecuencia_pago,
    importe_total,
    fecha_activacion,
    descuento_adelantado,
    notas
  } = body;

  if (!cliente_id || !tipo_plan || !frecuencia_pago || !importe_total || !fecha_activacion) {
    return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  // Calcular importe cuota
  let importe_cuota = importe_total;
  if (frecuencia_pago === 'trimestral') {
    importe_cuota = parseFloat((importe_total / 4).toFixed(2));
  } else if (frecuencia_pago === 'adelantado' && descuento_adelantado && tipo_plan === 'suscripcion_anual') {
    importe_cuota = parseFloat((importe_total * 0.95).toFixed(2));
  }

  // Calcular fecha primer pago
  let fecha_proximo_pago;
  if (frecuencia_pago === 'adelantado') {
    fecha_proximo_pago = fecha_activacion;
  } else {
    fecha_proximo_pago = calcularFechaVencimientoTrimestral(fecha_activacion, 1);
  }

  // Crear el PlanPago
  const plan = await base44.asServiceRole.entities.PlanPago.create({
    cliente_id,
    cliente_nombre,
    comercial_email,
    tipo_plan,
    frecuencia_pago,
    importe_total,
    importe_cuota,
    descuento_adelantado: !!descuento_adelantado,
    fecha_activacion,
    fecha_proximo_pago,
    estado: 'activo',
    notas: notas || ''
  });

  // Crear la primera CuotaPago
  await base44.asServiceRole.entities.CuotaPago.create({
    plan_pago_id: plan.id,
    cliente_id,
    cliente_nombre,
    comercial_email,
    numero_cuota: 1,
    importe: importe_cuota,
    fecha_vencimiento: fecha_proximo_pago,
    estado: 'pendiente',
    tarea_creada: false
  });

  return Response.json({ success: true, plan });
});