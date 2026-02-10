import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function YaEsClienteDialog({ open, onClose, onConfirm, suministroNombre }) {
  const [tipoComision, setTipoComision] = useState("manual");
  const [comisionManual, setComisionManual] = useState("");

  const handleConfirm = () => {
    if (tipoComision === "manual") {
      if (!comisionManual || isNaN(parseFloat(comisionManual))) {
        return;
      }
      onConfirm({
        tipoComision: "manual",
        comision: parseFloat(comisionManual),
        tipoRappel: null
      });
    } else {
      // Rappel gas o luz_20
      onConfirm({
        tipoComision: "rappel",
        comision: 0, // Se calculará automáticamente
        tipoRappel: tipoComision
      });
    }
    
    // Resetear
    setTipoComision("manual");
    setComisionManual("");
  };

  const handleCancel = () => {
    setTipoComision("manual");
    setComisionManual("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">
            ✓ Marcar como cliente - {suministroNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Tipo de comisión *
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tipo-comision"
                  value="manual"
                  checked={tipoComision === "manual"}
                  onChange={(e) => setTipoComision(e.target.value)}
                  className="w-4 h-4 text-[#004D9D]"
                />
                <span className="text-sm text-gray-700 font-medium">Comisión Manual</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tipo-comision"
                  value="gas"
                  checked={tipoComision === "gas"}
                  onChange={(e) => setTipoComision(e.target.value)}
                  className="w-4 h-4 text-[#004D9D]"
                />
                <span className="text-sm text-gray-700 font-medium">Rappel Gas</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="tipo-comision"
                  value="luz_20"
                  checked={tipoComision === "luz_20"}
                  onChange={(e) => setTipoComision(e.target.value)}
                  className="w-4 h-4 text-[#004D9D]"
                />
                <span className="text-sm text-gray-700 font-medium">Rappel Luz 2.0</span>
              </label>
            </div>
          </div>

          {tipoComision === "manual" ? (
            <div>
              <Label htmlFor="comision-manual" className="text-sm font-medium text-gray-700">
                Comisión (€) *
              </Label>
              <Input
                id="comision-manual"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 150.00"
                value={comisionManual}
                onChange={(e) => setComisionManual(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                ℹ️ La comisión se calculará automáticamente según el rappel de {tipoComision === 'gas' ? 'Gas' : 'Luz 2.0'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700"
            disabled={tipoComision === "manual" && (!comisionManual || isNaN(parseFloat(comisionManual)))}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}