import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Search, RotateCcw, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface StudentInfo {
  id: string;
  name: string;
  student_no: string;
  card_no: number | null;
}

const ANSWER_COLORS: Record<string, string> = {
  A: "#e11d48",
  B: "#d97706",
  C: "#2563eb",
  D: "#16a34a",
};

const StudentCheckin = () => {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get("c") || "";
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StudentInfo[]>([]);
  const [selected, setSelected] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const fetchStudents = useCallback(
    async (q: string) => {
      if (!classId) return;
      setLoading(true);
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/student-lookup?class_id=${encodeURIComponent(classId)}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const json = await res.json();
        setSuggestions(json.students || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [classId, projectId]
  );

  useEffect(() => {
    if (!query.trim() || selected) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchStudents(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selected, fetchStudents]);

  // Also load all students on focus if query is empty
  const handleFocus = () => {
    if (!selected && suggestions.length === 0) {
      fetchStudents(query.trim());
    } else {
      setShowSuggestions(true);
    }
  };

  const handleSelect = (student: StudentInfo) => {
    setSelected(student);
    setQuery(student.name);
    setShowSuggestions(false);
  };

  const handleReset = () => {
    setSelected(null);
    setQuery("");
    setSuggestions([]);
  };

  const handleDownload = () => {
    if (!qrRef.current || !selected) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Draw SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const padding = 80;
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);

      // Draw ABCD labels
      const labelSize = 48;
      ctx.font = `bold ${labelSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = ANSWER_COLORS.A;
      ctx.fillText("A", size / 2, 36);
      ctx.fillStyle = ANSWER_COLORS.C;
      ctx.fillText("C", size / 2, size - 36);
      ctx.fillStyle = ANSWER_COLORS.D;
      ctx.fillText("D", 36, size / 2);
      ctx.fillStyle = ANSWER_COLORS.B;
      ctx.fillText("B", size - 36, size / 2);

      // Card number and name
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#666";
      ctx.textAlign = "left";
      ctx.fillText(`#${String(selected.card_no || 0).padStart(3, "0")}`, 16, 24);
      ctx.textAlign = "right";
      ctx.fillText(selected.name, size - 16, size - 16);

      // Download
      const link = document.createElement("a");
      link.download = `QR-${selected.name}-${selected.card_no || 0}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (!classId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">无效的签到链接</p>
      </div>
    );
  }

  const qrValue = selected
    ? `S:${selected.student_no}:${selected.card_no || 0}`
    : "";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-foreground">签到领卡</h1>
          <p className="text-xs text-muted-foreground">输入姓名获取你的答题二维码</p>
        </div>
      </div>

      {!selected ? (
        /* Search mode */
        <div className="flex-1 flex flex-col p-4 pt-8">
          <div className="max-w-sm mx-auto w-full space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                }}
                onFocus={handleFocus}
                placeholder="输入你的姓名..."
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>

            {loading && (
              <p className="text-center text-sm text-muted-foreground">搜索中...</p>
            )}

            {showSuggestions && suggestions.length > 0 && (
              <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-b-0 flex items-center justify-between"
                  >
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      #{String(s.card_no || 0).padStart(3, "0")}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showSuggestions && !loading && suggestions.length === 0 && query.trim() && (
              <p className="text-center text-sm text-muted-foreground">未找到匹配的学生</p>
            )}
          </div>
        </div>
      ) : (
        /* QR display mode - fullscreen */
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {selected.name} · 卡号 #{String(selected.card_no || 0).padStart(3, "0")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">旋转手机选择 A / B / C / D</p>
          </div>

          {/* QR Card */}
          <div
            ref={qrRef}
            className="relative bg-card border-2 border-border rounded-2xl p-6 shadow-lg"
            style={{ width: "min(85vw, 360px)", height: "min(85vw, 360px)" }}
          >
            {/* ABCD labels */}
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-3xl font-black select-none" style={{ color: ANSWER_COLORS.A }}>A</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-3xl font-black select-none" style={{ color: ANSWER_COLORS.C }}>C</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-3xl font-black select-none" style={{ color: ANSWER_COLORS.D }}>D</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-3xl font-black select-none" style={{ color: ANSWER_COLORS.B }}>B</span>
            {/* Card no & name */}
            <span className="absolute top-2 left-3 text-xs font-mono font-bold text-muted-foreground">
              #{String(selected.card_no || 0).padStart(3, "0")}
            </span>
            <span className="absolute bottom-2 right-3 text-xs font-mono font-bold text-muted-foreground">
              {selected.name}
            </span>
            {/* QR */}
            <div className="w-full h-full flex items-center justify-center">
              <QRCodeSVG value={qrValue} size={240} level="L" includeMargin />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              重新选择
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-1.5" />
              保存到手机
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-[280px]">
            保存后，回答问题时打开图片，旋转手机让对应字母朝上即可
          </p>
        </div>
      )}
    </div>
  );
};

export default StudentCheckin;
