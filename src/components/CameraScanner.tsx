import { useRef, useEffect, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

const ANSWER_LABELS = ["A", "B", "C", "D"];

interface ScanEvent {
  cardNo: number;
  studentNo: string;
  answer: number; // 0=A,1=B,2=C,3=D
  answerLabel: string;
}

interface CameraScannerProps {
  onScan: (event: ScanEvent) => void;
  disabled?: boolean;
}

/**
 * Determine the answer (0‑3) from the rotation of the QR code.
 * jsQR returns logical corners (based on finder‑pattern positions).
 * The angle of the topLeft→topRight vector tells us how the card is rotated.
 *
 * Card layout (normal / A‑up):
 *   A = top, B = right, C = bottom, D = left
 *
 * Physical rotation → vector angle:
 *   A on top (0°)    → ~0°    → answer 0
 *   B on top (90°CW of vector) → ~90°  → answer 1
 *   C on top (180°)  → ~±180° → answer 2
 *   D on top (−90°)  → ~270°  → answer 3
 */
function detectAnswer(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
}): number {
  const dx = location.topRightCorner.x - location.topLeftCorner.x;
  const dy = location.topRightCorner.y - location.topLeftCorner.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI; // −180..180
  if (angle < 0) angle += 360; // 0..360

  // Buckets: 0±45 → A, 90±45 → B, 180±45 → C, 270±45 → D
  if (angle < 45 || angle >= 315) return 0; // A
  if (angle < 135) return 1; // B
  if (angle < 225) return 2; // C
  return 3; // D
}

/** Parse QR value like "STU-2024001-3" → { studentNo, cardNo } */
function parseQRValue(value: string): { studentNo: string; cardNo: number } | null {
  const m = value.match(/^STU-(.+)-(\d+)$/);
  if (!m) return null;
  return { studentNo: m[1], cardNo: parseInt(m[2], 10) };
}

export function CameraScanner({ onScan, disabled }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<number>(0);

  const [active, setActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err: any) {
      setError("无法打开摄像头：" + (err.message || "请检查权限设置"));
    }
  }, [facingMode]);

  const toggleCamera = () => {
    if (active) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const switchFacing = () => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Restart when facingMode changes while active
  useEffect(() => {
    if (active) startCamera();
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // Scanning loop
  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const scan = () => {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        const now = Date.now();
        const key = code.data;

        // Cooldown: same QR within 2 seconds is ignored
        if (key !== lastScannedRef.current || now - cooldownRef.current > 2000) {
          const parsed = parseQRValue(code.data);
          if (parsed) {
            const answer = detectAnswer(code.location);
            lastScannedRef.current = key;
            cooldownRef.current = now;
            setLastResult(`#${parsed.cardNo} → ${ANSWER_LABELS[answer]}`);
            onScan({
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
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, onScan]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={toggleCamera}
          variant={active ? "destructive" : "default"}
          disabled={disabled}
          className={!active ? "gradient-primary text-primary-foreground border-0" : ""}
        >
          {active ? (
            <>
              <CameraOff className="w-4 h-4 mr-1" />
              关闭摄像头
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-1" />
              打开摄像头扫描
            </>
          )}
        </Button>
        {active && (
          <Button variant="outline" size="icon" onClick={switchFacing} title="切换前后摄像头">
            <SwitchCamera className="w-4 h-4" />
          </Button>
        )}
        {lastResult && (
          <span className="text-sm font-medium text-muted-foreground ml-2">
            最近识别: {lastResult}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {active && (
        <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black border border-border">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[15%] border-2 border-primary/60 rounded-xl" />
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              对准二维码卡片
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
