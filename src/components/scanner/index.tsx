"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CheckCircle2, FileText, ImagePlus, Loader2, Minus, Plus, RotateCcw, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/format";

export const ACCEPT = ".jpg,.jpeg,.png,.pdf,.webp,image/jpeg,image/png,image/webp,application/pdf";
export const MAX_MB = 10;

export function validateFiles(files: File[]): { ok: File[]; errors: string[] } {
  const ok: File[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const typeOk = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type) || /\.(jpe?g|png|pdf|webp)$/i.test(f.name);
    if (!typeOk) errors.push(`${f.name}: unsupported type (JPG, PNG or PDF only)`);
    else if (f.size > MAX_MB * 1024 * 1024) errors.push(`${f.name}: larger than ${MAX_MB}MB`);
    else ok.push(f);
  }
  return { ok, errors };
}

export function Dropzone({ onFiles, multiple, disabled, children }: { onFiles: (f: File[]) => void; multiple?: boolean; disabled?: boolean; children?: React.ReactNode }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = [...e.dataTransfer.files];
        onFiles(multiple ? files : files.slice(0, 1));
      }}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload receipt: drag and drop or browse files"
      className={cn("relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition", over ? "scale-[1.01] border-[color:var(--ac1)] bg-indigo-500/10" : "border-slate-300 bg-white/50 hover:border-[color:var(--ac1)] hover:bg-indigo-500/5 dark:border-white/15 dark:bg-white/[0.03]", disabled && "pointer-events-none opacity-60")}
    >
      <input ref={input} type="file" hidden multiple={multiple} accept={ACCEPT} onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <motion.div animate={{ y: over ? -6 : 0 }} className="bg-grad mb-5 grid h-20 w-20 place-items-center rounded-3xl text-white shadow-xl shadow-indigo-500/30">
        <UploadCloud className="h-9 w-9" />
      </motion.div>
      <p className="text-lg font-semibold">{over ? "Drop it here" : multiple ? "Upload Receipts" : "Upload Receipt"}</p>
      <p className="mt-1 text-sm text-slate-500">Drag &amp; drop or <span className="font-medium text-indigo-500">browse files</span></p>
      <div className="mt-4 flex gap-2 text-xs text-slate-400">
        {["JPG", "PNG", "PDF"].map((t) => <span key={t} className="rounded-md border border-slate-200 px-2 py-0.5 dark:border-white/10">{t}</span>)}
        <span className="py-0.5">up to {MAX_MB}MB</span>
      </div>
      {children}
    </div>
  );
}

