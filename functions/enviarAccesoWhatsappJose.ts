import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const whatsappUrl = `https://app.base44.com/whatsapp-connect?agent=corcho_whatsapp&app=${Deno.env.get('BASE44_APP_ID')}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'jose@voltisenergia.com',
      subject: '📲 Acceso al bot de tareas BOTtis Energía',
      body: `Hola José,\n\nYa tienes acceso al bot de WhatsApp para gestionar tareas en el corcho.\n\n👉 Haz clic en el siguiente enlace para conectarte:\n${whatsappUrl}\n\nCómo usarlo:\n• Escribe la tarea directamente → te preguntará para quién es\n• "tarea jose [descripción]" → tarea para ti\n• "tarea nico [descripción]" → tarea para Nicolás\n• "tarea iranzu [descripción]" → tarea para Iranzu\n• También puedes enviar audios de voz 🎙️\n\nSaludos,\nVoltis Energía`
    });

    return Response.json({ ok: true, message: 'Email enviado a jose@voltisenergia.com' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});