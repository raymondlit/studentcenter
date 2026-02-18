import { useRef, useEffect, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

const ANSWER_LABELS = ["A", "B", "C", "D"];

interface ScanEvent {
  cardNo: number;
  studentNo: string;
  answer: number;
  answerLabel: string;
}

interface CameraScannerProps {
  onScan: (event: ScanEvent) => void;
  disabled?: boolean;
  compact?: boolean;
}

function detectAnswer(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
}): number {
  const dx = location.topRightCorner.x - location.topLeftCorner.x;
  const dy = location.topRightCorner.y - location.topLeftCorner.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  if (angle < 45 || angle >= 315) return 0;
  if (angle < 135) return 1;
  if (angle < 225) return 2;
  return 3;
}

function parseQRValue(value: string): { studentNo: string; cardNo: number } | null {
  const m = value.match(/^STU-(.+)-(\d+)$/);
  if (!m) return null;
  return { studentNo: m[1], cardNo: parseInt(m[2], 10) };
}

export function CameraScanner({ onScan, disabled, compact }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<number>(0);
  const mountedRef = useRef(true);
  // Stable ref for onScan to avoid restarting the scan loop
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    // Fully stop any previous stream first
    stopStream();
    setError(null);
    setCameraReady(false);

    // Small delay to let mobile browsers release camera hardware
    await new Promise(r => setTimeout(r, 500));

    if (!mountedRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    // Reset video element without calling load() which can break stream playback
    video.srcObject = null;

    // Try multiple constraint strategies for maximum compatibility
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: facing } }, audio: false },
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
      const msg = lastErr?.name === "NotAllowedError"
        ? "摄像头权限被拒绝，请在浏览器设置中允许摄像头访问"
        : lastErr?.name === "NotFoundError"
        ? "未检测到摄像头设备"
        : "无法打开摄像头，请检查权限设置";
      setError(msg);
      setActive(false);
      console.error("Camera access failed:", lastErr);
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    // Ensure attributes are set for mobile
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;

    // Wait for video to be ready to play
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
          // On some browsers, loadedmetadata is enough
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            cleanup();
            resolve();
          }
          // else wait for canplay
        };
        const onCanPlay = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error("Video load failed")); };

        // Check if already ready
        if (video.readyState >= 2) {
          cleanup();
          resolve();
        } else {
          video.addEventListener("loadedmetadata", onLoaded);
          video.addEventListener("canplay", onCanPlay);
          video.addEventListener("error", onErr);
        }
      });

      await video.play();

      if (mountedRef.current) {
        setCameraReady(true);
        setActive(true);
        console.log("Camera started successfully, resolution:", video.videoWidth, "x", video.videoHeight);
      }
    } catch (err: any) {
      console.error("Camera play error:", err);
      setError("摄像头启动失败：" + (err.message || "未知错误"));
      setActive(false);
      stopStream();
    }
  }, [stopStream]);

  const toggleCamera = useCallback(() => {
    if (active) {
      stopStream();
      setActive(false);
    } else {
      startCamera(facingMode);
    }
  }, [active, facingMode, startCamera, stopStream]);

  const switchFacing = useCallback(() => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    if (active) {
      startCamera(newFacing);
    }
  }, [active, facingMode, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  // Scanning loop — only depends on cameraReady, uses ref for onScan
  useEffect(() => {
    if (!cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let running = true;
    const scan = () => {
      if (!running) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code && code.data) {
        const now = Date.now();
        const key = code.data;
        if (key !== lastScannedRef.current || now - cooldownRef.current > 2000) {
          const parsed = parseQRValue(code.data);
          if (parsed) {
            const answer = detectAnswer(code.location);
            lastScannedRef.current = key;
            cooldownRef.current = now;
            setLastResult(`#${parsed.cardNo} → ${ANSWER_LABELS[answer]}`);
            onScanRef.current({
              cardNo: parsed.cardNo,
              studentNo: parsed.studentNo,
              answer,
              answerLabel: ANSWER_LABELS[answer],
            });
          }
        }
      }

      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraReady]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden">
        {active ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              webkit-playsinline="true"
              muted
              autoPlay={false}
            />
            {/* Scan overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[12%] border-2 border-primary/60 rounded-xl" />
              {lastResult && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground text-sm font-bold px-4 py-1.5 rounded-full">
                  {lastResult}
                </div>
              )}
            </div>
            {/* Controls overlay */}
            <div className="absolute top-3 right-3 flex gap-2">
              <Button variant="secondary" size="icon" onClick={switchFacing} className="bg-black/50 hover:bg-black/70 text-white border-0 h-9 w-9">
                <SwitchCamera className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={toggleCamera} className="bg-destructive/80 hover:bg-destructive text-white border-0 h-9 w-9">
                <CameraOff className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
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
