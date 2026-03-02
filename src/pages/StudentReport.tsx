import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, CheckCircle2, XCircle, BarChart3, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const optionLabels = ["A", "B", "C", "D"];

interface StudentInfo {
  id: string;
  name: string;
  student_no: string;
  class_name: string;
}

interface ResultDetail {
  session_id: string;
  answer: number;
  is_correct: boolean;
  scanned_at: string;
  question_title: string;
  question_category: string;
  correct_answer: number;
  options: string[];
}

interface CategoryStat {
  category: string;
  total: number;
  correct: number;
  rate: number;
}

const StudentReport = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [results, setResults] = useState<ResultDetail[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      // Get student info
      const { data: stu } = await (supabase as any)
        .from("students")
        .select("id, name, student_no, class_id, classes(name)")
        .eq("id", studentId)
        .single();
      if (!stu) { setLoading(false); return; }
      setStudent({
        id: stu.id, name: stu.name, student_no: stu.student_no,
        class_name: stu.classes?.name || "",
      });

      // Get all results for this student
      const { data: resData } = await (supabase as any)
        .from("scan_results")
        .select("session_id, answer, is_correct, scanned_at, scan_sessions(question_id, questions(title, category, correct_answer, options))")
        .eq("student_id", studentId)
        .order("scanned_at", { ascending: false });

      const details: ResultDetail[] = (resData || []).map((r: any) => ({
        session_id: r.session_id,
        answer: r.answer,
        is_correct: r.is_correct,
        scanned_at: r.scanned_at,
        question_title: r.scan_sessions?.questions?.title || "",
        question_category: r.scan_sessions?.questions?.category || "",
        correct_answer: r.scan_sessions?.questions?.correct_answer ?? 0,
        options: r.scan_sessions?.questions?.options || [],
      }));
      setResults(details);

      // Compute category stats
      const catMap = new Map<string, { total: number; correct: number }>();
      details.forEach(d => {
        const cat = d.question_category || "未分类";
        if (!catMap.has(cat)) catMap.set(cat, { total: 0, correct: 0 });
        const e = catMap.get(cat)!;
        e.total++;
        if (d.is_correct) e.correct++;
      });
      const cats = Array.from(catMap.entries())
        .map(([category, s]) => ({
          category, ...s, rate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        }))
        .sort((a, b) => a.rate - b.rate);
      setCategoryStats(cats);
      setLoading(false);
    })();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />返回</Button>
        <p className="text-muted-foreground text-center py-10">未找到该学生</p>
      </div>
    );
  }

  const totalAnswered = results.length;
  const totalCorrect = results.filter(r => r.is_correct).length;
  const overallRate = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const weakCategories = categoryStats.filter(c => c.rate < 60);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold">{student.name}</h1>
          <p className="text-sm text-muted-foreground">{student.student_no} · {student.class_name}</p>
        </div>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-primary">{totalAnswered}</p>
          <p className="text-xs text-muted-foreground">总答题数</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1" />
          <p className={`text-2xl font-bold ${overallRate >= 80 ? "text-success" : overallRate >= 60 ? "text-warning" : "text-destructive"}`}>
            {overallRate}%
          </p>
          <p className="text-xs text-muted-foreground">正确率</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-destructive">{totalAnswered - totalCorrect}</p>
          <p className="text-xs text-muted-foreground">错误数</p>
        </div>
      </div>

      {/* Weak categories alert */}
      {weakCategories.length > 0 && (
        <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/20">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="w-4 h-4" />薄弱知识点
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakCategories.map(c => (
              <Badge key={c.category} variant="destructive" className="text-xs">
                {c.category} ({c.rate}%)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />分类正确率
        </h3>
        <div className="space-y-3">
          {categoryStats.map(c => (
            <div key={c.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{c.category}</span>
                <span className="text-sm font-mono text-muted-foreground">
                  {c.correct}/{c.total} ({c.rate}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    c.rate >= 80 ? "bg-success" : c.rate >= 60 ? "bg-warning" : "bg-destructive"
                  }`}
                  style={{ width: `${c.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer history */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />答题明细
        </h3>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${r.is_correct ? "bg-success/10" : "bg-destructive/10"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.question_title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">{r.question_category}</Badge>
                  <span className="text-xs text-muted-foreground">{formatTime(r.scanned_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">选{optionLabels[r.answer]}</span>
                  {!r.is_correct && (
                    <span className="text-xs text-success ml-1">正确:{optionLabels[r.correct_answer]}</span>
                  )}
                </div>
                {r.is_correct
                  ? <CheckCircle2 className="w-4 h-4 text-success" />
                  : <XCircle className="w-4 h-4 text-destructive" />
                }
              </div>
            </div>
          ))}
          {results.length === 0 && (
            <p className="text-center text-muted-foreground py-6">暂无答题记录</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentReport;
