import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url, cliente_id, suministro_id, suministro_tipo_factura } = await req.json();

        if (!file_url || !cliente_id || !suministro_id || !suministro_tipo_factura) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const GAS_TARIFAS = ["RL1", "RL2", "RL3", "RL4", "RL5", "RL6"];
        const esGas = GAS_TARIFAS.includes(suministro_tipo_factura);
        const esLuz20 = !esGas && suministro_tipo_factura === "2.0";

        // 1. Extract CUPS from the invoice using AI
        const extractionResult = await base44.integrations.Core.InvokeLLM({
            prompt: `Analiza esta factura de energía y extrae ÚNICAMENTE el código CUPS. 
El CUPS es un código de 20-22 caracteres que empieza por "ES" seguido de números y letras.
Ejemplos de formato: ES0021000006726872YJ, ES0031405775423001WF
Si no encuentras un CUPS válido, devuelve null.`,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    cups: { type: "string", description: "Código CUPS extraído de la factura, o null si no se encuentra" }
                }
            }
        });

        const extractedCups = extractionResult?.cups || null;
        console.log("CUPS extraído:", extractedCups);

        // 2. Update DocumentosCliente with extracted CUPS
        const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
        let documentosCliente = allDocs[0];

        const clienteData = await base44.asServiceRole.entities.Cliente.get(cliente_id);

        if (!documentosCliente) {
            documentosCliente = await base44.asServiceRole.entities.DocumentosCliente.create({
                cliente_id: cliente_id,
                cliente_nombre: clienteData.nombre_negocio,
                cups: extractedCups || undefined,
            });
        } else if (extractedCups && !documentosCliente.cups_manual) {
            // Only update CUPS if it hasn't been set manually
            await base44.asServiceRole.entities.DocumentosCliente.update(documentosCliente.id, { cups: extractedCups });
        }

        // 3. Create PrescoringGALP entry if NOT Luz 2.0 and CUPS was found
        if (!esLuz20 && extractedCups) {
            // Check if a prescoring with this CUPS already exists to avoid duplicates
            const existingPrescorings = await base44.asServiceRole.entities.PrescoringGALP.filter({ cups: extractedCups });
            if (existingPrescorings.length === 0) {
                const producto = esGas ? "Gas" : "Energía";
                await base44.asServiceRole.entities.PrescoringGALP.create({
                    cups: extractedCups,
                    nombre_razon_social: clienteData.nombre_negocio,
                    cif: documentosCliente?.cif || "",
                    producto: producto,
                    tarifa: suministro_tipo_factura,
                    telefono: documentosCliente?.telefono || clienteData.telefono || "",
                    direccion_fiscal: documentosCliente?.direccion_fiscal || "",
                    enviado: false,
                    denegado: false,
                });
                console.log("PrescoringGALP creado para CUPS:", extractedCups);
            }
        }

        return Response.json({ success: true, extractedCups });

    } catch (error) {
        console.error("Error in processInvoiceAndCreatePrescoring:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});