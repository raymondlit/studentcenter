import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Circle, BarChart3, Users, Play, Square, Keyboard } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const optionLabels = ["A", "B", "C", "D"];

interface QuestionRow {
  id: string;
  title: string;
  options: string[];
  correct_answer: number;
  category: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  name: string;
  student_no: string;
  card_no: number | null;
}

interface ScanResult {
  student_id: string;
  student_name: string;
  student_no: string;
  answer: number;
  is_correct: boolean;
}

const ScanMode = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Selection state
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [results, setResults] = useState<ScanResult[]>([]);

  // Manual input mode (simulate scan)
  const [manualCardNo, setManualCardNo] = useState("");
  const [manualAnswer, setManualAnswer] = useState<number | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    fetchClasses();
    const qid = searchParams.get("question");
    const cid = searchParams.get("class");
    if (qid) setSelectedQuestionId(qid);
    if (cid) setSelectedClassId(cid);
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchQuestionsForClass(selectedClassId);
  }, [selectedClassId]);

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name").order("created_at");
    setClasses(data || []);
  };

  const fetchQuestionsForClass = async (classId: string) => {
    // Get question IDs linked to this class
    const { data: links } = await (supabase as any).from("class_questions").select("question_id").eq("class_id", classId);
    if (!links || links.length === 0) { setQuestions([]); return; }
    const qids = links.map((l: any) => l.question_id);
    const { data } = await supabase.from("questions").select("*").in("id", qids);
    setQuestions((data || []).map((q: any) => ({ ...q, options: q.options || [] })));
  };

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId);

  const startSession = async () => {
    if (!user || !selectedClassId || !selectedQuestionId) return;

    // Fetch students for this class
    const { data: stuData } = await supabase.from("students").select("*").eq("class_id", selectedClassId).order("card_no");
    setStudents(stuData || []);

    // Create session
    const { data, error } = await (supabase as any).from("scan_sessions").insert({
      question_id: selectedQuestionId,
      class_id: selectedClassId,
      user_id: user.id,
      status: "active",
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
  };

  const recordAnswer = async (studentId: string, answer: number) => {
    if (!sessionId || !selectedQuestion) return;
    const isCorrect = answer === selectedQuestion.correct_answer;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Check if already scanned
    if (results.find(r => r.student_id === studentId)) {
      toast({ title: "提示", description: `${student.name} 已扫描过`, variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any).from("scan_results").insert({
      session_id: sessionId,
      student_id: studentId,
      answer,
      is_correct: isCorrect,
    });

    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }

    setResults(prev => [...prev, {
      student_id: studentId,
      student_name: student.name,
      student_no: student.student_no,
      answer,
      is_correct: isCorrect,
    }]);

    toast({
      title: `${student.name} - ${optionLabels[answer]}`,
      description: isCorrect ? "✅ 回答正确" : "❌ 回答错误",
    });
  };

  const handleManualSubmit = () => {
    if (manualAnswer === null || !manualCardNo) return;
    const cardNum = parseInt(manualCardNo);
    const student = students.find(s => s.card_no === cardNum);
    if (!student) {
      toast({ title: "未找到", description: `卡片编号 ${cardNum} 未匹配到学生`, variant: "destructive" });
      return;
    }
    recordAnswer(student.id, manualAnswer);
    setManualCardNo("");
    setManualAnswer(null);
  };

  // Statistics
  const totalStudents = students.length;
  const answeredCount = results.length;
  const correctCount = results.filter(r => r.is_correct).length;
  const answerCounts = [0, 0, 0, 0];
  results.forEach(r => { if (r.answer >= 0 && r.answer < 4) answerCounts[r.answer]++; });

  // Selection view
  if (!sessionActive) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">扫描测试</h1>
          <p className="text-muted-foreground mt-1">选择班级和题目，开始扫描学生答案</p>
        </div>

        <div className="max-w-md space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">选择班级</label>
            <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedQuestionId(""); }}>
              <SelectTrigger><SelectValue placeholder="选择班级" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedClassId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">选择题目</label>
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">该班级暂无关联题目，请先在题目管理中关联</p>
              ) : (
                <div className="space-y-2">
                  {questions.map(q => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedQuestionId === q.id ? "border-primary bg-primary/5" : "border-transparent bg-card shadow-card hover:shadow-elevated"}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">{q.category}</Badge>
                      </div>
                      <p className="text-sm font-medium">{q.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedQuestionId && selectedQuestion && (
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
              <Button onClick={startSession} size="lg" className="w-full gradient-primary text-primary-foreground border-0 shadow-card">
                <Play className="w-5 h-5 mr-2" />开始测试
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active session view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">测试进行中</h1>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{selectedQuestion?.title}</p>
        </div>
        <Button variant="destructive" onClick={endSession}>
          <Square className="w-4 h-4 mr-2" />结束测试
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-primary">{answeredCount}/{totalStudents}</p>
          <p className="text-xs text-muted-foreground">已扫描</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card text-center">
          <p className="text-2xl font-bold text-success">{answeredCount > 0 ? Math.round(correctCount / answeredCount * 100) : 0}%</p>
          <p className="text-xs text-muted-foreground">正确率</p>
        </div>
        {optionLabels.map((label, i) => (
          <div key={i} className={`bg-card rounded-xl p-3 shadow-card text-center ${selectedQuestion && i === selectedQuestion.correct_answer ? "ring-2 ring-success" : ""}`}>
            <p className="text-lg font-bold">{answerCounts[i]}</p>
            <p className="text-xs text-muted-foreground">选{label}</p>
          </div>
        ))}
      </div>

      {/* Answer distribution bar */}
      {answeredCount > 0 && (
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" />答案分布</h3>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {optionLabels.map((label, i) => {
              const pct = answeredCount > 0 ? (answerCounts[i] / answeredCount * 100) : 0;
              if (pct === 0) return null;
              const colors = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500"];
              return (
                <div key={i} className={`${colors[i]} flex items-center justify-center text-white text-xs font-bold transition-all`} style={{ width: `${pct}%` }}>
                  {pct >= 10 && `${label} ${Math.round(pct)}%`}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Camera scanner */}
      <div className="bg-card rounded-xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-3">📷 摄像头扫描</h3>
        <CameraScanner
          onScan={(event) => {
            const student = students.find(s => s.card_no === event.cardNo);
            if (!student) {
              toast({ title: "未匹配", description: `卡片 #${event.cardNo} 未找到对应学生`, variant: "destructive" });
              return;
            }
            recordAnswer(student.id, event.answer);
          }}
        />
      </div>

      {/* Manual input toggle */}
      <div className="bg-card rounded-xl p-4 shadow-card">
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-sm font-semibold flex items-center gap-2 w-full text-left"
        >
          <Keyboard className="w-4 h-4" />
          手动录入答案
          <span className="text-xs text-muted-foreground ml-auto">{showManualInput ? "收起" : "展开"}</span>
        </button>
        {showManualInput && (
          <div className="flex gap-2 items-end flex-wrap mt-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">卡片编号</label>
              <input
                type="number"
                className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="编号"
                value={manualCardNo}
                onChange={e => setManualCardNo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">答案</label>
              <div className="flex gap-1">
                {optionLabels.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setManualAnswer(i)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${manualAnswer === i ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleManualSubmit} disabled={manualAnswer === null || !manualCardNo} className="gradient-primary text-primary-foreground border-0">
              提交
            </Button>
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="bg-card rounded-xl p-4 shadow-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" />扫描记录 ({results.length})</h3>
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无记录，请开始扫描</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {[...results].reverse().map((r, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${r.is_correct ? "bg-success/10" : "bg-destructive/10"}`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{r.student_no}</span>
                  <span className="font-medium text-sm">{r.student_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.is_correct ? "default" : "destructive"} className={r.is_correct ? "bg-success text-success-foreground" : ""}>
                    {optionLabels[r.answer]}
                  </Badge>
                  {r.is_correct ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Circle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanMode;
