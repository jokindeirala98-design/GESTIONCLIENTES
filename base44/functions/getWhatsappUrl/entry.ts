import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const whatsappUrl = base44.agents.getWhatsAppConnectURL('corcho_whatsapp');

    return Response.json({ url: whatsappUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});