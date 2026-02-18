import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ALLOWED_EMAILS = [
  "iranzu@voltisenergia.com",
  "jose@voltisenergia.com",
  "nicolasvoltis@gmail.com",
  "nicolas@voltisenergia.com"
];

const COLUMNS = [
  { key: "cups", label: "CUPS", width: "200px" },
  { key: "nombre_razon_social", label: "NOMBRE O RAZÓN SOCIAL", width: "200px" },
  { key: "cif", label: "CIF", width: "130px" },
  { key: "producto", label: "PRODUCTO", width: "130px" },
  { key: "tarifa", label: "TARIFA", width: "100px" },
  { key: "qa", label: "Qa", width: "100px" },
  { key: "part_auto", label: "ENTIDAD", width: "120px" },
  { key: "telefono", label: "TELÉFONO", width: "130px" },
  { key: "poblacion", label: "POBLACIÓN", width: "140px" },
  { key: "direccion_fiscal", label: "DIRECCIÓN FISCAL", width: "200px" },
];

export default function PrescoringsGALP() {
  const [user, setUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [editingCells, setEditingCells] = useState({});
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [addDialog, setAddDialog] = useState(false);
  const [newProducto, setNewProducto] = useState("");
  const [newTarifa, setNewTarifa] = useState("");
  const [newPartAuto, setNewPartAuto] = useState("");
  const queryClient = useQueryClient();

  const tarifasEnergia = ["2.0TD", "3.0TD", "6.1TD", "6.2TD"];
  const tarifasGas = ["RL1", "RL2", "RL3", "RL4", "RL5", "RL6"];

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      if (!ALLOWED_EMAILS.includes(u.email)) {
        setAccessDenied(true);
      }
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["prescorings_galp"],
    queryFn: () => base44.entities.PrescoringGALP.list("-created_date"),
    enabled: !!user && !accessDenied,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PrescoringGALP.create(data),
    onSuccess: () => queryClient.invalidateQueries(["prescorings_galp"]),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PrescoringGALP.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(["prescorings_galp"]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PrescoringGALP.delete(id),
    onSuccess: () => queryClient.invalidateQueries(["prescorings_galp"]),
  });

  const openAddDialog = () => {
    setNewProducto("");
    setNewTarifa("");
    setNewPartAuto("");
    setAddDialog(true);
  };

  const handleAddRow = () => {
    if (!newProducto || !newTarifa || !newPartAuto) {
      toast.error("Completa todos los campos");
      return;
    }
    createMutation.mutate(
      { producto: newProducto, tarifa: newTarifa, part_auto: newPartAuto },
      { onSuccess: () => setAddDialog(false) }
    );
  };

  const handleCellChange = (rowId, key, value) => {
    setEditingCells(prev => ({
      ...prev,
      [`${rowId}_${key}`]: value
    }));
  };

  const handleCellBlur = (row, key) => {
    const cellKey = `${row.id}_${key}`;
    if (editingCells[cellKey] !== undefined && editingCells[cellKey] !== (row[key] || "")) {
      updateMutation.mutate({ id: row.id, data: { [key]: editingCells[cellKey] } });
    }
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const toggleRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.map(r => r.id)));
    }
  };

  const copySelected = () => {
    const selected = filteredRows.filter(r => selectedRows.has(r.id));
    const text = selected.map(row =>
      COLUMNS.map(col => row[col.key] || "").join("\t")
    ).join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`${selected.length} fila(s) copiadas al portapapeles`);
  };

  const filteredRows = rows.filter(row => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return COLUMNS.some(col => (row[col.key] || "").toLowerCase().includes(s));
  });

  const getCellValue = (row, key) => {
    const cellKey = `${row.id}_${key}`;
    return editingCells[cellKey] !== undefined ? editingCells[cellKey] : (row[key] || "");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-16 h-16 border-4 border-[#004D9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <p className="text-[#666666] text-lg">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#004D9D]">Prescorings GALP</h1>
          <p className="text-[#666666] mt-1">{rows.length} cliente{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          {selectedRows.size > 0 && (
            <Button onClick={copySelected} variant="outline" className="border-[#004D9D] text-[#004D9D] shrink-0">
              <Copy className="w-4 h-4 mr-2" />
              Copiar {selectedRows.size} fila(s)
            </Button>
          )}
          <Button onClick={openAddDialog} className="bg-[#004D9D] hover:bg-[#003a7a] text-white shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Añadir cliente
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#004D9D] text-white">
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filteredRows.length > 0 && selectedRows.size === filteredRows.length}
                  onChange={toggleAll}
                  className="cursor-pointer w-4 h-4 rounded"
                />
              </th>
              <th className="px-3 py-3 text-left font-semibold text-xs w-8">#</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-left font-semibold text-xs whitespace-nowrap"
                  style={{ minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-3 w-10" colSpan={2}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="text-center py-12 text-[#666666]">
                  Cargando...
                </td>
              </tr>
            )}
            {!isLoading && filteredRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="text-center py-12 text-[#666666]">
                  {search ? "No se encontraron resultados." : "No hay clientes. Añade el primero."}
                </td>
              </tr>
            )}
            {filteredRows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 transition-colors ${selectedRows.has(row.id) ? "bg-blue-100" : idx % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-gray-50/50 hover:bg-blue-50/30"}`}
              >
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    className="cursor-pointer w-4 h-4 rounded"
                  />
                </td>
                <td className="px-3 py-1.5 text-[#666666] text-xs font-medium">{idx + 1}</td>
                {COLUMNS.map(col => (
                  <td key={col.key} className="px-1 py-1">
                    <input
                      type="text"
                      value={getCellValue(row, col.key)}
                      onChange={e => handleCellChange(row.id, col.key, e.target.value)}
                      onBlur={() => handleCellBlur(row, col.key)}
                      className="w-full px-2 py-1.5 rounded border border-transparent hover:border-gray-300 focus:border-[#004D9D] focus:outline-none focus:ring-1 focus:ring-[#004D9D] bg-transparent text-sm transition-colors"
                      style={{ minWidth: col.width }}
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <Dialog open={addDialog} onOpenChange={setAddDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#004D9D]">Añadir cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* PRODUCTO */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Producto *</p>
            <div className="flex gap-3">
              {["Energía", "Gas"].map(p => (
                <button
                  key={p}
                  onClick={() => { setNewProducto(p); setNewTarifa(""); }}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    newProducto === p
                      ? "border-[#004D9D] bg-[#004D9D] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#004D9D]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* TARIFA */}
          {newProducto && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Tarifa {newProducto === "Energía" ? "Energía" : "Gas"} *
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(newProducto === "Energía" ? tarifasEnergia : tarifasGas).map(t => (
                  <button
                    key={t}
                    onClick={() => setNewTarifa(t)}
                    className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      newTarifa === t
                        ? "border-[#004D9D] bg-[#004D9D] text-white"
                        : "border-gray-200 text-gray-600 hover:border-[#004D9D]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PARTICULAR / AUTÓNOMO */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Tipo *</p>
            <div className="flex gap-3">
              {["Autónomo", "Empresa", "Ayuntamiento"].map(tipo => (
                <button
                  key={tipo}
                  onClick={() => setNewPartAuto(tipo)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    newPartAuto === tipo
                      ? "border-[#004D9D] bg-[#004D9D] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#004D9D]"
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleAddRow}
            disabled={createMutation.isPending}
            className="bg-[#004D9D] hover:bg-[#003a7a] text-white"
          >
            {createMutation.isPending ? "Añadiendo..." : "Añadir cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}