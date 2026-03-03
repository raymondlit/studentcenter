import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, QrCode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
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
      </Tabs>
    </div>
  );
};

export default Cards;
