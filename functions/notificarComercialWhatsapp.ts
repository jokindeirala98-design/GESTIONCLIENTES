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
      mensajes.push(`📑 *${nombreCliente}* tiene el contrato listo para firmar`);
      archivosAdjuntos.push(cliente.contrato_original_url);
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

    // Enviar notificaciones vía agente de WhatsApp al comercial
    for (const mensaje of mensajes) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: comercialEmail,
        subject: `Voltis - Novedad en ${nombreCliente}`,
        body: mensaje.replace(/\*/g, '').replace(/_/g, '') + 
          (archivosAdjuntos.length > 0 ? `\n\nDocumentos disponibles:\n${archivosAdjuntos.join('\n')}` : '')
      });
    }

    // También intentar notificar vía agente WhatsApp (conversación proactiva)
    try {
      // Buscar el usuario comercial para obtener su número de WhatsApp
      const usuarios = await base44.asServiceRole.entities.User.list();
      const comercialUser = usuarios.find(u => u.email === comercialEmail);

      if (comercialUser) {
        for (let i = 0; i < mensajes.length; i++) {
          const mensaje = mensajes[i];
          const adjunto = archivosAdjuntos[i] ? `\n\n📎 ${archivosAdjuntos[i]}` : '';
          
          await base44.asServiceRole.agents.sendProactiveMessage({
            agent_name: 'comerciales_whatsapp',
            user_email: comercialEmail,
            message: mensaje + adjunto
          });
        }
      }
    } catch (waError) {
      // Si falla WhatsApp, el email ya fue enviado, no es crítico
      console.log('WhatsApp proactive failed (email sent as fallback):', waError.message);
    }

    return Response.json({ ok: true, notificaciones: mensajes.length });

  } catch (error) {
    console.error('Error en notificarComercialWhatsapp:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});