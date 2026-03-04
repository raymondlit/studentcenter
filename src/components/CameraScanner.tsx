import { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, SwitchCamera, Zap, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { scanWithZBar } from "@/lib/zbar-scanner";
import {
  ANSWER_LABELS,
  detectAnswerFromPoints,
  parseQRValue,
  type ScanEvent,
} from "@/lib/qr-utils";

// Re-export for consumers
export type { ScanEvent };

/** High-res photo capture interval (ms) */
const PHOTO_INTERVAL_MS = 1500;

interface CameraScannerProps {
  onScan: (event: ScanEvent) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CameraScanner({ onScan, disabled, compact }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // ImageCapture for high-res photo channel
  const imageCaptureRef = useRef<ImageCapture | null>(null);
  const photoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoProcessingRef = useRef(false);

  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [photoMode, setPhotoMode] = useState(false); // Whether high-res capture is active
  const scanCountRef = useRef(0);
  const uiLastSyncRef = useRef(0);

  /**
   * Process detected QR codes from zbar results.
   * Handles cooldown, answer detection, and event dispatch.
   */
  const processResults = useCallback(
    (results: { data: string; points: { x: number; y: number }[] }[], now: number) => {
      const cooldownMap = cooldownMapRef.current;
      for (const r of results) {
        const parsed = parseQRValue(r.data);
        if (!parsed) continue;

        const key = `${parsed.studentNo}-${parsed.cardNo}`;
        const lastTime = cooldownMap.get(key) || 0;
        if (now - lastTime < 1200) continue;

        const answer = detectAnswerFromPoints(r.points);
        cooldownMap.set(key, now);
        scanCountRef.current += 1;
        setLastResult(`#${parsed.cardNo} → ${ANSWER_LABELS[answer]}`);

        onScanRef.current({
          cardNo: parsed.cardNo,
          studentNo: parsed.studentNo,
          answer,
          answerLabel: ANSWER_LABELS[answer],
        });
      }
    },
    []
  );

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (photoTimerRef.current) {
      clearInterval(photoTimerRef.current);
      photoTimerRef.current = null;
    }
    imageCaptureRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setPhotoMode(false);
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      stopStream();
      setError(null);
      setCameraReady(false);

      await new Promise((r) => setTimeout(r, 500));
      if (!mountedRef.current) return;

      const video = videoRef.current;
      if (!video) {
        setError("摄像头初始化失败，请重试");
        setActive(false);
        return;
      }

      video.srcObject = null;

      // Request highest possible resolution for both stream and photo capture
      const constraints: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { exact: facing },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        },
        {
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: any = null;
      for (const c of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }

      if (!stream) {
        const msg =
          lastErr?.name === "NotAllowedError"
            ? "摄像头权限被拒绝，请在浏览器设置中允许摄像头访问"
            : lastErr?.name === "NotFoundError"
            ? "未检测到摄像头设备"
            : "无法打开摄像头，请检查权限设置";
        setError(msg);
        setActive(false);
        return;
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("摄像头加载超时"));
          }, 10000);
          const cleanup = () => {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("error", onErr);
          };
          const onLoaded = () => {
            if (video.videoWidth > 0) { cleanup(); resolve(); }
          };
          const onCanPlay = () => { cleanup(); resolve(); };
          const onErr = () => { cleanup(); reject(new Error("Video load failed")); };
          if (video.readyState >= 2) { cleanup(); resolve(); }
          else {
            video.addEventListener("loadedmetadata", onLoaded);
            video.addEventListener("canplay", onCanPlay);
            video.addEventListener("error", onErr);
          }
        });

        await video.play();

        if (mountedRef.current) {
          setCameraReady(true);
          setActive(true);
          setScanCount(0);
          scanCountRef.current = 0;

          // Set up ImageCapture for high-res photo channel
          const videoTrack = stream.getVideoTracks()[0];
          if (typeof ImageCapture !== "undefined" && videoTrack) {
            try {
              const ic = new ImageCapture(videoTrack);
              imageCaptureRef.current = ic;
              setPhotoMode(true);
              console.log("ImageCapture available, high-res photo mode enabled");
            } catch {
              console.log("ImageCapture not supported, using video stream only");
            }
          }

          console.log(
            "Camera started, stream resolution:",
            video.videoWidth,
            "x",
            video.videoHeight
          );
        }
      } catch (err: any) {
        console.error("Camera play error:", err);
        setError("摄像头启动失败：" + (err.message || "未知错误"));
        setActive(false);
        stopStream();
      }
    },
    [stopStream]
  );

  const toggleCamera = useCallback(() => {
    if (active) { stopStream(); setActive(false); }
    else { startCamera(facingMode); }
  }, [active, facingMode, startCamera, stopStream]);

  const switchFacing = useCallback(() => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    if (active) startCamera(newFacing);
  }, [active, facingMode, startCamera]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  // ─── Real-time video stream scanning (zbar-wasm, full resolution) ───
  useEffect(() => {
    if (!cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let running = true;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const scan = async () => {
      if (!running) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      // Use full video resolution (no downscaling) for maximum detection distance
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      const now = Date.now();
      try {
        const imageData = ctx.getImageData(0, 0, w, h);
        const results = await scanWithZBar(imageData);
        if (running) {
          processResults(results, now);
        }
      } catch (err) {
        // zbar-wasm may throw on corrupt frames; just skip
      }

      // FPS tracking
      frameCount++;
      const elapsed = performance.now() - lastFpsTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastFpsTime = performance.now();
      }

      // UI throttled update
      if (now - uiLastSyncRef.current > 180) {
        setScanCount(scanCountRef.current);
        uiLastSyncRef.current = now;
      }

      // Clean old cooldowns
      if (frameCount === 0) {
        const cooldownMap = cooldownMapRef.current;
        cooldownMap.forEach((time, key) => {
          if (now - time > 10000) cooldownMap.delete(key);
        });
      }

      if (running) {
        rafRef.current = requestAnimationFrame(scan);
      }
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraReady, processResults]);

  // ─── High-res photo capture channel (ImageCapture API) ───
  useEffect(() => {
    if (!cameraReady || !photoMode) return;

    const captureAndScan = async () => {
      const ic = imageCaptureRef.current;
      if (!ic || photoProcessingRef.current) return;

      photoProcessingRef.current = true;
      try {
        // takePhoto() returns a Blob at the sensor's full resolution (often 8-12MP)
        const blob = await ic.takePhoto();
        const bitmap = await createImageBitmap(blob);

        const offCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const offCtx = offCanvas.getContext("2d")!;
        offCtx.drawImage(bitmap, 0, 0);
        const imageData = offCtx.getImageData(0, 0, bitmap.width, bitmap.height);
        bitmap.close();

        const results = await scanWithZBar(imageData);
        if (mountedRef.current && results.length > 0) {
          console.log(
            `[HighRes] ${bitmap.width}x${bitmap.height} → ${results.length} codes detected`
          );
          processResults(results, Date.now());
        }
      } catch (err) {
        // ImageCapture may fail if camera is busy; silently retry next interval
      } finally {
        photoProcessingRef.current = false;
      }
    };

    photoTimerRef.current = setInterval(captureAndScan, PHOTO_INTERVAL_MS);
    // Run first capture immediately
    captureAndScan();

    return () => {
      if (photoTimerRef.current) {
        clearInterval(photoTimerRef.current);
        photoTimerRef.current = null;
      }
    };
  }, [cameraReady, photoMode, processResults]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${active ? "opacity-100" : "opacity-0"}`}
          playsInline
          webkit-playsinline="true"
          muted
          autoPlay={false}
        />

        {active && (
          <>
            {/* Scan overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[8%] border-2 border-primary/60 rounded-xl" />
              {/* Status badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                <Badge variant="secondary" className="bg-black/60 text-white border-0 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  {fps} FPS
                </Badge>
                <Badge variant="secondary" className="bg-black/60 text-white border-0 text-xs">
                  已扫 {scanCount}
                </Badge>
                {photoMode && (
                  <Badge variant="secondary" className="bg-emerald-600/80 text-white border-0 text-xs">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    高清模式
                  </Badge>
                )}
              </div>
              {lastResult && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-sm font-bold px-4 py-1.5 rounded-full">
                  {lastResult}
                </div>
              )}
            </div>
            {/* Controls overlay */}
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={switchFacing}
                className="bg-black/50 hover:bg-black/70 text-white border-0 h-9 w-9"
              >
                <SwitchCamera className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleCamera}
                className="bg-destructive/80 hover:bg-destructive text-white border-0 h-9 w-9"
              >
                <CameraOff className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera className="w-12 h-12 text-muted-foreground/40" />
            <Button
              onClick={toggleCamera}
              disabled={disabled}
              size="lg"
              className="gradient-primary text-primary-foreground border-0"
            >
              <Camera className="w-5 h-5 mr-2" />
              打开摄像头
            </Button>
            {error && <p className="text-sm text-destructive px-4 text-center">{error}</p>}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
