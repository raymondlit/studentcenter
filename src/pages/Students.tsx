import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Upload, Download, CreditCard, Pencil, Trash2, Plus, ClipboardPaste } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteClassId, setPasteClassId] = useState("");

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

  const validateStudentInput = (name: string, student_no: string): string | null => {
    if (!name.trim()) return "姓名不能为空";
    if (name.trim().length > 100) return `姓名"${name.slice(0, 20)}..."超过100字符限制`;
    if (student_no.trim().length > 50) return `学号"${student_no.slice(0, 20)}..."超过50字符限制`;
    return null;
  };

  const parseStudentLines = (text: string): { student_no: string; name: string }[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const startIdx = lines[0]?.includes("学号") || lines[0]?.includes("姓名") || lines[0]?.includes("序号") ? 1 : 0;
    const result: { student_no: string; name: string }[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/[,\t，]/).map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        const isFirstDigit = /^\d+$/.test(cols[0]);
        result.push({
          student_no: (isFirstDigit ? cols[0] : cols[1]).slice(0, 50),
          name: (isFirstDigit ? cols[1] : cols[0]).slice(0, 100),
        });
      } else {
        result.push({ student_no: "", name: cols[0].slice(0, 100) });
      }
    }

    const existingCount = students.length;
    result.forEach((r, idx) => {
      if (!r.student_no) {
        r.student_no = String(existingCount + idx + 1).padStart(3, "0");
      }
    });

    return result;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || classes.length === 0) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const targetClassId = selectedClass !== "all" ? selectedClass : classes[0].id;
      await importStudents(text, targetClassId);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const importStudents = async (text: string, targetClassId: string) => {
    if (!user) return;
    const parsed = parseStudentLines(text);
    if (parsed.length === 0) {
      toast({ title: "导入失败", description: "未识别到有效数据，每行一个姓名，或使用「学号,姓名」格式", variant: "destructive" });
      return;
    }
    const validationErrors: string[] = [];
    const validParsed = parsed.filter((p) => {
      const err = validateStudentInput(p.name, p.student_no);
      if (err) { validationErrors.push(err); return false; }
      return true;
    });
    if (validationErrors.length > 0 && validParsed.length === 0) {
      toast({ title: "导入失败", description: validationErrors[0], variant: "destructive" });
      return;
    }
    if (validationErrors.length > 0) {
      toast({ title: "部分跳过", description: `${validationErrors.length} 条记录因格式问题被跳过` });
    }
    const toInsert = validParsed.map((p, idx) => ({
      user_id: user.id,
      class_id: targetClassId,
      student_no: p.student_no.trim(),
      name: p.name.trim(),
      card_no: students.length + idx + 1,
    }));
    const { error } = await supabase.from("students").insert(toInsert);
    if (error) { toast({ title: "导入失败", description: error.message, variant: "destructive" }); return; }
    toast({ title: "导入成功", description: `已导入 ${toInsert.length} 名学生` });
    fetchStudents();
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim() || classes.length === 0) return;
    const targetClassId = pasteClassId || (selectedClass !== "all" ? selectedClass : classes[0].id);
    await importStudents(pasteText, targetClassId);
    setPasteText("");
    setPasteOpen(false);
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
    const validErr = validateStudentInput(addName, addStudentNo);
    if (validErr) { toast({ title: "输入错误", description: validErr, variant: "destructive" }); return; }
    const { error } = await supabase.from("students").insert({
      user_id: user.id,
      class_id: addClassId,
      name: addName.trim().slice(0, 100),
      student_no: addStudentNo.trim().slice(0, 50),
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" />添加学生</Button>
          <Button variant="outline" onClick={handleImportClick}><Upload className="w-4 h-4 mr-2" />导入TXT/CSV</Button>
          <Button variant="outline" onClick={() => { setPasteClassId(selectedClass !== "all" ? selectedClass : classes[0]?.id || ""); setPasteOpen(true); }}><ClipboardPaste className="w-4 h-4 mr-2" />粘贴导入</Button>
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

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>粘贴导入学生</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>班级</Label>
              <Select value={pasteClassId} onValueChange={setPasteClassId}>
                <SelectTrigger><SelectValue placeholder="选择班级" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>学生名单</Label>
              <Textarea
                placeholder={"每行一个学生，支持以下格式：\n张三\n李四\n王五\n\n或带学号：\n001,张三\n002,李四"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">支持纯姓名（自动编号）或「学号,姓名」格式，逗号/Tab分隔均可</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasteOpen(false)}>取消</Button>
            <Button onClick={handlePasteImport} className="gradient-primary text-primary-foreground border-0">导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
