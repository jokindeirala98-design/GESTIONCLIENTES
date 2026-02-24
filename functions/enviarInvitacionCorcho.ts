import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const whatsappUrl = base44.agents.getWhatsAppConnectURL('corcho_whatsapp');

    const destinatarios = [
      { email: 'nicolasvoltis@gmail.com', nombre: 'Nicolás' },
      { email: 'jokin@voltisenergia.com', nombre: 'Jokin' },
      { email: 'jose@voltisenergia.com', nombre: 'José' }
    ];

    for (const dest of destinatarios) {
      await base44.integrations.Core.SendEmail({
        to: dest.email,
        subject: '🤖 Tu acceso al Bot de Tareas de Voltis',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #004D9D, #00AEEF); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Voltis Energía</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Bot de Tareas WhatsApp</p>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0;">
              <p style="color: #333; font-size: 16px;">Hola <strong>${dest.nombre}</strong>,</p>
              <p style="color: #555; font-size: 15px;">Ya puedes añadir tareas al corcho directamente desde WhatsApp, por texto o por audio.</p>
              
              <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-weight: bold; color: #004D9D; font-size: 14px;">📌 Cómo usarlo:</p>
                <p style="margin: 4px 0; color: #555; font-size: 13px;">• Sin nombre → tarea para Iranzu</p>
                <p style="margin: 4px 0; color: #555; font-size: 13px;">• "tarea nico ..." → tarea para Nicolás</p>
                <p style="margin: 4px 0; color: #555; font-size: 13px;">• "tarea jose ..." → tarea para José</p>
                <p style="margin: 4px 0; color: #555; font-size: 13px;">• "tarea iranzu ..." → tarea para Iranzu</p>
              </div>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${whatsappUrl}" 
                   style="background: #25D366; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                  💬 Abrir WhatsApp Bot
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">Al hacer clic, se abrirá WhatsApp con el mensaje "empezar" listo para enviar.</p>
            </div>
          </div>
        `
      });
    }

    return Response.json({ success: true, message: 'Correos enviados correctamente a Nicolás, Jokin y José' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});