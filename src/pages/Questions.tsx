import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, FileQuestion, CheckCircle2, Circle, Trash2, Link2, FileText, GripVertical, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const optionLabels = ["A", "B", "C", "D"];

interface QuestionRow {
  id: string;
  title: string;
  type: string;
  options: string[];
  correct_answer: number;
  category: string;
  created_at: string;
}

interface ClassOption { id: string; name: string; }

interface PaperRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  question_count?: number;
}

interface PaperQuestionRow {
  id: string;
  question_id: string;
  sort_order: number;
  question?: { id: string; title: string; category: string; type: string };
}

// ─── Questions Tab Content ───
function QuestionsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newCategory, setNewCategory] = useState("");
  const [assocOpen, setAssocOpen] = useState(false);
  const [assocQuestion, setAssocQuestion] = useState<QuestionRow | null>(null);
  const [linkedClassIds, setLinkedClassIds] = useState<string[]>([]);
  const [savingAssoc, setSavingAssoc] = useState(false);

  const fetchQuestions = async () => {
    const { data } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    setQuestions((data || []).map((q: any) => ({ ...q, options: q.options || [] })));
  };
  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name").order("created_at");
    setClasses(data || []);
  };
  useEffect(() => { fetchQuestions(); fetchClasses(); }, []);

  const filtered = questions.filter(q => q.title.includes(search) || q.category.includes(search));

  const handleAdd = async () => {
    if (!newTitle || !user) return;
    const { error } = await supabase.from("questions").insert({
      user_id: user.id, title: newTitle, type: "single",
      options: newOptions.filter(Boolean), correct_answer: newCorrect, category: newCategory || "未分类",
    });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setNewTitle(""); setNewOptions(["", "", "", ""]); setNewCorrect(0); setNewCategory(""); setDialogOpen(false);
    toast({ title: "成功", description: "题目已添加" }); fetchQuestions();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    toast({ title: "已删除" }); fetchQuestions();
  };

  const openAssocDialog = async (q: QuestionRow) => {
    setAssocQuestion(q);
    const { data } = await (supabase as any).from("class_questions").select("class_id").eq("question_id", q.id);
    setLinkedClassIds((data || []).map((r: any) => r.class_id));
    setAssocOpen(true);
  };
  const toggleClassLink = (cid: string) => setLinkedClassIds(prev => prev.includes(cid) ? prev.filter(id => id !== cid) : [...prev, cid]);
  const saveAssociations = async () => {
    if (!assocQuestion || !user) return;
    setSavingAssoc(true);
    await (supabase as any).from("class_questions").delete().eq("question_id", assocQuestion.id);
    if (linkedClassIds.length > 0) {
      const rows = linkedClassIds.map(cid => ({ question_id: assocQuestion.id, class_id: cid, user_id: user.id }));
      const { error } = await (supabase as any).from("class_questions").insert(rows);
      if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); setSavingAssoc(false); return; }
    }
    toast({ title: "成功", description: `已关联 ${linkedClassIds.length} 个班级` });
    setSavingAssoc(false); setAssocOpen(false);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0 shadow-card hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />新建题目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>新建选择题</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>题目内容</Label><Textarea placeholder="输入题目..." value={newTitle} onChange={e => setNewTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>分类</Label><Input placeholder="例：数学" value={newCategory} onChange={e => setNewCategory(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>选项（点击设为正确答案）</Label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => setNewCorrect(i)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${newCorrect === i ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>{optionLabels[i]}</button>
                    <Input placeholder={`选项 ${optionLabels[i]}`} value={opt} onChange={e => { const c = [...newOptions]; c[i] = e.target.value; setNewOptions(c); }} />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button onClick={handleAdd} className="gradient-primary text-primary-foreground border-0">添加题目</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜索题目或分类..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((q, i) => (
          <div key={q.id} className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2"><FileQuestion className="w-5 h-5 text-primary" /><Badge variant="secondary">{q.category}</Badge></div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{q.type === "single" ? "单选题" : "判断题"}</Badge>
                <button onClick={() => openAssocDialog(q)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="关联班级"><Link2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(q.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="font-medium mb-4">{q.title}</p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt: string, oi: number) => (
                <div key={oi} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${oi === q.correct_answer ? "bg-success/10 text-success font-medium" : "bg-secondary/50 text-muted-foreground"}`}>
                  {oi === q.correct_answer ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                  <span>{optionLabels[oi]}. {opt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">暂无题目，点击"新建题目"开始</div>}
      </div>

      <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>关联班级</DialogTitle></DialogHeader>
          {assocQuestion && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{assocQuestion.title}</p>
              <div className="space-y-3">
                <Label>选择要关联的班级</Label>
                {classes.length === 0 ? <p className="text-sm text-muted-foreground">暂无班级</p> : classes.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => toggleClassLink(c.id)}>
                    <Checkbox checked={linkedClassIds.includes(c.id)} onCheckedChange={() => toggleClassLink(c.id)} /><span className="font-medium text-sm">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssocOpen(false)}>取消</Button>
            <Button onClick={saveAssociations} disabled={savingAssoc} className="gradient-primary text-primary-foreground border-0">{savingAssoc ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Papers Tab Content ───
function PapersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<PaperRow | null>(null);
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestionRow[]>([]);
  const [allQuestions, setAllQuestions] = useState<{ id: string; title: string; category: string; type: string }[]>([]);
  const [addQuestionsOpen, setAddQuestionsOpen] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());

  const fetchPapers = async () => {
    const { data } = await (supabase as any).from("papers").select("*").order("created_at", { ascending: false });
    if (data) {
      const ids = data.map((p: any) => p.id);
      const { data: pqData } = await (supabase as any).from("paper_questions").select("paper_id").in("paper_id", ids.length > 0 ? ids : ["__none__"]);
      const countMap: Record<string, number> = {};
      (pqData || []).forEach((pq: any) => { countMap[pq.paper_id] = (countMap[pq.paper_id] || 0) + 1; });
      setPapers(data.map((p: any) => ({ ...p, question_count: countMap[p.id] || 0 })));
    }
    setLoading(false);
  };
  useEffect(() => { fetchPapers(); }, []);

  const createPaper = async () => {
    if (!user || !newName.trim()) return;
    const { error } = await (supabase as any).from("papers").insert({ name: newName.trim(), description: newDesc.trim(), user_id: user.id });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    toast({ title: "创建成功" }); setNewName(""); setNewDesc(""); setCreateOpen(false); fetchPapers();
  };

  const deletePaper = async (id: string) => {
    await (supabase as any).from("papers").delete().eq("id", id);
    toast({ title: "已删除" }); if (selectedPaper?.id === id) setSelectedPaper(null); fetchPapers();
  };

  const loadPaperQuestions = async (paper: PaperRow) => {
    setSelectedPaper(paper);
    const { data: pqData } = await (supabase as any).from("paper_questions").select("*").eq("paper_id", paper.id).order("sort_order");
    if (!pqData || pqData.length === 0) { setPaperQuestions([]); return; }
    const qids = pqData.map((pq: any) => pq.question_id);
    const { data: qData } = await supabase.from("questions").select("id, title, category, type").in("id", qids);
    const qMap: Record<string, any> = {};
    (qData || []).forEach(q => { qMap[q.id] = q; });
    setPaperQuestions(pqData.map((pq: any) => ({ ...pq, question: qMap[pq.question_id] })));
  };

  const openAddQuestions = async () => {
    const { data } = await supabase.from("questions").select("id, title, category, type").order("created_at", { ascending: false });
    setAllQuestions((data || []) as any);
    setSelectedQIds(new Set(paperQuestions.map(pq => pq.question_id)));
    setAddQuestionsOpen(true);
  };

  const saveQuestionSelection = async () => {
    if (!selectedPaper || !user) return;
    const existingIds = new Set(paperQuestions.map(pq => pq.question_id));
    const toAdd = [...selectedQIds].filter(id => !existingIds.has(id));
    const toRemove = [...existingIds].filter(id => !selectedQIds.has(id));
    if (toRemove.length > 0) await (supabase as any).from("paper_questions").delete().eq("paper_id", selectedPaper.id).in("question_id", toRemove);
    if (toAdd.length > 0) {
      const maxOrder = paperQuestions.length > 0 ? Math.max(...paperQuestions.map(pq => pq.sort_order)) : -1;
      await (supabase as any).from("paper_questions").insert(toAdd.map((qid, i) => ({ paper_id: selectedPaper.id, question_id: qid, sort_order: maxOrder + 1 + i, user_id: user.id })));
    }
    setAddQuestionsOpen(false); loadPaperQuestions(selectedPaper); fetchPapers(); toast({ title: "已更新题目" });
  };

  const removeQuestion = async (pqId: string) => {
    await (supabase as any).from("paper_questions").delete().eq("id", pqId);
    if (selectedPaper) loadPaperQuestions(selectedPaper); fetchPapers();
  };

  const toggleQId = (id: string) => setSelectedQIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (selectedPaper) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPaper(null)}>← 返回</Button>
          <div>
            <h2 className="text-2xl font-display font-bold">{selectedPaper.name}</h2>
            {selectedPaper.description && <p className="text-sm text-muted-foreground">{selectedPaper.description}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">共 {paperQuestions.length} 道题目</p>
          <Button size="sm" onClick={openAddQuestions}><Plus className="w-4 h-4 mr-1" />添加/管理题目</Button>
        </div>
        <div className="space-y-2">
          {paperQuestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>暂无题目，点击上方按钮添加</p></div>
          ) : paperQuestions.map((pq, idx) => (
            <div key={pq.id} className="flex items-center gap-3 p-4 bg-card rounded-xl shadow-card">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-bold text-muted-foreground w-6">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1"><Badge variant="secondary" className="text-xs">{pq.question?.category || ""}</Badge><Badge variant="outline" className="text-xs">{pq.question?.type === "truefalse" ? "判断" : "选择"}</Badge></div>
                <p className="text-sm font-medium truncate">{pq.question?.title || "未知题目"}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeQuestion(pq.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <Dialog open={addQuestionsOpen} onOpenChange={setAddQuestionsOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>选择题目</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {allQuestions.map(q => (
                <label key={q.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <Checkbox checked={selectedQIds.has(q.id)} onCheckedChange={() => toggleQId(q.id)} />
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-1 mb-0.5"><Badge variant="secondary" className="text-xs">{q.category}</Badge></div><p className="text-sm truncate">{q.title}</p></div>
                </label>
              ))}
              {allQuestions.length === 0 && <p className="text-center text-muted-foreground py-6">暂无题目，请先创建题目</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddQuestionsOpen(false)}>取消</Button>
              <Button onClick={saveQuestionSelection}>确认 ({selectedQIds.size})</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0"><Plus className="w-4 h-4 mr-1" />新建试卷</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建试卷</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><label className="text-sm font-medium">试卷名称</label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="如：第三章测验" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">描述（可选）</label><Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="简要描述" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={createPaper} disabled={!newName.trim()}>创建</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><FileText className="w-16 h-16 mx-auto mb-4 opacity-40" /><p className="text-lg font-medium mb-1">暂无试卷</p><p className="text-sm">点击「新建试卷」开始组卷</p></div>
      ) : (
        <div className="grid gap-3">
          {papers.map(p => (
            <div key={p.id} onClick={() => loadPaperQuestions(p)} className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-card hover:shadow-elevated transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
              <div className="flex-1 min-w-0"><p className="font-semibold truncate">{p.name}</p><p className="text-xs text-muted-foreground">{p.question_count || 0} 道题目 · {new Date(p.created_at).toLocaleDateString()}</p></div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={e => { e.stopPropagation(); deletePaper(p.id); }}><Trash2 className="w-4 h-4" /></Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Main Page ───
const Questions = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-display font-bold">题目管理</h1>
      <p className="text-muted-foreground mt-1">管理题库与组卷</p>
    </div>
    <Tabs defaultValue="questions">
      <TabsList>
        <TabsTrigger value="questions"><FileQuestion className="w-4 h-4 mr-1.5" />题目库</TabsTrigger>
        <TabsTrigger value="papers"><FileText className="w-4 h-4 mr-1.5" />试卷管理</TabsTrigger>
      </TabsList>
      <TabsContent value="questions" className="space-y-6"><QuestionsTab /></TabsContent>
      <TabsContent value="papers" className="space-y-6"><PapersTab /></TabsContent>
    </Tabs>
  </div>
);

export default Questions;
