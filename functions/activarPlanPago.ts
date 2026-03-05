import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Calcula la fecha de vencimiento del primer trimestre a partir de fecha_activacion
// El vencimiento es 5 días ANTES del fin del trimestre natural
function calcularFechaVencimientoTrimestral(fechaActivacion, numeroCuota) {
  const fecha = new Date(fechaActivacion);
  
  // Determinar el trimestre de activación (0=Q1, 1=Q2, 2=Q3, 3=Q4)
  const mesActivacion = fecha.getMonth(); // 0-11
  const trimestreActivacion = Math.floor(mesActivacion / 3); // 0-3
  const anioActivacion = fecha.getFullYear();

  // El fin del trimestre de activación
  // Q1 fin: 31 marzo, Q2 fin: 30 junio, Q3 fin: 30 septiembre, Q4 fin: 31 diciembre
  const finesTrimestre = [
    [2, 31],  // Q1: marzo 31
    [5, 30],  // Q2: junio 30
    [8, 30],  // Q3: septiembre 30
    [11, 31]  // Q4: diciembre 31
  ];

  // La primera cuota vence 5 días antes del fin del primer trimestre completo DESPUÉS de la activación
  // Si se activa en Q1, el primer vencimiento es 5 días antes del fin del Q1
  // Sumamos (numeroCuota - 1) trimestres al trimestre de activación
  const trimestreObjetivo = (trimestreActivacion + numeroCuota - 1) % 4;
  const añosExtra = Math.floor((trimestreActivacion + numeroCuota - 1) / 4);
  const anioObjetivo = anioActivacion + añosExtra;

  const [mes, dia] = finesTrimestre[trimestreObjetivo];
  const finTrimestre = new Date(anioObjetivo, mes, dia);
  
  // 5 días antes del fin del trimestre
  finTrimestre.setDate(finTrimestre.getDate() - 5);
  
  return finTrimestre.toISOString().split('T')[0];
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
    // 5% descuento
    importe_cuota = parseFloat((importe_total * 0.95).toFixed(2));
  }

  // Calcular fecha primer pago
  let fecha_proximo_pago;
  if (frecuencia_pago === 'adelantado') {
    fecha_proximo_pago = fecha_activacion;
  } else {
    // Trimestral: 5 días antes del fin del primer trimestre
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