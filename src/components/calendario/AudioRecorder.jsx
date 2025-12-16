import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function AudioRecorder({ onAudioSaved, existingAudioUrl }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Detener todos los tracks del stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Grabando...");
    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Grabación finalizada");
    }
  };

  const togglePlayback = () => {
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    onAudioSaved(null);
    toast.success("Audio eliminado");
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;

    try {
      setIsUploading(true);
      const file = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setAudioUrl(file_url);
      onAudioSaved(file_url);
      setAudioBlob(null); // Limpiar el blob local después de subir
      toast.success("Audio guardado");
    } catch (error) {
      console.error("Error al subir audio:", error);
      toast.error("Error al guardar el audio");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium block">Audio explicativo (opcional)</label>
      
      {!audioUrl && !isRecording && (
        <Button
          type="button"
          onClick={startRecording}
          variant="outline"
          className="w-full"
        >
          <Mic className="w-4 h-4 mr-2" />
          Grabar Audio
        </Button>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border-2 border-red-300 rounded-lg animate-pulse">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-700 flex-1">Grabando...</span>
          <Button
            type="button"
            onClick={stopRecording}
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            <Square className="w-4 h-4 mr-1" />
            Detener
          </Button>
        </div>
      )}

      {audioUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Button
              type="button"
              onClick={togglePlayback}
              size="sm"
              variant="outline"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                {audioBlob ? "Audio grabado (no guardado)" : "Audio guardado"}
              </div>
              <audio
                ref={audioElementRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="w-full"
              />
            </div>
            <Button
              type="button"
              onClick={deleteAudio}
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {audioBlob && (
            <Button
              type="button"
              onClick={uploadAudio}
              disabled={isUploading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Guardando..." : "Guardar Audio"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}