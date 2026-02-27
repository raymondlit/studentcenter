import { useRef, useEffect, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, SwitchCamera, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ANSWER_LABELS = ["A", "B", "C", "D"];

// 处理分辨率：在手机上提高采样质量，同时控制 CPU 压力
const PROCESS_WIDTH_HIGH_QUALITY = 960;
// 单帧最多尝试识别的二维码数量
const MAX_CODES_PER_FRAME = 20;
// UI 刷新节流，避免高频 setState 拖慢扫描

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
  // 兼容旧格式: STU-<studentNo>-<cardNo>
  const legacy = value.match(/^STU-(.+)-(\d+)$/);
  if (legacy) return { studentNo: legacy[1], cardNo: parseInt(legacy[2], 10) };

  // 新简化格式: S:<studentNo>:<cardNo>（更短，二维码密度更低）
  const compact = value.match(/^S:([^:]+):(\d+)$/);
  if (compact) return { studentNo: compact[1], cardNo: parseInt(compact[2], 10) };

  return null;
}

/**
 * 遮盖二维码区域，避免同一帧重复识别。
 * 同时写回 canvas 与 imageData，避免每次循环重复 getImageData。
 */
function maskQRRegion(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  location: { topLeftCorner: { x: number; y: number }; topRightCorner: { x: number; y: number }; bottomLeftCorner: { x: number; y: number }; bottomRightCorner: { x: number; y: number } },
  padding = 12
) {
  const xs = [location.topLeftCorner.x, location.topRightCorner.x, location.bottomLeftCorner.x, location.bottomRightCorner.x];
  const ys = [location.topLeftCorner.y, location.topRightCorner.y, location.bottomLeftCorner.y, location.bottomRightCorner.y];
  const minX = Math.max(0, Math.floor(Math.min(...xs) - padding));
  const minY = Math.max(0, Math.floor(Math.min(...ys) - padding));
  const maxX = Math.min(imageData.width, Math.ceil(Math.max(...xs) + padding));
  const maxY = Math.min(imageData.height, Math.ceil(Math.max(...ys) + padding));

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

  const data = imageData.data;
  const stride = imageData.width * 4;
  for (let y = minY; y < maxY; y++) {
    let row = y * stride + minX * 4;
    for (let x = minX; x < maxX; x++) {
      data[row] = 255;
      data[row + 1] = 255;
      data[row + 2] = 255;
      data[row + 3] = 255;
      row += 4;
    }
  }
}

export function CameraScanner({ onScan, disabled, compact }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // Per-code cooldown map: cardNo -> last scan timestamp
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [fps, setFps] = useState(0);
  const scanCountRef = useRef(0);
  const uiLastSyncRef = useRef(0);

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
    stopStream();
    setError(null);
    setCameraReady(false);

    await new Promise(r => setTimeout(r, 500));
    if (!mountedRef.current) return;

    const video = videoRef.current;
    if (!video) {
      setError("摄像头初始化失败，请重试");
      setActive(false);
      return;
    }

    video.srcObject = null;

    // Request high resolution + fps hints for better multi-QR detection
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: facing }, width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 30, max: 60 } }, audio: false },
      { video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
      { video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
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
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => { cleanup(); reject(new Error("摄像头加载超时")); }, 10000);
        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", onLoaded);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onErr);
        };
        const onLoaded = () => { if (video.videoWidth > 0) { cleanup(); resolve(); } };
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
        console.log("Camera started, resolution:", video.videoWidth, "x", video.videoHeight);
      }
    } catch (err: any) {
      console.error("Camera play error:", err);
      setError("摄像头启动失败：" + (err.message || "未知错误"));
      setActive(false);
      stopStream();
    }
  }, [stopStream]);

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
    return () => { mountedRef.current = false; stopStream(); };
  }, [stopStream]);

  // Multi-QR scanning loop with downscaling and iterative detection
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

    const scan = () => {
      if (!running) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      // 保持较高采样分辨率，同时避免超大帧拖慢手机 CPU
      const processWidth = Math.min(PROCESS_WIDTH_HIGH_QUALITY, video.videoWidth || PROCESS_WIDTH_HIGH_QUALITY);
      const scale = Math.min(1, processWidth / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      // 只在每帧读取一次像素数据，循环中直接在同一 buffer 上遮盖
      const now = Date.now();
      const imageData = ctx.getImageData(0, 0, w, h);
      const cooldownMap = cooldownMapRef.current;

      for (let i = 0; i < MAX_CODES_PER_FRAME; i++) {
        const code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
        if (!code || !code.data) break;

        // 遮盖当前二维码，继续识别同一帧中的其他码
        maskQRRegion(ctx, imageData, code.location);

        const parsed = parseQRValue(code.data);
        if (!parsed) continue;

        const key = `${parsed.studentNo}-${parsed.cardNo}`;
        const lastTime = cooldownMap.get(key) || 0;
        if (now - lastTime < 1500) continue; // 缩短冷却，允许更快批量识别

        const answer = detectAnswer(code.location);
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

      // FPS + 计数 UI 节流更新，降低 React 重渲染开销
      frameCount++;
      const elapsed = performance.now() - lastFpsTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastFpsTime = performance.now();
      }

      if (now - uiLastSyncRef.current > 180) {
        setScanCount(scanCountRef.current);
        uiLastSyncRef.current = now;
      }

      // Clean up old cooldowns (> 10s)
      if (frameCount === 0) {
        cooldownMap.forEach((time, key) => {
          if (now - time > 10000) cooldownMap.delete(key);
        });
      }

      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [cameraReady]);

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
              </div>
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
