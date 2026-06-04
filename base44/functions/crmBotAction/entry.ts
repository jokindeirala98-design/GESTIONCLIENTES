import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CRM_URL = 'https://voltis-crm-bueno.vercel.app/api/whatsapp-bot';
const CRM_TOKEN = '34e7e82e8a9a95c63573edbb1f1370a6a661825adc525ace26a0e268a36fbdca';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // El agente llama a esta función — no requiere user session
    const payload = await req.json();

    const response = await fetch(CRM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.error || 'Error en CRM externo' }, { status: response.status });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});