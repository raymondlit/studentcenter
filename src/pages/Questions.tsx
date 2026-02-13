import { useState } from "react";
import { mockQuestions, Question } from "@/lib/mock-data";
import { Plus, Search, FileQuestion, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const optionLabels = ["A", "B", "C", "D"];

const Questions = () => {
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrect, setNewCorrect] = useState(0);
  const [newCategory, setNewCategory] = useState("");
  const { toast } = useToast();

  const filtered = questions.filter(
    (q) => q.title.includes(search) || q.category.includes(search)
  );

  const handleAdd = () => {
    if (!newTitle) return;
    const q: Question = {
      id: Date.now().toString(),
      title: newTitle,
      type: "single",
      options: newOptions.filter(Boolean),
      correctAnswer: newCorrect,
      category: newCategory || "未分类",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setQuestions([...questions, q]);
    setNewTitle("");
    setNewOptions(["", "", "", ""]);
    setNewCorrect(0);
    setNewCategory("");
    setDialogOpen(false);
    toast({ title: "成功", description: "题目已添加" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">题目管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理您的题库</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0 shadow-card hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />新建题目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>新建选择题</DialogTitle>
            </DialogHeader>
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
                    <button
                      onClick={() => setNewCorrect(i)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        newCorrect === i
                          ? "bg-success text-success-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {optionLabels[i]}
                    </button>
                    <Input
                      placeholder={`选项 ${optionLabels[i]}`}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[i] = e.target.value;
                        setNewOptions(copy);
                      }}
                    />
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
          <div
            key={q.id}
            className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-primary" />
                <Badge variant="secondary">{q.category}</Badge>
              </div>
              <Badge variant="outline" className="text-xs">
                {q.type === "single" ? "单选题" : "判断题"}
              </Badge>
            </div>
            <p className="font-medium mb-4">{q.title}</p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <div
                  key={oi}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                    oi === q.correctAnswer
                      ? "bg-success/10 text-success font-medium"
                      : "bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  {oi === q.correctAnswer ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{optionLabels[oi]}. {opt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Questions;
