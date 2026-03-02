import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3, Users, FileText, ChevronRight, BookOpen, Clock, CheckCircle2, XCircle, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClassOption { id: string; name: string; }
interface SessionRow {
  id: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  class_id: string;
  question_id: string;
  question_title: string;
  question_category: string;
  class_name: string;
  result_count: number;
  correct_count: number;
}
interface PaperRow { id: string; name: string; description: string | null; question_count: number; }
interface StudentRow { id: string; name: string; student_no: string; class_id: string; class_name: string; }

const Statistics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("sessions");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: cls }, { data: paps }] = await Promise.all([
        supabase.from("classes").select("id, name").order("created_at"),
        (supabase as any).from("papers").select("id, name, description, paper_questions(id)").order("created_at", { ascending: false }),
      ]);
      setClasses(cls || []);
      setPapers((paps || []).map((p: any) => ({
        id: p.id, name: p.name, description: p.description,
        question_count: p.paper_questions?.length || 0,
      })));
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Fetch sessions
      let q = (supabase as any)
        .from("scan_sessions")
        .select("id, status, created_at, ended_at, class_id, question_id, questions(title, category), classes(name), scan_results(id, is_correct)")
        .order("created_at", { ascending: false });
      if (selectedClassId !== "all") q = q.eq("class_id", selectedClassId);
      const { data: sessData } = await q;

      setSessions((sessData || []).map((s: any) => ({
        id: s.id, status: s.status, created_at: s.created_at, ended_at: s.ended_at,
        class_id: s.class_id, question_id: s.question_id,
        question_title: s.questions?.title || "",
        question_category: s.questions?.category || "",
        class_name: s.classes?.name || "",
        result_count: s.scan_results?.length || 0,
        correct_count: s.scan_results?.filter((r: any) => r.is_correct).length || 0,
      })));

      // Fetch students
      let sq = supabase.from("students").select("id, name, student_no, class_id, classes(name)").order("created_at");
      if (selectedClassId !== "all") sq = sq.eq("class_id", selectedClassId) as any;
      const { data: stuData } = await (sq as any);
      setStudents((stuData || []).map((s: any) => ({
        id: s.id, name: s.name, student_no: s.student_no, class_id: s.class_id,
        class_name: s.classes?.name || "",
      })));

      setLoading(false);
    })();
  }, [user, selectedClassId]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">答题统计</h1>
        <p className="text-muted-foreground mt-1">查看测试记录、试卷报告与学生分析</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="选择班级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班级</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions" className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />测试记录
          </TabsTrigger>
          <TabsTrigger value="papers" className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />试卷报告
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-1.5">
            <User className="w-4 h-4" />学生分析
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">暂无测试记录</p>
          ) : (
            sessions.map(s => {
              const rate = s.result_count > 0 ? Math.round((s.correct_count / s.result_count) * 100) : 0;
              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/session/${s.id}`)}
                  className="bg-card rounded-xl p-4 shadow-card cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.question_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{s.class_name}</Badge>
                      <span className="text-xs text-muted-foreground">{formatTime(s.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-bold ${rate >= 80 ? "text-success" : rate >= 60 ? "text-warning" : "text-destructive"}`}>
                        {rate}%
                      </p>
                      <p className="text-xs text-muted-foreground">{s.result_count}人</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Papers Tab */}
        <TabsContent value="papers" className="space-y-3 mt-4">
          {papers.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">暂无试卷，请先创建试卷</p>
          ) : (
            papers.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/paper-report/${p.id}${selectedClassId !== "all" ? `?class=${selectedClassId}` : ""}`)}
                className="bg-card rounded-xl p-4 shadow-card cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.question_count} 道题目</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">暂无学生</p>
          ) : (
            students.map(s => (
              <div
                key={s.id}
                onClick={() => navigate(`/student-report/${s.id}`)}
                className="bg-card rounded-xl p-4 shadow-card cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-secondary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{s.student_no}</span>
                    <Badge variant="outline" className="text-xs">{s.class_name}</Badge>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistics;
