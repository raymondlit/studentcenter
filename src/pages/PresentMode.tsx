import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Monitor, Eye, EyeOff, Users, Play, Square, BarChart3,
  ArrowLeft, Smartphone, ChevronRight, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QRCodeSVG } from "qrcode.react";

const optionLabels = ["A", "B", "C", "D"];
const optionColors = [
  "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"
];

interface QuestionRow { id: string; title: string; options: string[]; correct_answer: number; category: string; }
interface ClassOption { id: string; name: string; }
interface StudentRow { id: string; name: string; student_no: string; card_no: number | null; }
interface ScanResultRow { student_id: string; answer: number; is_correct: boolean; scanned_at: string; }
interface PaperRow { id: string; name: string; description: string; question_count?: number; }
interface PaperQuestionRow { question_id: string; sort_order: number; }

// ─── Setup ────────────────────────────────────────────
function PresentSetup({ onStartQuestion, onStartPaper }: {
  onStartQuestion: (classId: string, questionId: string, question: QuestionRow) => void;
  onStartPaper: (classId: string, paperId: string, questions: QuestionRow[]) => void;
}) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [tab, setTab] = useState("question");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("classes").select("id, name").order("created_at");
      setClasses(data || []);
    })();
  }, []);

  // Load questions for selected class
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

  // Load papers
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("papers").select("*").order("created_at", { ascending: false });
      if (!data) { setPapers([]); return; }
      const ids = data.map((p: any) => p.id);
      const { data: pqData } = await (supabase as any).from("paper_questions").select("paper_id").in("paper_id", ids.length > 0 ? ids : ["__none__"]);
      const countMap: Record<string, number> = {};
      (pqData || []).forEach((pq: any) => { countMap[pq.paper_id] = (countMap[pq.paper_id] || 0) + 1; });
      setPapers(data.map((p: any) => ({ ...p, question_count: countMap[p.id] || 0 })));
    })();
  }, []);

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const handleStartPaper = async () => {
    if (!selectedClassId || !selectedPaperId) return;
    const { data: pqData } = await (supabase as any).from("paper_questions").select("question_id, sort_order").eq("paper_id", selectedPaperId).order("sort_order");
    if (!pqData || pqData.length === 0) return;
    const qids = pqData.map((pq: any) => pq.question_id);
    const { data: qData } = await supabase.from("questions").select("*").in("id", qids);
    if (!qData) return;
    const qMap: Record<string, QuestionRow> = {};
    qData.forEach((q: any) => { qMap[q.id] = { ...q, options: q.options || [] }; });
    const ordered = pqData.map((pq: any) => qMap[pq.question_id]).filter(Boolean);
    onStartPaper(selectedClassId, selectedPaperId, ordered);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Monitor className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">发布测试</h1>
          </div>
          <p className="text-muted-foreground">选择班级，然后选择单个题目或试卷开始测试</p>
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
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="question" className="flex-1">单个题目</TabsTrigger>
                <TabsTrigger value="paper" className="flex-1">试卷</TabsTrigger>
              </TabsList>

              <TabsContent value="question" className="space-y-3 mt-3">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">该班级暂无关联题目</p>
                ) : (
                  questions.map(q => (
                    <div key={q.id} onClick={() => setSelectedQuestionId(q.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedQuestionId === q.id ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-card hover:shadow-elevated"}`}
                    >
                      <Badge variant="secondary" className="text-xs mb-1">{q.category}</Badge>
                      <p className="text-sm font-medium">{q.title}</p>
                    </div>
                  ))
                )}
                {selectedQuestion && (
                  <Button onClick={() => onStartQuestion(selectedClassId, selectedQuestionId, selectedQuestion)} size="lg" className="w-full gradient-primary text-primary-foreground border-0 shadow-card">
                    <Play className="w-5 h-5 mr-2" />开始展示
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="paper" className="space-y-3 mt-3">
                {papers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">暂无试卷，请先在「试卷管理」中创建</p>
                ) : (
                  papers.map(p => (
                    <div key={p.id} onClick={() => setSelectedPaperId(p.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPaperId === p.id ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-card hover:shadow-elevated"}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold">{p.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{p.question_count || 0} 道题目</p>
                    </div>
                  ))
                )}
                {selectedPaperId && (
                  <Button onClick={handleStartPaper} size="lg" className="w-full gradient-primary text-primary-foreground border-0 shadow-card">
                    <Play className="w-5 h-5 mr-2" />开始试卷测试
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fullscreen Presenter ─────────────────────────────
function FullscreenPresenter({
  sessionId, question, questionIndex, totalQuestions, students, onEnd, onNext
}: {
  sessionId: string;
  question: QuestionRow;
  questionIndex: number;
  totalQuestions: number;
  students: StudentRow[];
  onEnd: () => void;
  onNext?: () => void;
}) {
  const { toast } = useToast();
  const [results, setResults] = useState<ScanResultRow[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  useEffect(() => {
    setResults([]);
    setShowResults(false);
  }, [sessionId, question.id]);

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

  const answered = results.length;
  const total = students.length;
  const correct = results.filter(r => r.is_correct).length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const counts = [0, 0, 0, 0];
  results.forEach(r => { if (r.answer >= 0 && r.answer < 4) counts[r.answer]++; });
  const maxCount = Math.max(...counts, 1);
  const statsVisible = liveMode || showResults;

  const sessionLink = `${window.location.origin}/scan?session=${sessionId}`;
  const linkBtnRef = useRef<HTMLButtonElement>(null);
  const [btnWidth, setBtnWidth] = useState(120);

  useEffect(() => {
    if (linkBtnRef.current) {
      setBtnWidth(linkBtnRef.current.offsetWidth);
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top control bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={onEnd}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Badge variant="secondary" className="text-xs">{question.category}</Badge>
        {totalQuestions > 1 && (
          <Badge variant="outline" className="text-xs">第 {questionIndex + 1}/{totalQuestions} 题</Badge>
        )}
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">实时显示</span>
          <Switch checked={liveMode} onCheckedChange={setLiveMode} />
        </div>

        {!liveMode && (
          <Button variant="outline" size="sm" onClick={() => setShowResults(!showResults)}>
            {showResults ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showResults ? "隐藏结果" : "显示结果"}
          </Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button ref={linkBtnRef} variant="outline" size="sm">
              <Smartphone className="w-4 h-4 mr-1" />手机端链接
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="flex flex-col items-center gap-2">
              <QRCodeSVG value={sessionLink} size={btnWidth} level="L" />
              <p className="text-xs text-muted-foreground text-center max-w-[200px] truncate">{sessionLink}</p>
            </div>
          </PopoverContent>
        </Popover>

        {onNext && (
          <Button variant="default" size="sm" onClick={onNext}>
            下一题 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}

        <Button variant="destructive" size="sm" onClick={onEnd}>
          <Square className="w-4 h-4 mr-1" />结束测试
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="max-w-4xl w-full text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-8">
            {question.title}
          </h1>

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
                {statsVisible && (
                  <span className="ml-auto text-2xl font-bold text-muted-foreground">{counts[i]}</span>
                )}
              </div>
            ))}
          </div>
        </div>

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
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classId, setClassId] = useState("");

  const createSession = async (cId: string, questionId: string) => {
    if (!user) return null;
    const { data, error } = await (supabase as any).from("scan_sessions").insert({
      question_id: questionId, class_id: cId, user_id: user.id, status: "active",
    }).select().single();
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return null; }
    return data.id as string;
  };

  const startSingleQuestion = async (cId: string, questionId: string, q: QuestionRow) => {
    const { data: stuData } = await supabase.from("students").select("*").eq("class_id", cId).order("card_no");
    setStudents(stuData || []);
    setClassId(cId);
    setQuestions([q]);
    setCurrentIndex(0);
    const sid = await createSession(cId, questionId);
    if (sid) {
      setSessionId(sid);
      toast({ title: "展示已开始", description: "请用手机端打开扫描页面进行扫描" });
    }
  };

  const startPaper = async (cId: string, _paperId: string, qs: QuestionRow[]) => {
    if (qs.length === 0) return;
    const { data: stuData } = await supabase.from("students").select("*").eq("class_id", cId).order("card_no");
    setStudents(stuData || []);
    setClassId(cId);
    setQuestions(qs);
    setCurrentIndex(0);
    const sid = await createSession(cId, qs[0].id);
    if (sid) {
      setSessionId(sid);
      toast({ title: "试卷测试已开始", description: `共 ${qs.length} 道题目` });
    }
  };

  const handleNext = async () => {
    if (currentIndex >= questions.length - 1) return;
    // End current session
    if (sessionId) {
      await (supabase as any).from("scan_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    const sid = await createSession(classId, questions[nextIdx].id);
    if (sid) setSessionId(sid);
  };

  const handleEnd = async () => {
    if (sessionId) {
      await (supabase as any).from("scan_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    }
    toast({ title: "测试结束" });
    // If single question, go to session detail; otherwise go back to setup
    if (questions.length === 1 && sessionId) {
      navigate(`/session/${sessionId}`);
    } else {
      setSessionId(null);
      setQuestions([]);
      setCurrentIndex(0);
    }
  };

  if (!sessionId || questions.length === 0) {
    return <PresentSetup onStartQuestion={startSingleQuestion} onStartPaper={startPaper} />;
  }

  const currentQuestion = questions[currentIndex];
  const hasNext = currentIndex < questions.length - 1;

  return (
    <FullscreenPresenter
      sessionId={sessionId}
      question={currentQuestion}
      questionIndex={currentIndex}
      totalQuestions={questions.length}
      students={students}
      onEnd={handleEnd}
      onNext={hasNext ? handleNext : undefined}
    />
  );
};

export default PresentMode;