export function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export function FilePreview({ file, onRemove, status }: { file: File; onRemove?: () => void; status?: "pending" | "scanning" | "done" | "error" }) {
  const url = useObjectUrl(file);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10">
        {url ? // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-slate-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
      </div>
      {status === "scanning" && <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />}
      {status === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      {status === "error" && <X className="h-5 w-5 text-rose-500" />}
      {onRemove && status !== "scanning" && (
        <button onClick={onRemove} className="btn btn-ghost !p-1.5" aria-label={`Remove ${file.name}`}><X className="h-4 w-4" /></button>
      )}
    </div>
  );
}

export const SCAN_STEPS = ["OCR text recognition", "Merchant detection", "Item extraction", "Category prediction", "Tax detection"];

export function ProcessingSteps({ active, done }: { active: number; done: boolean }) {
  return (
    <ul className="space-y-3">
      {SCAN_STEPS.map((s, i) => {
        const complete = done || i < active;
        const current = !done && i === active;
        return (
          <motion.li key={s} initial={{ opacity: 0.4 }} animate={{ opacity: complete || current ? 1 : 0.4 }} className="flex items-center gap-3 text-sm">
            <span className={cn("grid h-6 w-6 place-items-center rounded-full", complete ? "bg-emerald-500 text-white" : current ? "bg-indigo-500/15 text-indigo-500" : "bg-slate-200 text-slate-400 dark:bg-white/10")}>
              {complete ? <CheckCircle2 className="h-4 w-4" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={cn(complete && "text-slate-700 dark:text-slate-200")}>{s}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function ImageZoom({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState("50% 50%");
  return (
    <div>
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5"
        style={{ cursor: scale > 1 ? "zoom-out" : "zoom-in" }}
        onClick={() => setScale((s) => (s > 1 ? 1 : 2.2))}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-contain transition-transform duration-200" style={{ transform: `scale(${scale})`, transformOrigin: origin }} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.max(1, s - 0.5))} aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        <span className="w-12 text-center text-xs text-slate-500">{Math.round(scale * 100)}%</span>
        <button className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.min(4, s + 0.5))} aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => setScale(1)} aria-label="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function CameraModal({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (f: File) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [loading, setLoading] = useState(false);

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const startCamera = async () => {
    setError("");
    setReady(false);
    setLoading(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Camera not supported in this browser.");
      setLoading(false);
      return;
    }

    let mediaStream: MediaStream | null = null;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err: unknown) {
        const e = err as { name?: string };
        setLoading(false);
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
          setError("Camera permission denied. Click the camera icon in the address bar and choose Allow, then click Try again.");
        } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
          setError("No camera found on this device.");
        } else if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
          setError("Camera is in use by another app. Close it and try again.");
        } else {
          setError(`Camera error (${e?.name ?? "unknown"}). Try uploading a photo instead.`);
        }
        return;
      }
    }

    stream.current = mediaStream;

    // Wait for video element to be in DOM
    let attempts = 0;
    while (!video.current && attempts < 20) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }

    if (!video.current) {
      setError("Could not initialize camera view. Please try again.");
      stopStream();
      setLoading(false);
      return;
    }

    video.current.srcObject = mediaStream;
    video.current.onloadedmetadata = () => {
      video.current?.play()
        .then(() => { setReady(true); setLoading(false); })
        .catch(() => { setReady(true); setLoading(false); });
    };
    // Fallback if onloadedmetadata doesn't fire
    setTimeout(() => {
      if (!ready) { setReady(true); setLoading(false); }
    }, 2000);
  };

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopStream();
      setReady(false);
      setError("");
      setLoading(false);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const snap = () => {
    const v = video.current;
    if (!v) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (b) onCapture(new File([b], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    }, "image/jpeg", 0.92);
  };

  // Always render video element (even when closed) so ref is always available
  return (
    <>
      {/* Video element always in DOM so ref is ready immediately */}
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        style={{ display: "none", position: "absolute", pointerEvents: "none" }}
      />

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Capture receipt">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onClose}
            />
            {/* Panel */}
            <motion.div
              className="relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-3xl dark:border-white/10 dark:bg-slate-900"
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h2 className="font-semibold">Capture Receipt</h2>
                <button onClick={onClose} className="btn btn-ghost !p-1.5" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>

              {/* Body */}
              <div className="p-5">
                {error ? (
                  <div className="rounded-2xl bg-amber-50 p-6 text-center dark:bg-amber-500/10">
                    <Camera className="mx-auto mb-3 h-8 w-8 text-amber-500 opacity-60" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{error}</p>
                    <div className="mt-4 flex justify-center gap-3">
                      <button className="btn btn-secondary btn-sm" onClick={startCamera}>Try again</button>
                      <label className="btn btn-primary btn-sm cursor-pointer">
                        Upload photo
                        <input type="file" hidden accept="image/*" capture="environment"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onCapture(f); onClose(); } }} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Viewfinder — mirrors the always-mounted video element */}
                    <div className="relative min-h-48 overflow-hidden rounded-2xl bg-black">
                      {/* Live mirror of the hidden video element */}
                      <CameraViewfinder videoRef={video} ready={ready} />
                      {/* Frame guide */}
                      {ready && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="h-3/4 w-4/5 rounded-xl border-2 border-dashed border-white/60" />
                        </div>
                      )}
                      {/* Flash */}
                      {flash && <div className="absolute inset-0 bg-white/80" />}
                      {/* Spinner */}
                      {(loading || !ready) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                          <span className="text-xs text-white/60">Starting camera…</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-500">Align receipt in the frame, then tap capture</p>
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={snap}
                        disabled={!ready}
                        className="btn btn-primary !h-16 !w-16 !rounded-full !p-0 shadow-lg shadow-indigo-500/30 disabled:opacity-40"
                        aria-label="Capture photo"
                      >
                        <Camera className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Separate component that clones the video stream into a visible canvas
function CameraViewfinder({ videoRef, ready }: { videoRef: React.RefObject<HTMLVideoElement | null>; ready: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!ready) return;
    const draw = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext("2d");
        if (ctx) {
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 480;
          ctx.drawImage(v, 0, 0);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl object-cover"
      style={{ maxHeight: "55vh", display: ready ? "block" : "none" }}
    />
  );
}

export function EmptyPreview() {
  return (
    <div className="grid aspect-[3/4] place-items-center rounded-2xl bg-slate-100 text-center text-slate-400 dark:bg-white/5">
      <div>
        <ImagePlus className="mx-auto mb-2 h-10 w-10" />
        <p className="text-sm">No image preview</p>
        <p className="text-xs">(PDF or large file)</p>
      </div>
    </div>
  );
}
