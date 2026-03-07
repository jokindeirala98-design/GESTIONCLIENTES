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
                // Extract CUPS and titular using LLM vision
                const extractionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `Eres un extractor de datos de facturas de energía española.

Tu tarea es encontrar TRES datos en el documento adjunto:

DATO 1 - CUPS:
1. El CUPS aparece SIEMPRE junto a la etiqueta "CUPS" en la factura. Busca específicamente la línea o campo que diga exactamente "CUPS" y extrae el valor que aparece a su derecha o debajo.
2. El CUPS empieza siempre por "ES" seguido de dígitos y letras mayúsculas. Tiene entre 20 y 22 caracteres en total.
3. Ejemplos válidos: ES0021000006726872YJ, ES0031405775423001WF, ES0021000017072361EX0F
4. Copia el CUPS EXACTAMENTE como aparece, sin modificarlo ni inventarlo.
5. Si no ves la etiqueta "CUPS" claramente en esta página, devuelve null. NO inventes un código.
6. Solo puede haber UN CUPS por suministro. Si ves varios códigos que empiecen por ES, elige SOLO el que está junto a la etiqueta "CUPS".

DATO 2 - TITULAR:
1. Busca el nombre del titular o razón social del suministro. Suele aparecer junto a etiquetas como "Titular", "Razón Social", "Nombre del titular", "Cliente" o similar.
2. Es el nombre de la persona o empresa que figura como titular del contrato de energía (NO la empresa distribuidora ni comercializadora).
3. Devuelve el nombre exactamente como aparece en la factura.
4. Si no lo encuentras, devuelve null.

DATO 3 - DIRECCIÓN FISCAL:
1. Busca la dirección FISCAL o de FACTURACIÓN del titular. Esta es DISTINTA a la dirección del punto de suministro (donde está el contador).
2. Suele aparecer junto a etiquetas como "Dirección fiscal", "Dirección de facturación", "Domicilio fiscal", "Datos del titular", o en la cabecera de la factura junto al nombre del titular.
3. NO confundas con la "Dirección de suministro", "Dirección del punto de suministro" o "Dirección del contador".
4. Incluye toda la dirección completa: calle, número, piso, código postal, ciudad y provincia si aparecen.
5. Si no puedes distinguir con claridad cuál es la fiscal (por ejemplo si solo aparece una dirección), devuelve null. Solo devuelve si es claramente identificable como fiscal/facturación.`,
                    file_urls: [factura.url],
                    response_json_schema: {
                        type: "object",
                        properties: {
                            cups: { type: "string", description: "El código CUPS extraído del campo 'CUPS' de la factura. Null si no aparece." },
                            titular: { type: "string", description: "Nombre del titular o razón social del suministro. Null si no aparece." },
                            direccion_fiscal: { type: "string", description: "Dirección fiscal o de facturación del titular. Solo si es claramente distinguible de la dirección de suministro. Null si no se puede determinar con certeza." }
                        }
                    }
                });

                let extractedCups = extractionResult?.cups || null;
                if (extractedCups === "null" || extractedCups === "" || extractedCups === "undefined") extractedCups = null;

                let extractedTitular = extractionResult?.titular || null;
                if (extractedTitular === "null" || extractedTitular === "" || extractedTitular === "undefined") extractedTitular = null;

                console.log(`CUPS extraído para suministro ${suministro.id}: ${extractedCups}`);
                console.log(`Titular extraído para suministro ${suministro.id}: ${extractedTitular}`);

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

                // Update DocumentosCliente with titular if extracted
                if (extractedTitular) {
                    const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: clienteId });
                    if (allDocs.length === 0) {
                        await base44.asServiceRole.entities.DocumentosCliente.create({
                            cliente_id: clienteId,
                            cliente_nombre: cliente.nombre_negocio,
                            nombre_empresa: extractedTitular,
                        });
                        console.log("DocumentosCliente creado con titular:", extractedTitular);
                    } else if (!allDocs[0].nombre_empresa) {
                        await base44.asServiceRole.entities.DocumentosCliente.update(allDocs[0].id, {
                            nombre_empresa: extractedTitular,
                        });
                        console.log("DocumentosCliente actualizado con titular:", extractedTitular);
                    }
                }

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
                            nombre_razon_social: extractedTitular || cliente.nombre_negocio,
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
                                notas: `Titular: ${extractedTitular || "No extraído"} | Cliente: ${cliente.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro.tipo_factura}`,
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