import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();

        // Descargamos el archivo desde la URL
        const fileResponse = await fetch(file_url);
        const fileBlob = await fileResponse.blob();

        // Lo subimos usando la integración de Base44
        const result = await base44.integrations.Core.UploadFile({ file: fileBlob });

        return Response.json({ uploaded_url: result.file_url });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});