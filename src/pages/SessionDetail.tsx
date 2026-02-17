import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, CheckCircle2, XCircle, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const optionLabels = ["A", "B", "C", "D"];
const barColors = [
  "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"
];

interface SessionData {
  id: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  question: { id: string; title: string; options: string[]; correct_answer: number; category: string };
  className: string;
}

interface ResultRow {
  student_id: string;
  answer: number;
  is_correct: boolean;
  scanned_at: string;
  student: { name: string; student_no: string; card_no: number | null };
}

const SessionDetail = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      // Fetch session with question
      const { data: sess } = await (supabase as any)
        .from("scan_sessions")
        .select("*, questions(*), classes(name)")
        .eq("id", sessionId)
        .single();

      if (!sess) { setLoading(false); return; }

      setSession({
        id: sess.id,
        status: sess.status,
        created_at: sess.created_at,
        ended_at: sess.ended_at,
        question: {
          id: sess.questions.id,
          title: sess.questions.title,
          options: sess.questions.options || [],
          correct_answer: sess.questions.correct_answer,
          category: sess.questions.category,
        },
        className: sess.classes?.name || "",
      });

      // Fetch results with student info
      const { data: resData } = await (supabase as any)
        .from("scan_results")
        .select("student_id, answer, is_correct, scanned_at, students(name, student_no, card_no)")
        .eq("session_id", sessionId)
        .order("scanned_at");

      setResults(
        (resData || []).map((r: any) => ({
          student_id: r.student_id,
          answer: r.answer,
          is_correct: r.is_correct,
          scanned_at: r.scanned_at,
          student: r.students,
        }))
      );

      // Total students in that class
      const { count } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("class_id", sess.class_id);
      setTotalStudents(count || 0);

      setLoading(false);
    })();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />返回</Button>
        <p className="text-muted-foreground text-center py-10">未找到该测试记录</p>
      </div>
    );
  }

  const q = session.question;
  const answered = results.length;
  const correct = results.filter(r => r.is_correct).length;
  const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const counts = [0, 0, 0, 0];
  results.forEach(r => { if (r.answer >= 0 && r.answer < 4) counts[r.answer]++; });
  const duration = session.ended_at
    ? Math.round((new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()) / 1000)
    : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/scan")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold truncate">测试统计</h1>
          <p className="text-sm text-muted-foreground">{session.className}</p>
        </div>
      </div>

      {/* Question card */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">{q.category}</Badge>
          {duration !== null && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{duration < 60 ? `${duration}秒` : `${Math.floor(duration / 60)}分${duration % 60}秒`}
            </span>
          )}
        </div>
        <p className="font-medium">{q.title}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-primary">{answered}<span className="text-sm text-muted-foreground font-normal">/{totalStudents}</span></p>
          <p className="text-xs text-muted-foreground">参与人数</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1" />
          <p className={`text-2xl font-bold ${rate >= 80 ? "text-success" : rate >= 60 ? "text-warning" : "text-destructive"}`}>{rate}%</p>
          <p className="text-xs text-muted-foreground">正确率</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-destructive">{answered - correct}</p>
          <p className="text-xs text-muted-foreground">错误人数</p>
        </div>
      </div>

      {/* Answer distribution */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />答案分布
        </h3>
        <div className="space-y-3">
          {q.options.map((opt: string, i: number) => {
            const pct = answered > 0 ? Math.round((counts[i] / answered) * 100) : 0;
            const isCorrect = i === q.correct_answer;
            return (
              <div key={i}>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {optionLabels[i]}
                  </span>
                  <span className={`text-sm flex-1 ${isCorrect ? "font-semibold" : "text-muted-foreground"}`}>{opt}</span>
                  <span className="text-sm font-mono text-muted-foreground w-20 text-right">
                    {counts[i]}人 ({pct}%)
                  </span>
                </div>
                <div className="ml-10 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isCorrect ? "gradient-primary" : barColors[i] + "/30"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student detail list */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />学生明细 ({answered})
        </h3>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${r.is_correct ? "bg-success/10" : "bg-destructive/10"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-muted-foreground shrink-0">{r.student.card_no ?? "?"}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{r.student.student_no}</span>
                <span className="font-medium text-sm truncate">{r.student.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={r.is_correct ? "default" : "destructive"} className={r.is_correct ? "bg-success text-success-foreground" : ""}>
                  {optionLabels[r.answer]}
                </Badge>
                {r.is_correct ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => navigate("/scan")}>
          <ArrowLeft className="w-4 h-4 mr-2" />返回扫描
        </Button>
        <Button className="flex-1 gradient-primary text-primary-foreground border-0" onClick={() => navigate("/statistics")}>
          <BarChart3 className="w-4 h-4 mr-2" />全部统计
        </Button>
      </div>
    </div>
  );
};

export default SessionDetail;
