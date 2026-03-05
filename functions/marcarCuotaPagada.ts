import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Siguiente vencimiento: vencimiento_anterior + 3 meses
// (el vencimiento ya tiene los -5 días incorporados, simplemente avanzamos 3 meses)
function calcularSiguienteVencimiento(fechaVencimientoActual) {
  const fecha = new Date(fechaVencimientoActual + 'T12:00:00');
  fecha.setMonth(fecha.getMonth() + 3);
  return fecha.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { cuota_id } = await req.json();

  if (!cuota_id) {
    return Response.json({ error: 'Falta cuota_id' }, { status: 400 });
  }

  const hoy = new Date().toISOString().split('T')[0];

  const cuota = await base44.asServiceRole.entities.CuotaPago.get(cuota_id);
  await base44.asServiceRole.entities.CuotaPago.update(cuota_id, {
    estado: 'pagado',
    fecha_pago_real: hoy
  });

  const plan = await base44.asServiceRole.entities.PlanPago.get(cuota.plan_pago_id);

  if (plan.frecuencia_pago === 'trimestral' && plan.estado === 'activo') {
    // Siguiente vencimiento: vencimiento actual + 3 meses
    const siguienteVencimiento = calcularSiguienteVencimiento(cuota.fecha_vencimiento);
    const numeroCuotaSiguiente = cuota.numero_cuota + 1;

    await base44.asServiceRole.entities.CuotaPago.create({
      plan_pago_id: plan.id,
      cliente_id: plan.cliente_id,
      cliente_nombre: plan.cliente_nombre,
      comercial_email: plan.comercial_email,
      numero_cuota: numeroCuotaSiguiente,
      importe: plan.importe_cuota,
      fecha_vencimiento: siguienteVencimiento,
      estado: 'pendiente',
      tarea_creada: false
    });

    await base44.asServiceRole.entities.PlanPago.update(plan.id, {
      fecha_proximo_pago: siguienteVencimiento
    });
  } else if (plan.frecuencia_pago === 'adelantado') {
    await base44.asServiceRole.entities.PlanPago.update(plan.id, {
      estado: 'finalizado'
    });
  }

  return Response.json({ success: true });
});