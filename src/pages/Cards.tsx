import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, Printer, UserCheck, RotateCcw, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";

interface StudentRow {
  id: string;
  name: string;
  student_no: string;
  card_no: number | null;
}

const QRCard = ({ student, index }: { student: StudentRow; index: number }) => {
  const cardNo = student.card_no ?? index + 1;
  const qrValue = `S:${student.student_no}:${cardNo}`;
  return (
    <div className="qr-card relative w-[280px] h-[280px] flex items-center justify-center mx-auto">
      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-2xl font-black tracking-widest select-none" style={{ color: "#e11d48" }}>A</span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-2xl font-black tracking-widest select-none" style={{ color: "#2563eb" }}>C</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-2xl font-black tracking-widest select-none" style={{ color: "#16a34a" }}>D</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-2xl font-black tracking-widest select-none" style={{ color: "#d97706" }}>B</span>
      <span className="absolute top-1 left-2 text-xs font-mono font-bold opacity-60">#{String(cardNo).padStart(3, "0")}</span>
      <span className="absolute bottom-1 right-2 text-xs font-mono font-bold opacity-60">{student.name}</span>
      <QRCodeSVG value={qrValue} size={220} level="L" includeMargin={true} />
    </div>
  );
};

const CheckinTab = ({ classId, students }: { classId: string; students: StudentRow[] }) => {
  const [showQR, setShowQR] = useState(false);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [showList, setShowList] = useState<"checked" | "unchecked" | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const checkinUrl = classId
    ? `${window.location.origin}/checkin?c=${classId}`
    : "";

  // Reset when class changes
  useEffect(() => {
    setShowQR(false);
    setShowList(null);
  }, [classId]);

  // Fetch check-in records
  useEffect(() => {
    if (!classId) return;
    const fetchCheckins = async () => {
      setLoadingStats(true);
      const { data } = await (supabase as any)
        .from("checkin_records")
        .select("student_id")
        .eq("class_id", classId);
      setCheckedInIds(new Set((data || []).map((r: any) => r.student_id)));
      setLoadingStats(false);
    };
    fetchCheckins();

    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchCheckins, 5000);
    return () => clearInterval(interval);
  }, [classId]);

  const checkedStudents = students.filter(s => checkedInIds.has(s.id));
  const uncheckedStudents = students.filter(s => !checkedInIds.has(s.id));

  if (!classId) {
    return <p className="text-center py-8 text-muted-foreground">请先选择班级</p>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {students.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setShowList(showList === "checked" ? null : "checked")}
            className="bg-card rounded-xl p-4 shadow-card cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-muted-foreground">已签到</span>
              </div>
              {showList === "checked" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">{loadingStats ? "…" : checkedStudents.length}</p>
          </div>
          <div
            onClick={() => setShowList(showList === "unchecked" ? null : "unchecked")}
            className="bg-card rounded-xl p-4 shadow-card cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <span className="text-sm text-muted-foreground">未签到</span>
              </div>
              {showList === "unchecked" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
            <p className="text-3xl font-bold mt-2 text-foreground">{loadingStats ? "…" : uncheckedStudents.length}</p>
          </div>
        </div>
      )}

      {/* Student List */}
      {showList && (
        <div className="bg-card rounded-xl p-4 shadow-card animate-fade-in">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            {showList === "checked" ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-500" />已签到名单</>
            ) : (
              <><XCircle className="w-4 h-4 text-destructive" />未签到名单</>
            )}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(showList === "checked" ? checkedStudents : uncheckedStudents).map(s => (
              <Badge key={s.id} variant={showList === "checked" ? "default" : "outline"} className="text-sm py-1 px-3">
                {s.name}
              </Badge>
            ))}
            {(showList === "checked" ? checkedStudents : uncheckedStudents).length === 0 && (
              <p className="text-sm text-muted-foreground">暂无</p>
            )}
          </div>
        </div>
      )}

      {/* QR Code Section */}
      <div className="bg-card rounded-xl p-6 shadow-card space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">签到领卡</h2>
            <p className="text-sm text-muted-foreground">学生扫码后输入姓名即可获取答题二维码</p>
          </div>
        </div>

        {!showQR ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">已选择班级，点击下方按钮生成签到二维码</p>
            <Button onClick={() => setShowQR(true)} size="lg">
              <QrCode className="w-5 h-5 mr-2" />
              生成领卡二维码
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-background border-2 border-border rounded-2xl p-6">
              <QRCodeSVG value={checkinUrl} size={240} level="M" includeMargin />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              将此二维码投影到屏幕上，学生用手机扫码后输入姓名，即可在手机上获取自己的答题二维码卡片，支持保存到本地。
            </p>
            <p className="text-xs font-mono text-muted-foreground break-all max-w-md text-center select-all">{checkinUrl}</p>
            <Button variant="outline" size="sm" onClick={() => setShowQR(false)}>
              <RotateCcw className="w-4 h-4 mr-1.5" />隐藏二维码
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const Cards = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from("classes").select("id, name").order("created_at");
      setClasses(data || []);
      if (data && data.length > 0) setSelectedClass(data[0].id);
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetchStudents = async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", selectedClass).order("card_no");
      setStudents((data as StudentRow[]) || []);
    };
    fetchStudents();
  }, [selectedClass]);

  const pages: StudentRow[][] = [];
  for (let i = 0; i < students.length; i += 2) {
    pages.push(students.slice(i, i + 2));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold print:hidden">卡片管理</h1>
        <p className="text-muted-foreground mt-1 print:hidden">管理学生卡片分配与打印二维码卡片</p>
      </div>

      <div className="print:hidden">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="选择班级" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="assign" className="print:block">
        <TabsList className="print:hidden">
          <TabsTrigger value="assign"><QrCode className="w-4 h-4 mr-1.5" />卡片分配</TabsTrigger>
          <TabsTrigger value="print"><Printer className="w-4 h-4 mr-1.5" />打印卡片</TabsTrigger>
          <TabsTrigger value="checkin"><UserCheck className="w-4 h-4 mr-1.5" />签到领卡</TabsTrigger>
        </TabsList>

        {/* 卡片分配 */}
        <TabsContent value="assign" className="print:hidden">
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
                <QrCode className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">卡片分配状态</h2>
                <p className="text-sm text-muted-foreground">共 {students.length} 名学生</p>
              </div>
            </div>
            {students.length > 0 ? (
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-3">
                {students.map((s) => (
                  <div key={s.id} className="relative aspect-square rounded-xl bg-secondary/50 border-2 border-primary/20 hover:border-primary hover:shadow-elevated flex flex-col items-center justify-center p-1 transition-all cursor-pointer group">
                    <CreditCard className="w-5 h-5 text-primary mb-1 group-hover:scale-110 transition-transform" />
                    <span className="font-mono text-xs font-bold text-foreground">#{String(s.card_no || 0).padStart(3, "0")}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{s.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">该班级暂无学生</p>
            )}
          </div>
        </TabsContent>

        {/* 打印卡片 */}
        <TabsContent value="print">
          <div className="print:hidden space-y-4 mb-6">
            <p className="text-sm text-muted-foreground">每页2张卡片，学生通过旋转卡片选择 A/B/C/D</p>
            <Button onClick={() => window.print()} disabled={students.length === 0}>
              <Printer className="w-4 h-4 mr-2" />打印卡片 ({students.length} 张)
            </Button>
            {students.length === 0 && selectedClass && (
              <p className="text-sm text-muted-foreground">该班级暂无学生</p>
            )}
          </div>

          <div className="print-area">
            {pages.map((pair, pageIdx) => (
              <div key={pageIdx} className="print-page flex flex-col items-center justify-center gap-12">
                {pair.map((student) => (
                  <div key={student.id} className="border-2 border-dashed border-border rounded-2xl p-4 print:border-border">
                    <QRCard student={student} index={students.indexOf(student)} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: absolute; top: 0; left: 0; width: 100%; }
              .print-page {
                page-break-after: always;
                min-height: 100vh;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                gap: 60px; padding: 40px 0;
              }
              .print-page:last-child { page-break-after: auto; }
            }
            @media screen {
              .print-page {
                min-height: auto; padding: 20px 0;
                border-bottom: 1px dashed hsl(var(--border));
                margin-bottom: 20px;
              }
            }
          `}</style>
        </TabsContent>

        {/* 签到领卡 */}
        <TabsContent value="checkin" className="print:hidden">
          <CheckinTab classId={selectedClass} students={students} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Cards;
