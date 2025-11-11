import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function EventosSection({ cliente, onUpdate, isOwnerOrAdmin }) {
  const [eventos, setEventos] = useState(cliente.eventos || []);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvento, setEditingEvento] = useState(null);
  const [formData, setFormData] = useState({
    fecha: "",
    descripcion: "",
    color: "verde"
  });

  const handleOpenDialog = (evento = null) => {
    if (evento) {
      setEditingEvento(evento);
      setFormData({
        fecha: evento.fecha,
        descripcion: evento.descripcion,
        color: evento.color
      });
    } else {
      setEditingEvento(null);
      setFormData({
        fecha: "",
        descripcion: "",
        color: "verde"
      });
    }
    setShowDialog(true);
  };

  const handleSaveEvento = () => {
    if (!formData.fecha || !formData.descripcion) {
      toast.error("Fecha y descripción son obligatorios");
      return;
    }

    let nuevosEventos;
    if (editingEvento) {
      nuevosEventos = eventos.map(e =>
        e.id === editingEvento.id ? { ...e, ...formData } : e
      );
    } else {
      nuevosEventos = [
        ...eventos,
        {
          id: Date.now().toString(),
          ...formData
        }
      ];
    }

    setEventos(nuevosEventos);
    onUpdate({ eventos: nuevosEventos });
    setShowDialog(false);
    toast.success(editingEvento ? "Evento actualizado" : "Evento creado");
  };

  const handleDeleteEvento = (eventoId) => {
    if (eventos.length === 1) {
      toast.error("Cada cliente debe tener al menos 1 evento");
      return;
    }
    
    if (!window.confirm("¿Eliminar este evento?")) return;
    
    const nuevosEventos = eventos.filter(e => e.id !== eventoId);
    setEventos(nuevosEventos);
    onUpdate({ eventos: nuevosEventos });
    toast.success("Evento eliminado");
  };

  return (
    <Card className="border-2 border-purple-200 bg-purple-50">
      <CardHeader>
        <CardTitle className="text-[#004D9D] flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Eventos del Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {eventos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Añade el primer evento para este cliente</p>
          </div>
        ) : (
          eventos.map((evento) => (
            <Card key={evento.id} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                        evento.color === "verde" ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {new Date(evento.fecha).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Badge>
                        <Badge className={
                          evento.color === "verde" 
                            ? "bg-green-100 text-green-700 text-xs" 
                            : "bg-red-100 text-red-700 text-xs"
                        }>
                          {evento.color === "verde" ? "Prioridad Usuario" : "Prioridad Admin"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{evento.descripcion}</p>
                    </div>
                  </div>
                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDialog(evento)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteEvento(evento.id)}
                        className="h-7 w-7 p-0 text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {isOwnerOrAdmin && (
          <Button
            onClick={() => handleOpenDialog()}
            variant="outline"
            className="w-full border-dashed border-2 border-purple-300 text-[#004D9D]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Evento
          </Button>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#004D9D]">
              {editingEvento ? "Editar Evento" : "Nuevo Evento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha del evento *</label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Descripción *</label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Ej: Presentar informe por videollamada"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prioridad</label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={formData.color === "verde" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, color: "verde" })}
                  className={formData.color === "verde" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  🟢 Verde (Usuario)
                </Button>
                <Button
                  type="button"
                  variant={formData.color === "rojo" ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, color: "rojo" })}
                  className={formData.color === "rojo" ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  🔴 Rojo (Admin)
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Verde = Prioridad para ti | Rojo = Prioridad para administradores
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEvento} className="bg-[#004D9D] hover:bg-[#00AEEF]">
              {editingEvento ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}