import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Los pagos trimestrales caen siempre el día 27 de los meses de cierre:
// Q1 → 27 marzo, Q2 → 27 junio, Q3 → 27 septiembre, Q4 → 27 diciembre
function calcularSiguienteVencimientoTrimestral(fechaVencimientoActual) {
  const mesesCierre = [2, 5, 8, 11]; // marzo, junio, septiembre, diciembre (0-indexed)

  const fecha = new Date(fechaVencimientoActual + 'T12:00:00');
  const mesActual = fecha.getMonth();
  const anioActual = fecha.getFullYear();

  const indiceActual = mesesCierre.indexOf(mesActual);
  const indiceSiguiente = (indiceActual + 1) % 4;
  const aniosSiguiente = indiceActual === 3 ? anioActual + 1 : anioActual;

  const mesSiguiente = mesesCierre[indiceSiguiente];
  return `${aniosSiguiente}-${String(mesSiguiente + 1).padStart(2, '0')}-27`;
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
    const siguienteVencimiento = calcularSiguienteVencimientoTrimestral(cuota.fecha_vencimiento);
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