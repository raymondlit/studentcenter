import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, BarChart3, CheckCircle2, XCircle, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const optionLabels = ["A", "B", "C", "D"];

interface QuestionStat {
  id: string;
  title: string;
  category: string;
  correct_answer: number;
  options: string[];
  total: number;
  correct: number;
  counts: number[];
}

interface StudentScore {
  student_id: string;
  name: string;
  student_no: string;
  total: number;
  correct: number;
  rate: number;
}

const PaperReport = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paperName, setPaperName] = useState("");
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get("class") || "all");
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paperId) return;
    (async () => {
      // Get paper info with questions
      const { data: paper } = await (supabase as any)
        .from("papers")
        .select("name, paper_questions(question_id, sort_order, questions(id, title, category, correct_answer, options))")
        .eq("id", paperId)
        .single();
      if (!paper) { setLoading(false); return; }
      setPaperName(paper.name);

      const pqs = (paper.paper_questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
      const questionIds = pqs.map((pq: any) => pq.question_id);

      // Get all sessions for these questions
      let sessQ = (supabase as any)
        .from("scan_sessions")
        .select("id, class_id, question_id, classes(id, name)")
        .in("question_id", questionIds)
        .eq("status", "ended");
      const { data: sessData } = await sessQ;
      const sessions = sessData || [];

      // Get unique classes
      const classMap = new Map<string, string>();
      sessions.forEach((s: any) => { if (s.classes) classMap.set(s.class_id, s.classes.name); });
      setClasses(Array.from(classMap.entries()).map(([id, name]) => ({ id, name })));

      // Filter by class
      const filteredSessions = selectedClassId === "all"
        ? sessions
        : sessions.filter((s: any) => s.class_id === selectedClassId);
      const sessionIds = filteredSessions.map((s: any) => s.id);

      if (sessionIds.length === 0) {
        setQuestionStats(pqs.map((pq: any) => ({
          id: pq.questions.id, title: pq.questions.title, category: pq.questions.category,
          correct_answer: pq.questions.correct_answer,
          options: pq.questions.options || [], total: 0, correct: 0, counts: [0, 0, 0, 0],
        })));
        setStudentScores([]);
        setLoading(false);
        return;
      }

      // Get all results
      const { data: results } = await (supabase as any)
        .from("scan_results")
        .select("student_id, answer, is_correct, session_id, students(name, student_no)")
        .in("session_id", sessionIds);
      const allResults = results || [];

      // Build session -> question map
      const sessionQuestionMap = new Map<string, string>();
      filteredSessions.forEach((s: any) => sessionQuestionMap.set(s.id, s.question_id));

      // Question stats
      const qStats: QuestionStat[] = pqs.map((pq: any) => {
        const q = pq.questions;
        const qResults = allResults.filter((r: any) => sessionQuestionMap.get(r.session_id) === q.id);
        const counts = [0, 0, 0, 0];
        qResults.forEach((r: any) => { if (r.answer >= 0 && r.answer < 4) counts[r.answer]++; });
        return {
          id: q.id, title: q.title, category: q.category,
          correct_answer: q.correct_answer, options: q.options || [],
          total: qResults.length,
          correct: qResults.filter((r: any) => r.is_correct).length,
          counts,
        };
      });
      setQuestionStats(qStats);

      // Student scores
      const scoreMap = new Map<string, { name: string; student_no: string; total: number; correct: number }>();
      allResults.forEach((r: any) => {
        const key = r.student_id;
        if (!scoreMap.has(key)) {
          scoreMap.set(key, { name: r.students?.name || "", student_no: r.students?.student_no || "", total: 0, correct: 0 });
        }
        const entry = scoreMap.get(key)!;
        entry.total++;
        if (r.is_correct) entry.correct++;
      });
      const scores = Array.from(scoreMap.entries())
        .map(([student_id, s]) => ({
          student_id, ...s,
          rate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate || b.correct - a.correct);
      setStudentScores(scores);
      setLoading(false);
    })();
  }, [paperId, selectedClassId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalQ = questionStats.length;
  const avgRate = questionStats.length > 0
    ? Math.round(questionStats.reduce((sum, q) => sum + (q.total > 0 ? (q.correct / q.total) * 100 : 0), 0) / questionStats.length)
    : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/statistics")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold truncate">{paperName}</h1>
          <p className="text-sm text-muted-foreground">试卷报告 · {totalQ} 道题</p>
        </div>
      </div>

      {/* Class filter */}
      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="选择班级" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部班级</SelectItem>
          {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <BarChart3 className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className={`text-2xl font-bold ${avgRate >= 80 ? "text-success" : avgRate >= 60 ? "text-warning" : "text-destructive"}`}>{avgRate}%</p>
          <p className="text-xs text-muted-foreground">平均正确率</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-primary">{studentScores.length}</p>
          <p className="text-xs text-muted-foreground">参与学生</p>
        </div>
      </div>

      {/* Per-question stats */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />各题正确率
        </h3>
        <div className="space-y-3">
          {questionStats.map((q, idx) => {
            const rate = q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0;
            return (
              <div key={q.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground w-6">Q{idx + 1}</span>
                  <span className="text-sm flex-1 truncate">{q.title}</span>
                  <span className={`text-sm font-bold ${rate >= 80 ? "text-success" : rate >= 60 ? "text-warning" : "text-destructive"}`}>
                    {rate}%
                  </span>
                </div>
                <div className="ml-6 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${rate >= 80 ? "bg-success" : rate >= 60 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student rankings */}
      <div className="bg-card rounded-xl p-5 shadow-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />学生排名
        </h3>
        <div className="space-y-2">
          {studentScores.map((s, idx) => (
            <div
              key={s.student_id}
              onClick={() => navigate(`/student-report/${s.student_id}`)}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? "bg-warning text-warning-foreground" :
                  idx === 1 ? "bg-muted text-muted-foreground" :
                  idx === 2 ? "bg-accent text-accent-foreground" :
                  "bg-secondary text-secondary-foreground"
                }`}>
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.student_no}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono">{s.correct}/{s.total}</span>
                <Badge variant={s.rate >= 80 ? "default" : s.rate >= 60 ? "secondary" : "destructive"}
                  className={s.rate >= 80 ? "bg-success text-success-foreground" : ""}>
                  {s.rate}%
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaperReport;
