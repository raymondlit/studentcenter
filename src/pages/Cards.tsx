import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CreditCard, QrCode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const Cards = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);

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
      setStudents(data || []);
    };
    fetchStudents();
  }, [selectedClass]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">卡片分配</h1>
        <p className="text-muted-foreground mt-1">每位学生持有唯一编号卡片（1-70），用于课堂答题扫描</p>
      </div>

      <Select value={selectedClass} onValueChange={setSelectedClass}>
        <SelectTrigger className="w-[220px]"><SelectValue placeholder="选择班级" /></SelectTrigger>
        <SelectContent>
          {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {selectedClass && (
        <Button onClick={() => navigate(`/print-cards?class=${selectedClass}`)} variant="outline">
          <Printer className="w-4 h-4 mr-2" />打印该班级二维码卡片
        </Button>
      )}

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
    </div>
  );
};

export default Cards;
