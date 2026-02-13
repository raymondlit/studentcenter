import { useState, useRef } from "react";
import { mockStudents, Student } from "@/lib/mock-data";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Students = () => {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudentNo, setEditStudentNo] = useState("");

  // Add state
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addStudentNo, setAddStudentNo] = useState("");

  const filtered = students.filter(
    (s) => s.name.includes(search) || s.studentNo.includes(search)
  );

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      // Skip header if present
      const startIdx = lines[0]?.includes("学号") || lines[0]?.includes("姓名") ? 1 : 0;
      const imported: Student[] = [];

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(/[,\t，]/).map((c) => c.trim());
        if (cols.length >= 2) {
          imported.push({
            id: `imp_${Date.now()}_${i}`,
            studentNo: cols[0],
            name: cols[1],
            classId: "1",
            className: cols[2] || "高三(1)班",
            cardNo: students.length + imported.length + 1,
          });
        }
      }

      if (imported.length > 0) {
        setStudents((prev) => [...prev, ...imported]);
        toast({ title: "导入成功", description: `已导入 ${imported.length} 名学生` });
      } else {
        toast({ title: "导入失败", description: "未识别到有效数据，请使用 CSV 格式（学号,姓名,班级）" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const header = "学号,姓名,班级,卡片编号\n";
    const rows = students.map((s) => `${s.studentNo},${s.name},${s.className},${s.cardNo ?? ""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (student: Student) => {
    setEditStudent(student);
    setEditName(student.name);
    setEditStudentNo(student.studentNo);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editStudent || !editName.trim() || !editStudentNo.trim()) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === editStudent.id ? { ...s, name: editName.trim(), studentNo: editStudentNo.trim() } : s
      )
    );
    setEditOpen(false);
    toast({ title: "已更新", description: "学生信息已修改" });
  };

  const handleDelete = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "已删除", description: "学生已移除" });
  };

  const handleAdd = () => {
    if (!addName.trim() || !addStudentNo.trim()) return;
    const newStudent: Student = {
      id: `s_${Date.now()}`,
      name: addName.trim(),
      studentNo: addStudentNo.trim(),
      classId: "1",
      className: "高三(1)班",
      cardNo: students.length + 1,
    };
    setStudents((prev) => [...prev, newStudent]);
    setAddName("");
    setAddStudentNo("");
    setAddOpen(false);
    toast({ title: "成功", description: `学生 "${newStudent.name}" 已添加` });
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">学生管理</h1>
          <p className="text-muted-foreground mt-1">管理学生名单与卡片分配（支持70人班级）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />添加学生
          </Button>
          <Button variant="outline" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-2" />导入名单
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />导出
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜索学生姓名或学号..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              {filtered.slice(0, 20).map((student) => (
                <TableRow key={student.id} className="hover:bg-secondary/30 transition-colors">
                  <TableCell className="font-mono text-sm">{student.studentNo}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.className}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <span className="font-mono font-medium">#{String(student.cardNo).padStart(3, "0")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-success/10 text-success border-0">
                      已分配
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(student)}
                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 20 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            显示 20 / {filtered.length} 条记录
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑学生</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>学号</Label>
              <Input value={editStudentNo} onChange={(e) => setEditStudentNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleEditSave} className="gradient-primary text-primary-foreground border-0">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加学生</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>学号</Label>
              <Input placeholder="例：2024071" value={addStudentNo} onChange={(e) => setAddStudentNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input placeholder="例：张三" value={addName} onChange={(e) => setAddName(e.target.value)} />
            </div>
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
