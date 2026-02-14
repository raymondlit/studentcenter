import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Users, FileQuestion, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";

const Dashboard = () => {
  const [classCount, setClassCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ count: cc }, { count: sc }, { count: qc }, { data: clsData }] = await Promise.all([
        supabase.from("classes").select("*", { count: "exact", head: true }),
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*").order("created_at"),
      ]);
      setClassCount(cc || 0);
      setStudentCount(sc || 0);
      setQuestionCount(qc || 0);

      // Get student counts per class
      const classesWithCounts = [];
      for (const cls of clsData || []) {
        const { count } = await supabase.from("students").select("*", { count: "exact", head: true }).eq("class_id", cls.id);
        classesWithCounts.push({ ...cls, studentCount: count || 0 });
      }
      setClasses(classesWithCounts);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">仪表盘</h1>
        <p className="text-muted-foreground mt-1">教学互动平台概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="班级总数" value={classCount} icon={GraduationCap} variant="primary" description="活跃班级" />
        <StatCard title="学生总数" value={studentCount} icon={Users} description="已注册学生" />
        <StatCard title="题目总数" value={questionCount} icon={FileQuestion} description="题库数量" />
        <StatCard title="平均正确率" value="--" icon={TrendingUp} variant="accent" description="暂无数据" />
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card animate-fade-in">
        <h2 className="text-lg font-display font-semibold mb-4">班级列表</h2>
        <div className="space-y-3">
          {classes.map((cls) => (
            <div key={cls.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{cls.name}</p>
                  <p className="text-sm text-muted-foreground">{cls.grade}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-semibold text-card-foreground">{cls.studentCount}</p>
                <p className="text-sm text-muted-foreground">人</p>
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">暂无班级数据，请先创建班级</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
