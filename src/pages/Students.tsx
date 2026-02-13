import { useState } from "react";
import { mockStudents, Student } from "@/lib/mock-data";
import { Search, Upload, Download, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const Students = () => {
  const [students] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = students.filter(
    (s) => s.name.includes(search) || s.studentNo.includes(search)
  );

  const handleImport = () => {
    toast({ title: "功能提示", description: "上传学生名单功能将在后端接入后启用" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">学生管理</h1>
          <p className="text-muted-foreground mt-1">管理学生名单与卡片分配（支持70人班级）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-2" />导入名单
          </Button>
          <Button variant="outline">
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
    </div>
  );
};

export default Students;
