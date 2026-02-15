import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, FileQuestion, CheckCircle2, Circle, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface ClassOption {
  id: string;
  name: string;
}

const Questions = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newCategory, setNewCategory] = useState("");
  const { toast } = useToast();

  // Class association dialog
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

  const filtered = questions.filter(
    (q) => q.title.includes(search) || q.category.includes(search)
  );

  const handleAdd = async () => {
    if (!newTitle || !user) return;
    const { error } = await supabase.from("questions").insert({
      user_id: user.id,
      title: newTitle,
      type: "single",
      options: newOptions.filter(Boolean),
      correct_answer: newCorrect,
      category: newCategory || "未分类",
    });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setNewTitle(""); setNewOptions(["", "", "", ""]); setNewCorrect(0); setNewCategory(""); setDialogOpen(false);
    toast({ title: "成功", description: "题目已添加" });
    fetchQuestions();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("questions").delete().eq("id", id);
    toast({ title: "已删除", description: "题目已移除" });
    fetchQuestions();
  };

  const openAssocDialog = async (q: QuestionRow) => {
    setAssocQuestion(q);
    // Fetch existing associations
    const { data } = await (supabase as any).from("class_questions").select("class_id").eq("question_id", q.id);
    setLinkedClassIds((data || []).map((r: any) => r.class_id));
    setAssocOpen(true);
  };

  const toggleClassLink = (classId: string) => {
    setLinkedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const saveAssociations = async () => {
    if (!assocQuestion || !user) return;
    setSavingAssoc(true);
    // Delete all existing, then insert new
    await (supabase as any).from("class_questions").delete().eq("question_id", assocQuestion.id);
    if (linkedClassIds.length > 0) {
      const rows = linkedClassIds.map(cid => ({
        question_id: assocQuestion.id,
        class_id: cid,
        user_id: user.id,
      }));
      const { error } = await (supabase as any).from("class_questions").insert(rows);
      if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); setSavingAssoc(false); return; }
    }
    toast({ title: "成功", description: `已关联 ${linkedClassIds.length} 个班级` });
    setSavingAssoc(false);
    setAssocOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">题目管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理您的题库，点击关联按钮将题目分配到班级</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0 shadow-card hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />新建题目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>新建选择题</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>题目内容</Label>
                <Textarea placeholder="输入题目..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Input placeholder="例：数学" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>选项（点击设为正确答案）</Label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button onClick={() => setNewCorrect(i)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${newCorrect === i ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {optionLabels[i]}
                    </button>
                    <Input placeholder={`选项 ${optionLabels[i]}`} value={opt} onChange={(e) => { const copy = [...newOptions]; copy[i] = e.target.value; setNewOptions(copy); }} />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} className="gradient-primary text-primary-foreground border-0">添加题目</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜索题目或分类..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((q, i) => (
          <div key={q.id} className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-primary" />
                <Badge variant="secondary">{q.category}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{q.type === "single" ? "单选题" : "判断题"}</Badge>
                <button onClick={() => openAssocDialog(q)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="关联班级">
                  <Link2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(q.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
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
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">暂无题目，点击"新建题目"开始</div>
        )}
      </div>

      {/* Association Dialog */}
      <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>关联班级</DialogTitle></DialogHeader>
          {assocQuestion && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{assocQuestion.title}</p>
              <div className="space-y-3">
                <Label>选择要关联的班级</Label>
                {classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无班级，请先创建班级</p>
                ) : (
                  classes.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => toggleClassLink(c.id)}>
                      <Checkbox checked={linkedClassIds.includes(c.id)} onCheckedChange={() => toggleClassLink(c.id)} />
                      <span className="font-medium text-sm">{c.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssocOpen(false)}>取消</Button>
            <Button onClick={saveAssociations} disabled={savingAssoc} className="gradient-primary text-primary-foreground border-0">
              {savingAssoc ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Questions;
