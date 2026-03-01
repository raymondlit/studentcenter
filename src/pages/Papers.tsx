import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, GripVertical, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface PaperRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  question_count?: number;
}

interface QuestionRow {
  id: string;
  title: string;
  category: string;
  type: string;
}

interface PaperQuestionRow {
  id: string;
  question_id: string;
  sort_order: number;
  question?: QuestionRow;
}

const Papers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Detail view
  const [selectedPaper, setSelectedPaper] = useState<PaperRow | null>(null);
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestionRow[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionRow[]>([]);
  const [addQuestionsOpen, setAddQuestionsOpen] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());

  const fetchPapers = async () => {
    const { data } = await (supabase as any).from("papers").select("*").order("created_at", { ascending: false });
    if (data) {
      // Get question counts
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
    toast({ title: "创建成功" });
    setNewName(""); setNewDesc(""); setCreateOpen(false);
    fetchPapers();
  };

  const deletePaper = async (id: string) => {
    await (supabase as any).from("papers").delete().eq("id", id);
    toast({ title: "已删除" });
    if (selectedPaper?.id === id) setSelectedPaper(null);
    fetchPapers();
  };

  // Detail: load paper questions
  const loadPaperQuestions = async (paper: PaperRow) => {
    setSelectedPaper(paper);
    const { data: pqData } = await (supabase as any).from("paper_questions").select("*").eq("paper_id", paper.id).order("sort_order");
    if (!pqData || pqData.length === 0) { setPaperQuestions([]); return; }
    const qids = pqData.map((pq: any) => pq.question_id);
    const { data: qData } = await supabase.from("questions").select("id, title, category, type").in("id", qids);
    const qMap: Record<string, QuestionRow> = {};
    (qData || []).forEach(q => { qMap[q.id] = q as QuestionRow; });
    setPaperQuestions(pqData.map((pq: any) => ({ ...pq, question: qMap[pq.question_id] })));
  };

  // Add questions dialog
  const openAddQuestions = async () => {
    const { data } = await supabase.from("questions").select("id, title, category, type").order("created_at", { ascending: false });
    setAllQuestions((data || []) as QuestionRow[]);
    const existing = new Set(paperQuestions.map(pq => pq.question_id));
    setSelectedQIds(existing);
    setAddQuestionsOpen(true);
  };

  const saveQuestionSelection = async () => {
    if (!selectedPaper || !user) return;
    const existingIds = new Set(paperQuestions.map(pq => pq.question_id));
    const toAdd = [...selectedQIds].filter(id => !existingIds.has(id));
    const toRemove = [...existingIds].filter(id => !selectedQIds.has(id));

    if (toRemove.length > 0) {
      await (supabase as any).from("paper_questions").delete().eq("paper_id", selectedPaper.id).in("question_id", toRemove);
    }
    if (toAdd.length > 0) {
      const maxOrder = paperQuestions.length > 0 ? Math.max(...paperQuestions.map(pq => pq.sort_order)) : -1;
      const inserts = toAdd.map((qid, i) => ({
        paper_id: selectedPaper.id, question_id: qid, sort_order: maxOrder + 1 + i, user_id: user.id,
      }));
      await (supabase as any).from("paper_questions").insert(inserts);
    }
    setAddQuestionsOpen(false);
    loadPaperQuestions(selectedPaper);
    fetchPapers();
    toast({ title: "已更新题目" });
  };

  const removeQuestion = async (pqId: string) => {
    await (supabase as any).from("paper_questions").delete().eq("id", pqId);
    if (selectedPaper) loadPaperQuestions(selectedPaper);
    fetchPapers();
  };

  const toggleQId = (id: string) => {
    setSelectedQIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  // Detail view
  if (selectedPaper) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPaper(null)}>← 返回</Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{selectedPaper.name}</h1>
            {selectedPaper.description && <p className="text-sm text-muted-foreground">{selectedPaper.description}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">共 {paperQuestions.length} 道题目</p>
          <Button size="sm" onClick={openAddQuestions}><Plus className="w-4 h-4 mr-1" />添加/管理题目</Button>
        </div>

        <div className="space-y-2">
          {paperQuestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>暂无题目，点击上方按钮添加</p>
            </div>
          ) : (
            paperQuestions.map((pq, idx) => (
              <div key={pq.id} className="flex items-center gap-3 p-4 bg-card rounded-xl shadow-card">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-bold text-muted-foreground w-6">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{pq.question?.category || ""}</Badge>
                    <Badge variant="outline" className="text-xs">{pq.question?.type === "truefalse" ? "判断" : "选择"}</Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{pq.question?.title || "未知题目"}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeQuestion(pq.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add questions dialog */}
        <Dialog open={addQuestionsOpen} onOpenChange={setAddQuestionsOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader><DialogTitle>选择题目</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {allQuestions.map(q => (
                <label key={q.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <Checkbox checked={selectedQIds.has(q.id)} onCheckedChange={() => toggleQId(q.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Badge variant="secondary" className="text-xs">{q.category}</Badge>
                    </div>
                    <p className="text-sm truncate">{q.title}</p>
                  </div>
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

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">试卷管理</h1>
          <p className="text-muted-foreground mt-1">创建试卷，组合多个题目</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0"><Plus className="w-4 h-4 mr-1" />新建试卷</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建试卷</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">试卷名称</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="如：第三章测验" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述（可选）</label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="简要描述" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={createPaper} disabled={!newName.trim()}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {papers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium mb-1">暂无试卷</p>
          <p className="text-sm">点击「新建试卷」开始组卷</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {papers.map(p => (
            <div key={p.id} onClick={() => loadPaperQuestions(p)}
              className="flex items-center gap-4 p-4 bg-card rounded-xl shadow-card hover:shadow-elevated transition-all cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.question_count || 0} 道题目 · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={e => { e.stopPropagation(); deletePaper(p.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Papers;
