import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Upload, Download, CreditCard, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface StudentRow {
  id: string;
  name: string;
  student_no: string;
  class_id: string;
  card_no: number | null;
  className?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

const Students = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudentNo, setEditStudentNo] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addStudentNo, setAddStudentNo] = useState("");
  const [addClassId, setAddClassId] = useState("");

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("id, name").order("created_at");
    setClasses(data || []);
    if (data && data.length > 0 && !addClassId) setAddClassId(data[0].id);
  };

  const fetchStudents = async () => {
    let query = supabase.from("students").select("*").order("card_no");
    if (selectedClass !== "all") query = query.eq("class_id", selectedClass);
    const { data } = await query;

    // Map class names
    const classMap: Record<string, string> = {};
    classes.forEach((c) => { classMap[c.id] = c.name; });

    setStudents((data || []).map((s: any) => ({
      ...s,
      className: classMap[s.class_id] || "",
    })));
  };

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => { if (classes.length > 0) fetchStudents(); }, [classes, selectedClass]);

  const filtered = students.filter(
    (s) => s.name.includes(search) || s.student_no.includes(search)
  );

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || classes.length === 0) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const startIdx = lines[0]?.includes("学号") || lines[0]?.includes("姓名") ? 1 : 0;
      const toInsert: any[] = [];
      const targetClassId = selectedClass !== "all" ? selectedClass : classes[0].id;

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(/[,\t，]/).map((c) => c.trim());
        if (cols.length >= 2) {
          toInsert.push({
            user_id: user.id,
            class_id: targetClassId,
            student_no: cols[0],
            name: cols[1],
            card_no: students.length + toInsert.length + 1,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("students").insert(toInsert);
        if (error) { toast({ title: "导入失败", description: error.message, variant: "destructive" }); return; }
        toast({ title: "导入成功", description: `已导入 ${toInsert.length} 名学生` });
        fetchStudents();
      } else {
        toast({ title: "导入失败", description: "未识别到有效数据，请使用 CSV 格式（学号,姓名）" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const header = "学号,姓名,班级,卡片编号\n";
    const rows = students.map((s) => `${s.student_no},${s.name},${s.className},${s.card_no ?? ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (student: StudentRow) => {
    setEditStudent(student); setEditName(student.name); setEditStudentNo(student.student_no); setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editStudent || !editName.trim() || !editStudentNo.trim()) return;
    const { error } = await supabase.from("students").update({ name: editName.trim(), student_no: editStudentNo.trim() }).eq("id", editStudent.id);
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setEditOpen(false);
    toast({ title: "已更新", description: "学生信息已修改" });
    fetchStudents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    toast({ title: "已删除", description: "学生已移除" });
    fetchStudents();
  };

  const handleAdd = async () => {
    if (!addName.trim() || !addStudentNo.trim() || !addClassId || !user) return;
    const { error } = await supabase.from("students").insert({
      user_id: user.id,
      class_id: addClassId,
      name: addName.trim(),
      student_no: addStudentNo.trim(),
      card_no: students.length + 1,
    });
    if (error) { toast({ title: "错误", description: error.message, variant: "destructive" }); return; }
    setAddName(""); setAddStudentNo(""); setAddOpen(false);
    toast({ title: "成功", description: "学生已添加" });
    fetchStudents();
  };

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">学生管理</h1>
          <p className="text-muted-foreground mt-1">管理学生名单与卡片分配（支持70人班级）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" />添加学生</Button>
          <Button variant="outline" onClick={handleImportClick}><Upload className="w-4 h-4 mr-2" />导入名单</Button>
          <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" />导出</Button>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜索学生姓名或学号..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="选择班级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班级</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="font-semibold">学号</TableHead>
                <TableHead className="font-semibold">姓名</TableHead>
                <TableHead className="font-semibold">班级</TableHead>
                <TableHead className="font-semibold">卡片编号</TableHead>
                <TableHead className="font-semibold">状态</TableHead>
                <TableHead className="font-semibold text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((student) => (
                <TableRow key={student.id} className="hover:bg-secondary/30 transition-colors">
                  <TableCell className="font-mono text-sm">{student.student_no}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.className}</TableCell>
                  <TableCell>
                    {student.card_no ? (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        <span className="font-mono font-medium">#{String(student.card_no).padStart(3, "0")}</span>
                      </div>
                    ) : <span className="text-muted-foreground">未分配</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={student.card_no ? "bg-success/10 text-success border-0" : "bg-muted"}>
                      {student.card_no ? "已分配" : "未分配"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(student)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(student.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无学生数据</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t">显示 50 / {filtered.length} 条记录</div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑学生</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>学号</Label><Input value={editStudentNo} onChange={(e) => setEditStudentNo(e.target.value)} /></div>
            <div className="space-y-2"><Label>姓名</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEditSave} className="gradient-primary text-primary-foreground border-0">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加学生</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>班级</Label>
              <Select value={addClassId} onValueChange={setAddClassId}>
                <SelectTrigger><SelectValue placeholder="选择班级" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>学号</Label><Input placeholder="例：2024071" value={addStudentNo} onChange={(e) => setAddStudentNo(e.target.value)} /></div>
            <div className="space-y-2"><Label>姓名</Label><Input placeholder="例：张三" value={addName} onChange={(e) => setAddName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} className="gradient-primary text-primary-foreground border-0">添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
