import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

        // 0. Si el suministro ya tiene CUPS, no hacer nada (factura duplicada/página adicional)
        const clienteDataPre = await base44.asServiceRole.entities.Cliente.get(cliente_id);
        const suministroPre = (clienteDataPre.suministros || []).find(s => s.id === suministro_id);
        if (suministroPre?.cups) {
            console.log(`Suministro ${suministro_id} ya tiene CUPS (${suministroPre.cups}), ignorando esta factura.`);
            return Response.json({ success: true, extractedCups: suministroPre.cups, skipped: true });
        }

        // 1. Extract CUPS from the invoice using AI
        const isImage = file_url.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp)/i);

        let extractionResult;
        if (isImage) {
            extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url: file_url,
                json_schema: {
                    type: "object",
                    properties: {
                        cups: { type: "string", description: "El código CUPS completo de la factura. Empieza siempre por ES seguido de 18-20 caracteres alfanuméricos. Ej: ES0021000006726872YJ" }
                    }
                }
            });
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

        // Clean up
        let extractedCups = extractionResult?.cups || null;
        if (extractedCups === "null" || extractedCups === "" || extractedCups === "undefined") {
            extractedCups = null;
        }
        console.log("CUPS extraído:", extractedCups);

        // 2. Update the CUPS field directly in the suministro within Cliente
        if (extractedCups) {
            const clienteData = await base44.asServiceRole.entities.Cliente.get(cliente_id);
            const suministrosActualizados = (clienteData.suministros || []).map(s => {
                // Only update if this suministro doesn't have a CUPS yet
                if (s.id === suministro_id && !s.cups) {
                    return { ...s, cups: extractedCups };
                }
                return s;
            });
            await base44.asServiceRole.entities.Cliente.update(cliente_id, { suministros: suministrosActualizados });
            console.log(`CUPS ${extractedCups} guardado en suministro ${suministro_id}`);

            // 3. Also ensure DocumentosCliente exists (for other docs like CIF, IBAN, DNI)
            const clienteDataFresh = clienteData;
            const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
            if (allDocs.length === 0) {
                await base44.asServiceRole.entities.DocumentosCliente.create({
                    cliente_id: cliente_id,
                    cliente_nombre: clienteDataFresh.nombre_negocio,
                });
                console.log("DocumentosCliente creado (sin CUPS, ya está en suministro)");
            }

            // 4. Create PrescoringGALP if NOT Luz 2.0
            if (!esLuz20) {
                const existingPrescorings = await base44.asServiceRole.entities.PrescoringGALP.filter({ cups: extractedCups });
                if (existingPrescorings.length === 0) {
                    const producto = esGas ? "Gas" : "Energía";
                    const allDocs2 = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
                    const documentosCliente = allDocs2[0];
                    await base44.asServiceRole.entities.PrescoringGALP.create({
                        cups: extractedCups,
                        nombre_razon_social: clienteDataFresh.nombre_negocio,
                        cif: documentosCliente?.cif || "",
                        producto: producto,
                        tarifa: suministro_tipo_factura,
                        telefono: documentosCliente?.telefono || clienteDataFresh.telefono || "",
                        direccion_fiscal: documentosCliente?.direccion_fiscal || "",
                        enviado: false,
                        denegado: false,
                    });
                    console.log("PrescoringGALP creado para CUPS:", extractedCups);

                    // Crear tarea en el corcho para Iranzu y José
                    const PROPIETARIOS = ['iranzu@voltisenergia.com', 'jose@voltisenergia.com'];
                    for (const propietarioEmail of PROPIETARIOS) {
                        const tareasExistentes = await base44.asServiceRole.entities.TareaCorcho.filter({ propietario_email: propietarioEmail });
                        for (const tarea of tareasExistentes) {
                            await base44.asServiceRole.entities.TareaCorcho.update(tarea.id, { orden: (tarea.orden || 0) + 1 });
                        }
                        await base44.asServiceRole.entities.TareaCorcho.create({
                            descripcion: `Solicitar prescoring CUPS: ${extractedCups} - ${clienteDataFresh.nombre_negocio}`,
                            notas: `Cliente: ${clienteDataFresh.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro_tipo_factura}`,
                            completada: false,
                            prioridad: 'rojo',
                            orden: 0,
                            creador_email: propietarioEmail,
                            propietario_email: propietarioEmail,
                        });
                        console.log(`TareaCorcho creada para ${propietarioEmail}, CUPS: ${extractedCups}`);
                    }
                }
            }
        }

        return Response.json({ success: true, extractedCups });

    } catch (error) {
        console.error("Error in processInvoiceAndCreatePrescoring:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});