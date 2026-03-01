import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2, Circle, BarChart3, Users, Play, Square, Keyboard,
  ChevronUp, ChevronDown, ArrowLeft
} from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const optionLabels = ["A", "B", "C", "D"];

interface QuestionRow { id: string; title: string; options: string[]; correct_answer: number; category: string; }
interface ClassOption { id: string; name: string; }
interface StudentRow { id: string; name: string; student_no: string; card_no: number | null; }
interface ScanResult { student_id: string; student_name: string; student_no: string; answer: number; is_correct: boolean; }

// ─── Setup Screen ───────────────────────────────────────────
function SessionSetup({
  onStart,
}: {
  onStart: (classId: string, questionId: string, question: QuestionRow) => void;
}) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("classes").select("id, name").order("created_at");
      setClasses(data || []);
    })();
    const qid = searchParams.get("question");
    const cid = searchParams.get("class");
    if (qid) setSelectedQuestionId(qid);
    if (cid) setSelectedClassId(cid);
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    (async () => {
      const { data: links } = await (supabase as any).from("class_questions").select("question_id").eq("class_id", selectedClassId);
      if (!links || links.length === 0) { setQuestions([]); return; }
      const qids = links.map((l: any) => l.question_id);
      const { data } = await supabase.from("questions").select("*").in("id", qids);
      setQuestions((data || []).map((q: any) => ({ ...q, options: q.options || [] })));
    })();
  }, [selectedClassId]);

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">扫描测试</h1>
        <p className="text-muted-foreground mt-1">选择班级和题目，开始扫描学生答案</p>
      </div>
      <div className="max-w-md space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">选择班级</label>
          <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); setSelectedQuestionId(""); }}>
            <SelectTrigger><SelectValue placeholder="选择班级" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {selectedClassId && (
          <div className="space-y-2">
            <label className="text-sm font-medium">选择题目</label>
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">该班级暂无关联题目</p>
            ) : (
              <div className="space-y-2">
                {questions.map(q => (
                  <div key={q.id} onClick={() => setSelectedQuestionId(q.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedQuestionId === q.id ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-card hover:shadow-elevated"}`}
                  >
                    <Badge variant="secondary" className="text-xs mb-1">{q.category}</Badge>
                    <p className="text-sm font-medium">{q.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedQuestion && (
          <div className="pt-4">
            <div className="bg-card rounded-xl p-4 shadow-card mb-4">
              <p className="font-medium mb-3">{selectedQuestion.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {selectedQuestion.options.map((opt: string, i: number) => (
                  <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${i === selectedQuestion.correct_answer ? "bg-success/10 text-success font-medium" : "bg-secondary/50 text-muted-foreground"}`}>
                    {i === selectedQuestion.correct_answer ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{optionLabels[i]}. {opt}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => onStart(selectedClassId, selectedQuestionId, selectedQuestion)} size="lg" className="w-full gradient-primary text-primary-foreground border-0 shadow-card">
              <Play className="w-5 h-5 mr-2" />开始测试
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Student Panel (slide-up drawer) ─────────────────────────
function StudentPanel({
  students, results, expanded, onToggle
}: {
  students: StudentRow[];
  results: ScanResult[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const scannedIds = new Set(results.map(r => r.student_id));
  const scanned = students.filter(s => scannedIds.has(s.id));
  const unscanned = students.filter(s => !scannedIds.has(s.id));

  return (
    <div className={`bg-card border-t border-border transition-all duration-300 ${expanded ? "max-h-[60vh]" : "max-h-14"} overflow-hidden`}>
      {/* Header - always visible */}
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">学生进度</span>
          <Badge variant="secondary" className="text-xs">
            {scanned.length}/{students.length}
          </Badge>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Content */}
      {expanded && (
        <ScrollArea className="px-4 pb-4" style={{ maxHeight: "calc(60vh - 56px)" }}>
          {/* Unscanned */}
          {unscanned.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground font-medium mb-1.5">未扫描 ({unscanned.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {unscanned.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs">
                    <span className="font-mono text-muted-foreground">{s.card_no ?? "?"}</span>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Scanned */}
          {scanned.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">已扫描 ({scanned.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {scanned.map(s => {
                  const r = results.find(rr => rr.student_id === s.id);
                  return (
                    <span key={s.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${r?.is_correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      <span className="font-mono opacity-70">{s.card_no ?? "?"}</span>
                      {s.name}
                      <span className="font-bold">{r ? optionLabels[r.answer] : ""}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

// ─── Stats Bar ──────────────────────────────────────────────
function StatsBar({ results, total, correctAnswer }: { results: ScanResult[]; total: number; correctAnswer: number }) {
  const answered = results.length;
  const correct = results.filter(r => r.is_correct).length;
  const counts = [0, 0, 0, 0];
  results.forEach(r => { if (r.answer >= 0 && r.answer < 4) counts[r.answer]++; });
  const colors = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"];

  return (
    <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
      {/* Progress */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground">进度</span>
        <span className="text-sm font-bold text-primary">{answered}/{total}</span>
      </div>
      <div className="w-px h-5 bg-border shrink-0" />
      {/* Accuracy */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs text-muted-foreground">正确率</span>
        <span className="text-sm font-bold text-success">{answered > 0 ? Math.round(correct / answered * 100) : 0}%</span>
      </div>
      <div className="w-px h-5 bg-border shrink-0" />
      {/* Answer distribution mini bar */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {optionLabels.map((label, i) => (
          <div key={i} className={`flex items-center gap-0.5 shrink-0 ${i === correctAnswer ? "font-bold" : ""}`}>
            <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
            <span className="text-xs">{label}:{counts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
const ScanMode = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionRow | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCardNo, setManualCardNo] = useState("");
  const [manualAnswer, setManualAnswer] = useState<number | null>(null);

  // Join existing session from PC presenter link
  useEffect(() => {
    const joinSessionId = searchParams.get("session");
    if (!joinSessionId || sessionActive) return;
    (async () => {
      const { data: session } = await (supabase as any).from("scan_sessions").select("*").eq("id", joinSessionId).single();
      if (!session || session.status !== "active") {
        toast({ title: "会话无效", description: "该会话不存在或已结束", variant: "destructive" });
        return;
      }
      const { data: q } = await supabase.from("questions").select("*").eq("id", session.question_id).single();
      if (!q) return;
      const { data: stuData } = await supabase.from("students").select("*").eq("class_id", session.class_id).order("card_no");
      const { data: existingResults } = await (supabase as any).from("scan_results").select("*").eq("session_id", joinSessionId);

      setStudents(stuData || []);
      setSelectedClassId(session.class_id);
      setSelectedQuestion({ ...q, options: q.options || [] } as QuestionRow);
      setSessionId(joinSessionId);
      setSessionActive(true);
      setResults((existingResults || []).map((r: any) => {
        const stu = (stuData || []).find((s: any) => s.id === r.student_id);
        return { student_id: r.student_id, student_name: stu?.name || "", student_no: stu?.student_no || "", answer: r.answer, is_correct: r.is_correct };
      }));
      toast({ title: "已加入会话", description: "开始扫描学生卡片" });
    })();
  }, [searchParams]);

  const startSession = async (classId: string, questionId: string, question: QuestionRow) => {
    if (!user) return;
    const { data: stuData } = await supabase.from("students").select("*").eq("class_id", classId).order("card_no");
    setStudents(stuData || []);
    setSelectedClassId(classId);
    setSelectedQuestion(question);

    const { data, error } = await (supabase as any).from("scan_sessions").insert({
      question_id: questionId, class_id: classId, user_id: user.id, status: "active",
    }).select().single();

    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setSessionId(data.id);
    setSessionActive(true);
    setResults([]);
    toast({ title: "测试开始", description: "请开始扫描学生卡片" });
  };

  const endSession = async () => {
    if (!sessionId) return;
    await (supabase as any).from("scan_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    setSessionActive(false);
    toast({ title: "测试结束", description: `共收集 ${results.length} 份答案` });
    navigate(`/session/${sessionId}`);
  };

  const recordAnswer = useCallback(async (studentId: string, answer: number) => {
    if (!sessionId || !selectedQuestion) return;
    const isCorrect = answer === selectedQuestion.correct_answer;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (results.find(r => r.student_id === studentId)) {
      toast({ title: "提示", description: `${student.name} 已扫描过`, variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any).from("scan_results").insert({
      session_id: sessionId, student_id: studentId, answer, is_correct: isCorrect,
    });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }

    setResults(prev => [...prev, {
      student_id: studentId, student_name: student.name, student_no: student.student_no, answer, is_correct: isCorrect,
    }]);

    toast({
      title: `${student.name} - ${optionLabels[answer]}`,
      description: isCorrect ? "✅ 回答正确" : "❌ 回答错误",
    });
  }, [sessionId, selectedQuestion, students, results, toast]);

  const handleScan = useCallback((event: { cardNo: number; answer: number }) => {
    const student = students.find(s => s.card_no === event.cardNo);
    if (!student) {
      toast({ title: "未匹配", description: `卡片 #${event.cardNo} 未找到对应学生`, variant: "destructive" });
      return;
    }
    recordAnswer(student.id, event.answer);
  }, [students, recordAnswer, toast]);

  const handleManualSubmit = () => {
    if (manualAnswer === null || !manualCardNo) return;
    const student = students.find(s => s.card_no === parseInt(manualCardNo));
    if (!student) {
      toast({ title: "未找到", description: `卡片编号 ${manualCardNo} 未匹配到学生`, variant: "destructive" });
      return;
    }
    recordAnswer(student.id, manualAnswer);
    setManualCardNo("");
    setManualAnswer(null);
  };

  // Setup screen
  if (!sessionActive) {
    return <SessionSetup onStart={startSession} />;
  }

  // Active session — Plickers-style full-screen mobile layout
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:relative md:inset-auto md:z-auto md:h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={endSession}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{selectedQuestion?.title}</p>
        </div>
        <Button variant="destructive" size="sm" onClick={endSession} className="shrink-0 h-8 text-xs">
          <Square className="w-3 h-3 mr-1" />结束
        </Button>
      </div>

      {/* Stats bar */}
      <div className="bg-card border-b border-border shrink-0">
        <StatsBar results={results} total={students.length} correctAnswer={selectedQuestion?.correct_answer ?? 0} />
      </div>

      {/* Camera area — takes all remaining space */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <CameraScanner onScan={handleScan} />
        </div>

        {/* Manual input floating button */}
        <div className="absolute bottom-3 left-3 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowManual(!showManual)}
            className="bg-black/50 hover:bg-black/70 text-white border-0 text-xs h-8"
          >
            <Keyboard className="w-3.5 h-3.5 mr-1" />
            {showManual ? "关闭" : "手动"}
          </Button>
        </div>

        {/* Manual input overlay */}
        {showManual && (
          <div className="absolute bottom-12 left-3 right-3 z-10 bg-card/95 backdrop-blur rounded-xl p-3 shadow-elevated border border-border">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">卡片号</label>
                <input
                  type="number"
                  className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="#"
                  value={manualCardNo}
                  onChange={e => setManualCardNo(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {optionLabels.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setManualAnswer(i)}
                    className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors ${manualAnswer === i ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button onClick={handleManualSubmit} disabled={manualAnswer === null || !manualCardNo} size="sm" className="gradient-primary text-primary-foreground border-0 h-9">
                提交
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Student panel (bottom drawer) */}
      <StudentPanel
        students={students}
        results={results}
        expanded={panelExpanded}
        onToggle={() => setPanelExpanded(!panelExpanded)}
      />
    </div>
  );
};

export default ScanMode;
