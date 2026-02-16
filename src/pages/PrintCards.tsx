import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Printer, ArrowLeft } from "lucide-react";

interface StudentRow {
  id: string;
  name: string;
  student_no: string;
  card_no: number | null;
}

const QRCard = ({ student, index }: { student: StudentRow; index: number }) => {
  const cardNo = student.card_no ?? index + 1;
  // Use a unique value per student for QR content
  const qrValue = `STU-${student.student_no}-${cardNo}`;

  return (
    <div className="qr-card relative w-[280px] h-[280px] flex items-center justify-center mx-auto">
      {/* Labels on four sides */}
      <span className="absolute top-1 left-1/2 -translate-x-1/2 text-2xl font-black tracking-widest select-none"
        style={{ color: "#e11d48" }}>A</span>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-2xl font-black tracking-widest select-none"
        style={{ color: "#2563eb" }}>C</span>
      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-2xl font-black tracking-widest select-none"
        style={{ color: "#16a34a" }}>D</span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-2xl font-black tracking-widest select-none"
        style={{ color: "#d97706" }}>B</span>

      {/* Corner: card number */}
      <span className="absolute top-1 left-2 text-xs font-mono font-bold opacity-60">#{String(cardNo).padStart(3, "0")}</span>
      <span className="absolute bottom-1 right-2 text-xs font-mono font-bold opacity-60">{student.name}</span>

      {/* QR Code */}
      <QRCodeSVG
        value={qrValue}
        size={200}
        level="M"
        includeMargin={false}
      />
    </div>
  );
};

const PrintCards = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from("classes").select("id, name").order("created_at");
      setClasses(data || []);
      const cid = searchParams.get("class");
      if (cid) setSelectedClass(cid);
      else if (data && data.length > 0) setSelectedClass(data[0].id);
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetch = async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", selectedClass).order("card_no");
      setStudents(data || []);
    };
    fetch();
  }, [selectedClass]);

  // Group students in pairs for 2-per-page layout
  const pages: StudentRow[][] = [];
  for (let i = 0; i < students.length; i += 2) {
    pages.push(students.slice(i, i + 2));
  }

  const handlePrint = () => window.print();

  return (
    <div>
      {/* Controls - hidden when printing */}
      <div className="print:hidden space-y-4 mb-8">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/cards")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold">打印二维码卡片</h1>
            <p className="text-muted-foreground mt-1">每页2张卡片，学生通过旋转卡片选择 A/B/C/D</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="选择班级" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button onClick={handlePrint} disabled={students.length === 0}>
            <Printer className="w-4 h-4 mr-2" />打印卡片 ({students.length} 张)
          </Button>
        </div>

        {students.length === 0 && selectedClass && (
          <p className="text-sm text-muted-foreground">该班级暂无学生</p>
        )}
      </div>

      {/* Print area */}
      <div className="print-area">
        {pages.map((pair, pageIdx) => (
          <div
            key={pageIdx}
            className="print-page flex flex-col items-center justify-center gap-12"
          >
            {pair.map((student) => (
              <div key={student.id} className="border-2 border-dashed border-gray-300 rounded-2xl p-4 print:border-gray-400">
                <QRCard student={student} index={students.indexOf(student)} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print-page {
            page-break-after: always;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 60px;
            padding: 40px 0;
          }
          .print-page:last-child { page-break-after: auto; }
        }
        @media screen {
          .print-page {
            min-height: auto;
            padding: 20px 0;
            border-bottom: 1px dashed hsl(var(--border));
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintCards;
