import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ClassInfo {
  id: string;
  name: string;
  grade: string;
  created_at: string;
  studentCount?: number;
}

const Classes = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const { toast } = useToast();

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return; }

    // Get student counts
    const classesWithCounts: ClassInfo[] = [];
    for (const cls of data || []) {
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("class_id", cls.id);
      classesWithCounts.push({ ...cls, studentCount: count || 0 });
    }
    setClasses(classesWithCounts);
  };

  useEffect(() => { fetchClasses(); }, []);

  const filtered = classes.filter(
    (c) => c.name.includes(search) || c.grade.includes(search)
  );

  const handleAdd = async () => {
    if (!newName || !newGrade || !user) return;
    const { error } = await supabase.from("classes").insert({
      name: newName, grade: newGrade, user_id: user.id,
    });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewGrade(""); setDialogOpen(false);
    toast({ title: "成功", description: `班级 "${newName}" 已创建` });
    fetchClasses();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    toast({ title: "已删除", description: "班级已移除" });
    fetchClasses();
  };

  const openRename = (cls: ClassInfo) => {
    setRenameId(cls.id); setRenameName(cls.name); setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameName.trim() || !renameId) return;
    const { error } = await supabase.from("classes").update({ name: renameName.trim() }).eq("id", renameId);
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setRenameOpen(false); setRenameId(null);
    toast({ title: "成功", description: "班级已重命名" });
    fetchClasses();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">班级管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理您的班级</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground border-0 shadow-card hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />新建班级
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建班级</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>班级名称</Label>
                <Input placeholder="例：高三(5)班" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>年级</Label>
                <Input placeholder="例：高三" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} className="gradient-primary text-primary-foreground border-0">创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜索班级..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((cls, i) => (
          <div key={cls.id} className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => openRename(cls)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cls.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-semibold">{cls.name}</h3>
            <p className="text-sm text-muted-foreground">{cls.grade}</p>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">学生人数</span>
              <span className="font-display font-bold text-primary">{cls.studentCount ?? 0}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            暂无班级，点击"新建班级"开始
          </div>
        )}
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>重命名班级</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>班级名称</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>取消</Button>
            <Button onClick={handleRename} className="gradient-primary text-primary-foreground border-0">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Classes;
