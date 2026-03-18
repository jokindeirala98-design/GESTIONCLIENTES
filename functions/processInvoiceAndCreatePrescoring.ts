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

        // Check if this is a ZIP file BEFORE calling LLM (LLM doesn't support ZIP)
        const esZip = file_url?.toLowerCase().includes('.zip');

        // If ZIP: skip LLM extraction entirely, go directly to prescoring creation
        if (esZip && !esLuz20) {
            const clienteData = await base44.asServiceRole.entities.Cliente.get(cliente_id);
            const producto = esGas ? "Gas" : "Energía";

            const existingPrescorings = await base44.asServiceRole.entities.PrescoringGALP.filter({ nombre_razon_social: clienteData.nombre_negocio });
            const yaExisteSinCups = existingPrescorings.some(p => !p.cups || p.cups === "");
            if (!yaExisteSinCups) {
                const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
                const documentosCliente = allDocs[0];
                await base44.asServiceRole.entities.PrescoringGALP.create({
                    cups: "",
                    nombre_razon_social: clienteData.nombre_negocio,
                    cif: documentosCliente?.cif || "",
                    producto: producto,
                    tarifa: suministro_tipo_factura,
                    telefono: documentosCliente?.telefono || clienteData.telefono || "",
                    direccion_fiscal: documentosCliente?.direccion_fiscal || "",
                    enviado: false,
                    denegado: false,
                });
                console.log("PrescoringGALP creado (ZIP) para:", clienteData.nombre_negocio);

                const PROPIETARIOS = ['iranzu@voltisenergia.com', 'jose@voltisenergia.com'];
                for (const propietarioEmail of PROPIETARIOS) {
                    const tareasExistentes = await base44.asServiceRole.entities.TareaCorcho.filter({ propietario_email: propietarioEmail });
                    for (const tarea of tareasExistentes) {
                        await base44.asServiceRole.entities.TareaCorcho.update(tarea.id, { orden: (tarea.orden || 0) + 1 });
                    }
                    await base44.asServiceRole.entities.TareaCorcho.create({
                        descripcion: `Solicitar prescoring cliente: ${clienteData.nombre_negocio}`,
                        notas: `Cliente: ${clienteData.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro_tipo_factura} | ZIP adjunto (sin CUPS extraído)`,
                        completada: false,
                        prioridad: 'rojo',
                        orden: 0,
                        creador_email: propietarioEmail,
                        propietario_email: propietarioEmail,
                    });
                    console.log(`TareaCorcho (ZIP) creada para ${propietarioEmail}`);
                }
            }
            return Response.json({ success: true, extractedCups: null, esZip: true });
        }

        // 1. Extract CUPS and titular from the invoice using AI
        const EXTRACTION_PROMPT = `Eres un extractor de datos de facturas de energía española.

Tu tarea es encontrar DOS datos en el documento adjunto:

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
4. Si no lo encuentras, devuelve null.`;

        let extractionResult = await base44.integrations.Core.InvokeLLM({
            prompt: EXTRACTION_PROMPT,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    cups: { type: "string", description: "El código CUPS extraído del campo 'CUPS' de la factura. Null si no aparece." },
                    titular: { type: "string", description: "Nombre del titular o razón social del suministro. Null si no aparece." }
                }
            }
        });

        // Clean up
        let extractedCups = extractionResult?.cups || null;
        if (extractedCups === "null" || extractedCups === "" || extractedCups === "undefined") extractedCups = null;

        let extractedTitular = extractionResult?.titular || null;
        if (extractedTitular === "null" || extractedTitular === "" || extractedTitular === "undefined") extractedTitular = null;

        console.log("CUPS extraído:", extractedCups);
        console.log("Titular extraído:", extractedTitular);

        // Check if this is a ZIP file (can't extract CUPS from ZIP)
        const esZip = file_url?.toLowerCase().includes('.zip') || file_url?.includes('zip');

        // 2. Update the CUPS field directly in the suministro within Cliente
        if (extractedCups) {
            const clienteData = await base44.asServiceRole.entities.Cliente.get(cliente_id);
            const suministrosActualizados = (clienteData.suministros || []).map(s => {
                if (s.id === suministro_id && !s.cups) {
                    return { ...s, cups: extractedCups };
                }
                return s;
            });
            await base44.asServiceRole.entities.Cliente.update(cliente_id, { suministros: suministrosActualizados });
            console.log(`CUPS ${extractedCups} guardado en suministro ${suministro_id}`);

            // 3. Ensure DocumentosCliente exists and update nombre_empresa if extracted
            const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
            if (allDocs.length === 0) {
                await base44.asServiceRole.entities.DocumentosCliente.create({
                    cliente_id: cliente_id,
                    cliente_nombre: clienteData.nombre_negocio,
                    nombre_empresa: extractedTitular || "",
                });
                console.log("DocumentosCliente creado con titular:", extractedTitular);
            } else if (extractedTitular && !allDocs[0].nombre_empresa) {
                await base44.asServiceRole.entities.DocumentosCliente.update(allDocs[0].id, {
                    nombre_empresa: extractedTitular,
                });
                console.log("DocumentosCliente actualizado con titular:", extractedTitular);
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
                        nombre_razon_social: extractedTitular || clienteData.nombre_negocio,
                        cif: documentosCliente?.cif || "",
                        producto: producto,
                        tarifa: suministro_tipo_factura,
                        telefono: documentosCliente?.telefono || clienteData.telefono || "",
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
                            descripcion: `Solicitar prescoring CUPS: ${extractedCups} - ${clienteData.nombre_negocio}`,
                            notas: `Titular: ${extractedTitular || "No extraído"} | Cliente: ${clienteData.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro_tipo_factura}`,
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

        // If ZIP without CUPS: still create PrescoringGALP and TareaCorcho
        if (!extractedCups && !esLuz20) {
            const clienteData = await base44.asServiceRole.entities.Cliente.get(cliente_id);
            const producto = esGas ? "Gas" : "Energía";

            // Avoid duplicates: check by nombre_negocio with no cups
            const existingPrescorings = await base44.asServiceRole.entities.PrescoringGALP.filter({ nombre_razon_social: clienteData.nombre_negocio });
            const yaExisteSinCups = existingPrescorings.some(p => !p.cups || p.cups === "");
            if (!yaExisteSinCups) {
                const allDocs = await base44.asServiceRole.entities.DocumentosCliente.filter({ cliente_id: cliente_id });
                const documentosCliente = allDocs[0];
                await base44.asServiceRole.entities.PrescoringGALP.create({
                    cups: "",
                    nombre_razon_social: clienteData.nombre_negocio,
                    cif: documentosCliente?.cif || "",
                    producto: producto,
                    tarifa: suministro_tipo_factura,
                    telefono: documentosCliente?.telefono || clienteData.telefono || "",
                    direccion_fiscal: documentosCliente?.direccion_fiscal || "",
                    enviado: false,
                    denegado: false,
                });
                console.log("PrescoringGALP creado sin CUPS para:", clienteData.nombre_negocio);

                const PROPIETARIOS = ['iranzu@voltisenergia.com', 'jose@voltisenergia.com'];
                for (const propietarioEmail of PROPIETARIOS) {
                    const tareasExistentes = await base44.asServiceRole.entities.TareaCorcho.filter({ propietario_email: propietarioEmail });
                    for (const tarea of tareasExistentes) {
                        await base44.asServiceRole.entities.TareaCorcho.update(tarea.id, { orden: (tarea.orden || 0) + 1 });
                    }
                    await base44.asServiceRole.entities.TareaCorcho.create({
                        descripcion: `Solicitar prescoring cliente: ${clienteData.nombre_negocio}`,
                        notas: `Cliente: ${clienteData.nombre_negocio} | Producto: ${producto} | Tarifa: ${suministro_tipo_factura} | ZIP adjunto (sin CUPS extraído)`,
                        completada: false,
                        prioridad: 'rojo',
                        orden: 0,
                        creador_email: propietarioEmail,
                        propietario_email: propietarioEmail,
                    });
                    console.log(`TareaCorcho (ZIP sin CUPS) creada para ${propietarioEmail}`);
                }
            }
        }

        return Response.json({ success: true, extractedCups, extractedTitular });

    } catch (error) {
        console.error("Error in processInvoiceAndCreatePrescoring:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});