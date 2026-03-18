import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Primer vencimiento: fecha_activacion + 3 meses - 5 días
function calcularPrimerVencimiento(fechaActivacion) {
  const fecha = new Date(fechaActivacion + 'T12:00:00');
  fecha.setMonth(fecha.getMonth() + 3);
  fecha.setDate(fecha.getDate() - 5);
  return fecha.toISOString().split('T')[0];
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
    // Trimestral: activacion + 3 meses - 5 días
    fecha_proximo_pago = calcularPrimerVencimiento(fecha_activacion);
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