import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function calcularSiguienteVencimientoTrimestral(fechaVencimientoActual) {
  const fecha = new Date(fechaVencimientoActual);
  // Añadir 5 días para llegar al fin del trimestre
  fecha.setDate(fecha.getDate() + 5);
  // Avanzar 3 meses al siguiente trimestre
  fecha.setMonth(fecha.getMonth() + 3);
  // Retroceder 5 días (5 antes del fin del siguiente trimestre)
  fecha.setDate(fecha.getDate() - 5);
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

  // Marcar cuota como pagada
  const cuota = await base44.asServiceRole.entities.CuotaPago.get(cuota_id);
  await base44.asServiceRole.entities.CuotaPago.update(cuota_id, {
    estado: 'pagado',
    fecha_pago_real: hoy
  });

  // Obtener el plan
  const plan = await base44.asServiceRole.entities.PlanPago.get(cuota.plan_pago_id);

  if (plan.frecuencia_pago === 'trimestral' && plan.estado === 'activo') {
    // Calcular siguiente vencimiento
    const siguienteVencimiento = calcularSiguienteVencimientoTrimestral(cuota.fecha_vencimiento);
    const numeroCuotaSiguiente = cuota.numero_cuota + 1;

    // Crear la siguiente cuota
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

    // Actualizar fecha_proximo_pago en el plan
    await base44.asServiceRole.entities.PlanPago.update(plan.id, {
      fecha_proximo_pago: siguienteVencimiento
    });
  } else if (plan.frecuencia_pago === 'adelantado') {
    // Plan adelantado: una sola cuota, marcar plan como finalizado
    await base44.asServiceRole.entities.PlanPago.update(plan.id, {
      estado: 'finalizado'
    });
  }

  return Response.json({ success: true });
});