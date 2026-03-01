import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2, Circle, Monitor, Eye, EyeOff, Users,
  Play, Square, BarChart3, ArrowLeft, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const optionLabels = ["A", "B", "C", "D"];
const optionColors = [
  "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"
];

interface QuestionRow { id: string; title: string; options: string[]; correct_answer: number; category: string; }
interface ClassOption { id: string; name: string; }
interface StudentRow { id: string; name: string; student_no: string; card_no: number | null; }
interface ScanResultRow { student_id: string; answer: number; is_correct: boolean; scanned_at: string; }

// ─── Setup ────────────────────────────────────────────
function PresentSetup({ onStart }: { onStart: (classId: string, questionId: string, question: QuestionRow) => void }) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("classes").select("id, name").order("created_at");
      setClasses(data || []);
    })();
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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Monitor className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">PC 展示模式</h1>
          </div>
          <p className="text-muted-foreground">选择班级和题目后，题目将全屏显示给学生。教师用手机端扫描答案。</p>
        </div>

        <div className="space-y-4">
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
            <Button onClick={() => onStart(selectedClassId, selectedQuestionId, selectedQuestion)} size="lg" className="w-full gradient-primary text-primary-foreground border-0 shadow-card">
              <Play className="w-5 h-5 mr-2" />开始展示
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fullscreen Presenter ─────────────────────────────
function FullscreenPresenter({
  sessionId, question, students, onEnd
}: {
  sessionId: string;
  question: QuestionRow;
  students: StudentRow[];
  onEnd: () => void;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [results, setResults] = useState<ScanResultRow[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  // Load existing results
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("scan_results").select("*").eq("session_id", sessionId);
      if (data) setResults(data);
    })();
  }, [sessionId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`present-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_results", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as ScanResultRow;
          setResults(prev => {
            if (prev.find(r => r.student_id === row.student_id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const handleEnd = async () => {
    await (supabase as any).from("scan_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    toast({ title: "测试结束", description: `共收集 ${results.length} 份答案` });
    navigate(`/session/${sessionId}`);
  };

  const answered = results.length;
  const total = students.length;
  const correct = results.filter(r => r.is_correct).length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  // Answer distribution
  const counts = [0, 0, 0, 0];
  results.forEach(r => { if (r.answer >= 0 && r.answer < 4) counts[r.answer]++; });
  const maxCount = Math.max(...counts, 1);

  // Whether to show stats (live mode = always, otherwise only when toggled)
  const statsVisible = liveMode || showResults;

  // Copy session link for mobile
  const sessionLink = `${window.location.origin}/scan?session=${sessionId}`;
  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    toast({ title: "已复制", description: "手机端扫描链接已复制到剪贴板" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top control bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={onEnd}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Badge variant="secondary" className="text-xs">{question.category}</Badge>
        <div className="flex-1" />
        
        {/* Live mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">实时显示</span>
          <Switch checked={liveMode} onCheckedChange={setLiveMode} />
        </div>

        {/* Show/hide results button */}
        {!liveMode && (
          <Button variant="outline" size="sm" onClick={() => setShowResults(!showResults)}>
            {showResults ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showResults ? "隐藏结果" : "显示结果"}
          </Button>
        )}

        {/* Copy mobile link */}
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="w-4 h-4 mr-1" />手机端链接
        </Button>

        <Button variant="destructive" size="sm" onClick={handleEnd}>
          <Square className="w-4 h-4 mr-1" />结束测试
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {/* Question */}
        <div className="max-w-4xl w-full text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-8">
            {question.title}
          </h1>

          {/* Options grid */}
          <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
            {question.options.map((opt: string, i: number) => (
              <div
                key={i}
                className={`flex items-center gap-4 p-6 rounded-2xl text-left text-xl md:text-2xl font-medium transition-all ${
                  statsVisible && i === question.correct_answer
                    ? "bg-success/20 text-success ring-2 ring-success/50"
                    : "bg-card shadow-card"
                }`}
              >
                <span className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${optionColors[i]} text-white`}>
                  {optionLabels[i]}
                </span>
                <span>{opt}</span>
                {/* Show count when stats visible */}
                {statsVisible && (
                  <span className="ml-auto text-2xl font-bold text-muted-foreground">{counts[i]}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl w-full space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">答题进度</span>
              <span className="font-bold text-primary">{answered}/{total}</span>
            </div>
            {statsVisible && (
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">正确率</span>
                <span className="font-bold text-success">{accuracyPct}%</span>
              </div>
            )}
          </div>
          <Progress value={progressPct} className="h-3" />
        </div>

        {/* Distribution bars - only when stats visible */}
        {statsVisible && answered > 0 && (
          <div className="max-w-3xl w-full">
            <div className="flex items-end gap-6 h-32">
              {optionLabels.map((label, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-bold">{counts[i]}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${optionColors[i]} ${i === question.correct_answer ? "ring-2 ring-success" : ""}`}
                    style={{ height: `${Math.max(4, (counts[i] / maxCount) * 100)}%` }}
                  />
                  <span className="text-sm font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main PresentMode Page ────────────────────────────
const PresentMode = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const startSession = async (classId: string, questionId: string, q: QuestionRow) => {
    if (!user) return;

    const { data: stuData } = await supabase.from("students").select("*").eq("class_id", classId).order("card_no");
    setStudents(stuData || []);
    setQuestion(q);

    const { data, error } = await (supabase as any).from("scan_sessions").insert({
      question_id: questionId, class_id: classId, user_id: user.id, status: "active",
    }).select().single();

    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setSessionId(data.id);
    toast({ title: "展示已开始", description: "请用手机端打开扫描页面进行扫描" });
  };

  if (!sessionId || !question) {
    return <PresentSetup onStart={startSession} />;
  }

  return (
    <FullscreenPresenter
      sessionId={sessionId}
      question={question}
      students={students}
      onEnd={() => { setSessionId(null); setQuestion(null); }}
    />
  );
};

export default PresentMode;
