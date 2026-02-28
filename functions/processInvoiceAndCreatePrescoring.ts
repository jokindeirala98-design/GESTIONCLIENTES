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
        const isImage = file_url.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp)/i);

        let extractionResult;
        if (isImage) {
            // For images: use ExtractDataFromUploadedFile which handles images better
            extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url: file_url,
                json_schema: {
                    type: "object",
                    properties: {
                        cups: { type: "string", description: "El código CUPS completo de la factura. Empieza siempre por ES seguido de 18-20 caracteres alfanuméricos. Ej: ES0021000006726872YJ" }
                    }
                }
            });
            // ExtractDataFromUploadedFile returns { status, output } 
            if (extractionResult?.status === 'success' && extractionResult?.output) {
                extractionResult = extractionResult.output;
            } else {
                extractionResult = { cups: null };
            }
        } else {
            extractionResult = await base44.integrations.Core.InvokeLLM({
                prompt: `Eres un extractor de datos de facturas de energía española. 
Analiza el documento adjunto (factura de electricidad o gas) y extrae el código CUPS.

El CUPS (Código Universal de Punto de Suministro) es un identificador único de 20 a 22 caracteres alfanuméricos que:
- Siempre empieza por "ES" 
- Seguido de números y letras mayúsculas
- Ejemplos reales: ES0021000006726872YJ, ES0031405775423001WF, ES0226060000307987ES, ES0021000017072361EX0F
- Suele aparecer en la factura como "CUPS", "Código CUPS", "Punto de suministro" o similar

Extrae el CUPS tal cual aparece en la factura, sin modificarlo. 
Si no encuentras ningún código que empiece por "ES" con ese formato, devuelve null en el campo cups.`,
                file_urls: [file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        cups: { type: "string", description: "El código CUPS completo extraído de la factura. Null si no se encuentra." }
                    }
                }
            });
        }

        // Clean up: if LLM returns string "null" or empty, treat as null
        let extractedCups = extractionResult?.cups || null;
        if (extractedCups === "null" || extractedCups === "" || extractedCups === "undefined") {
            extractedCups = null;
        }
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

                // Crear tarea en el corcho de Iranzu para solicitar prescoring (urgente, primera)
                const IRANZU_EMAIL = 'iranzu@voltisenergia.com';
                // Desplazar todas las tareas existentes de Iranzu para que la nueva quede primera
                const tareasIranzu = await base44.asServiceRole.entities.TareaCorcho.filter({ propietario_email: IRANZU_EMAIL });
                for (const tarea of tareasIranzu) {
                    await base44.asServiceRole.entities.TareaCorcho.update(tarea.id, { orden: (tarea.orden || 0) + 1 });
                }
                await base44.asServiceRole.entities.TareaCorcho.create({
                    descripcion: `Solicitar prescoring CUPS: ${extractedCups}`,
                    notas: `Cliente: ${clienteData.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro_tipo_factura}`,
                    completada: false,
                    prioridad: 'rojo',
                    orden: 0,
                    creador_email: IRANZU_EMAIL,
                    propietario_email: IRANZU_EMAIL,
                });
                console.log("TareaCorcho creada para Iranzu, CUPS:", extractedCups);
            }
        }

        return Response.json({ success: true, extractedCups });

    } catch (error) {
        console.error("Error in processInvoiceAndCreatePrescoring:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});