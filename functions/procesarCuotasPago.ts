import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Calcula la fecha de vencimiento del siguiente trimestre (5 días antes del fin del trimestre)
function calcularSiguienteVencimientoTrimestral(fechaVencimientoActual) {
  const fecha = new Date(fechaVencimientoActual);
  
  // Añadir 5 días para llegar al fin del trimestre actual
  fecha.setDate(fecha.getDate() + 5);
  
  // Avanzar al siguiente mes del trimestre (sumar 3 meses)
  fecha.setMonth(fecha.getMonth() + 3);
  
  // Retroceder 5 días
  fecha.setDate(fecha.getDate() - 5);
  
  return fecha.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Solo administradores' }, { status: 403 });
  }

  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];

  // Obtener todos los planes activos
  const planes = await base44.asServiceRole.entities.PlanPago.filter({ estado: 'activo' });
  
  let tareasCreadas = 0;
  let cuotasGeneradas = 0;

  for (const plan of planes) {
    if (plan.frecuencia_pago !== 'trimestral') continue;

    // Buscar cuotas pendientes de este plan
    const cuotas = await base44.asServiceRole.entities.CuotaPago.filter({ plan_pago_id: plan.id, estado: 'pendiente' });
    
    for (const cuota of cuotas) {
      // Si hoy es el día del vencimiento (el sistema se ejecuta diariamente)
      // En realidad la cuota ya fue creada con la fecha correcta (5 días antes del fin de trimestre)
      // Solo creamos tarea si no se ha creado aún y hoy es la fecha de vencimiento
      if (cuota.fecha_vencimiento === hoyStr && !cuota.tarea_creada) {
        const descripcionTarea = `PAGO TRIMESTRAL - ${cuota.cliente_nombre}`;

        // Crear tarea para Iranzu
        await base44.asServiceRole.entities.TareaCorcho.create({
          descripcion: descripcionTarea,
          notas: `Cuota nº${cuota.numero_cuota} | Importe: ${cuota.importe}€ | Vencimiento: ${cuota.fecha_vencimiento}`,
          completada: false,
          prioridad: 'rojo',
          orden: 0,
          propietario_email: 'iranzu@voltisenergia.com',
          creador_email: 'sistema@voltisenergia.com'
        });

        // Crear tarea también para el comercial dueño (si no es Iranzu)
        if (plan.comercial_email && plan.comercial_email !== 'iranzu@voltisenergia.com') {
          await base44.asServiceRole.entities.TareaCorcho.create({
            descripcion: descripcionTarea,
            notas: `Cuota nº${cuota.numero_cuota} | Importe: ${cuota.importe}€ | Vencimiento: ${cuota.fecha_vencimiento}`,
            completada: false,
            prioridad: 'rojo',
            orden: 0,
            propietario_email: plan.comercial_email,
            creador_email: 'sistema@voltisenergia.com'
          });
        }

        // Marcar tarea como creada
        await base44.asServiceRole.entities.CuotaPago.update(cuota.id, { tarea_creada: true });
        tareasCreadas++;
      }
    }

    // Si el plan no tiene más cuotas pendientes futuras, generar la siguiente
    const todasCuotas = await base44.asServiceRole.entities.CuotaPago.filter({ plan_pago_id: plan.id });
    const pendientes = todasCuotas.filter(c => c.estado === 'pendiente');
    
    // Solo generamos la siguiente cuota cuando la actual ha sido pagada
    // (esto se controla desde marcarCuotaPagada)
  }

  return Response.json({ success: true, tareasCreadas, cuotasGeneradas });
});