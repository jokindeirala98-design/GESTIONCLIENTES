import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// This function is called by an entity automation when a Cliente is updated.
// It detects suministros with facturas that haven't been CUPS-processed yet and triggers the process.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        // Can be called by automation (event payload) or directly with { cliente_id }
        const clienteId = body.cliente_id || body.event?.entity_id || body.data?.id;

        if (!clienteId) {
            return Response.json({ error: 'Missing cliente_id' }, { status: 400 });
        }

        const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
        if (!cliente) {
            return Response.json({ error: 'Cliente not found' }, { status: 404 });
        }

        const suministros = cliente.suministros || [];
        let procesados = 0;

        for (const suministro of suministros) {
            if (suministro.cerrado) continue;
            if (!suministro.facturas || suministro.facturas.length === 0) continue;
            
            // Skip if CUPS already extracted
            if (suministro.cups) continue;

            // Try to process the first factura to extract CUPS
            const factura = suministro.facturas[0];
            if (!factura?.url) continue;

            console.log(`Procesando suministro ${suministro.id} (${suministro.nombre}) - factura: ${factura.url}`);

            try {
                // Extract CUPS using LLM vision
                const extractionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `Eres un extractor de datos de facturas de energía española. 
Analiza el documento adjunto (factura de electricidad o gas) y extrae el código CUPS.

El CUPS (Código Universal de Punto de Suministro) es un identificador único de 20 a 22 caracteres alfanuméricos que:
- Siempre empieza por "ES" 
- Seguido de números y letras mayúsculas
- Ejemplos reales: ES0021000006726872YJ, ES0031405775423001WF, ES0226060000307987ES
- Suele aparecer en la factura como "CUPS", "Código CUPS", "Punto de suministro" o similar

Extrae el CUPS tal cual aparece en la factura, sin modificarlo.
Si no encuentras ningún código que empiece por "ES" con ese formato, devuelve null.`,
                    file_urls: [factura.url],
                    response_json_schema: {
                        type: "object",
                        properties: {
                            cups: { type: "string", description: "El código CUPS completo extraído de la factura. Null si no se encuentra." }
                        }
                    }
                });

                let extractedCups = extractionResult?.cups || null;
                if (extractedCups === "null" || extractedCups === "" || extractedCups === "undefined") {
                    extractedCups = null;
                }

                console.log(`CUPS extraído para suministro ${suministro.id}: ${extractedCups}`);

                if (!extractedCups) continue;

                // Save CUPS in the suministro
                const suministrosActualizados = suministros.map(s => {
                    if (s.id === suministro.id && !s.cups) {
                        return { ...s, cups: extractedCups };
                    }
                    return s;
                });
                await base44.asServiceRole.entities.Cliente.update(clienteId, { suministros: suministrosActualizados });
                console.log(`CUPS ${extractedCups} guardado en suministro ${suministro.id}`);

                // Create PrescoringGALP (skip for tarifa 2.0)
                const esLuz20 = suministro.tipo_factura === "2.0";
                if (!esLuz20) {
                    const existingPrescorings = await base44.asServiceRole.entities.PrescoringGALP.filter({ cups: extractedCups });
                    if (existingPrescorings.length === 0) {
                        const GAS_TARIFAS = ["RL1", "RL2", "RL3", "RL4", "RL5", "RL6"];
                        const esGas = GAS_TARIFAS.includes(suministro.tipo_factura);
                        const producto = esGas ? "Gas" : "Energía";

                        const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: clienteId });
                        const documentosCliente = allDocs[0];

                        await base44.asServiceRole.entities.PrescoringGALP.create({
                            cups: extractedCups,
                            nombre_razon_social: cliente.nombre_negocio,
                            cif: documentosCliente?.cif || "",
                            producto: producto,
                            tarifa: suministro.tipo_factura,
                            telefono: documentosCliente?.telefono || cliente.telefono || "",
                            direccion_fiscal: documentosCliente?.direccion_fiscal || "",
                            enviado: false,
                            denegado: false,
                        });
                        console.log(`PrescoringGALP creado para CUPS: ${extractedCups}`);

                        // Create TareaCorcho for Iranzu and José
                        const PROPIETARIOS = ['iranzu@voltisenergia.com', 'jose@voltisenergia.com'];
                        for (const propietarioEmail of PROPIETARIOS) {
                            const tareasExistentes = await base44.asServiceRole.entities.TareaCorcho.filter({ propietario_email: propietarioEmail, completada: false });
                            for (const tarea of tareasExistentes) {
                                await base44.asServiceRole.entities.TareaCorcho.update(tarea.id, { orden: (tarea.orden || 0) + 1 });
                            }
                            await base44.asServiceRole.entities.TareaCorcho.create({
                                descripcion: `Solicitar prescoring CUPS: ${extractedCups} - ${cliente.nombre_negocio}`,
                                notas: `Cliente: ${cliente.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro.tipo_factura}`,
                                completada: false,
                                prioridad: 'rojo',
                                orden: 0,
                                creador_email: propietarioEmail,
                                propietario_email: propietarioEmail,
                            });
                            console.log(`TareaCorcho creada para ${propietarioEmail}`);
                        }
                    }
                }

                procesados++;
            } catch (suministroError) {
                console.error(`Error procesando suministro ${suministro.id}:`, suministroError.message);
            }
        }

        return Response.json({ success: true, procesados });

    } catch (error) {
        console.error("Error in procesarFacturasNuevas:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});