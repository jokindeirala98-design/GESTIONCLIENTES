import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Función llamada por automatizaciones cuando hay cambios en Cliente o DocumentosCliente.
 * Detecta qué ha cambiado y envía notificación WhatsApp al comercial propietario.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!data || event?.type !== 'update') {
      return Response.json({ ok: true, skipped: 'not an update event' });
    }

    // Solo notificamos cambios en entidad Cliente
    if (event.entity_name !== 'Cliente') {
      return Response.json({ ok: true, skipped: 'not Cliente entity' });
    }

    const cliente = data;
    const comercialEmail = cliente.propietario_email;

    if (!comercialEmail) {
      return Response.json({ ok: true, skipped: 'no comercial email' });
    }

    const nombreCliente = cliente.nombre_negocio || 'Un cliente';
    const mensajes = [];
    const archivosAdjuntos = [];

    // 1. INFORME FINAL SUBIDO: detectar si algún suministro nuevo tiene informe_final
    if (old_data && cliente.suministros && old_data.suministros) {
      for (const suministro of cliente.suministros) {
        const suministroAnterior = old_data.suministros?.find(s => s.id === suministro.id);
        
        // Comprobar si se añadió un informe final nuevo
        const tieneInformeNuevo = suministro.informe_final && (
          suministro.informe_final.archivos?.length > 0 || suministro.informe_final.url
        );
        const teniainformeAntes = suministroAnterior?.informe_final && (
          suministroAnterior.informe_final.archivos?.length > 0 || suministroAnterior.informe_final.url
        );

        if (tieneInformeNuevo && !teniainformeAntes) {
          // Construir mensaje con enlaces
          let msg = `✅ *¡Ya están listos los informes de ${nombreCliente}!*\n`;

          // Enlace informe de potencias (si existe en este suministro)
          if (suministro.informe_potencias?.url) {
            msg += `\n📈 Informe de potencias: ${suministro.informe_potencias.url}`;
          }

          // Enlace(s) informe económico/final
          if (suministro.informe_final.archivos?.length > 0) {
            for (const archivo of suministro.informe_final.archivos) {
              if (archivo.url) {
                msg += `\n📊 Informe económico: ${archivo.url}`;
              }
            }
          } else if (suministro.informe_final.url) {
            msg += `\n📊 Informe económico: ${suministro.informe_final.url}`;
          }

          mensajes.push(msg);
        }
      }
    }

    // 2. CONTRATO ORIGINAL SUBIDO: admin sube contrato original
    if (
      cliente.contrato_original_url &&
      (!old_data?.contrato_original_url || old_data.contrato_original_url !== cliente.contrato_original_url)
    ) {
      mensajes.push(`📑 *¡El contrato de ${nombreCliente} está listo para firmar!*\n\n📎 Contrato: ${cliente.contrato_original_url}`);
    }

    // 3. CONTRATO TRAMITADO: admin rellena contrato_presentado_texto (código de verificación)
    if (
      cliente.contrato_presentado_texto &&
      (!old_data?.contrato_presentado_texto || old_data.contrato_presentado_texto !== cliente.contrato_presentado_texto)
    ) {
      mensajes.push(`✅ El contrato de *${nombreCliente}* ha sido tramitado. Código/referencia: _${cliente.contrato_presentado_texto}_`);
    }

    if (mensajes.length === 0) {
      return Response.json({ ok: true, skipped: 'no relevant changes detected' });
    }

    // Enviar notificaciones vía email al comercial
    for (const mensaje of mensajes) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: comercialEmail,
        subject: `Voltis - Novedad en ${nombreCliente}`,
        body: mensaje.replace(/\*/g, '').replace(/_/g, '')
      });
    }

    // También notificar vía agente WhatsApp
    try {
      for (const mensaje of mensajes) {
        const conversation = await base44.asServiceRole.agents.createConversation({
          agent_name: 'gestor_clientes_whatsapp',
          user_email: comercialEmail,
          metadata: { source: 'notificacion_automatica' }
        });
        await base44.asServiceRole.agents.addMessage(conversation, {
          role: 'user',
          content: `[MENSAJE AUTOMÁTICO PARA ${comercialEmail}]: ${mensaje}`
        });
      }
    } catch (waError) {
      console.log('WhatsApp notification failed (email sent as fallback):', waError.message);
    }

    return Response.json({ ok: true, notificaciones: mensajes.length });

  } catch (error) {
    console.error('Error en notificarComercialWhatsapp:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});