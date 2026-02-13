import { GraduationCap, Users, FileQuestion, BarChart3, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { mockClasses, mockStudents, mockQuestions, mockAnswerStats } from "@/lib/mock-data";

const Dashboard = () => {
  const totalStudents = mockClasses.reduce((sum, c) => sum + c.studentCount, 0);
  const avgCorrectRate = mockAnswerStats.length > 0
    ? Math.round(mockAnswerStats.reduce((sum, s) => sum + (s.correctCount / s.totalResponses) * 100, 0) / mockAnswerStats.length)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">仪表盘</h1>
        <p className="text-muted-foreground mt-1">教学互动平台概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="班级总数" value={mockClasses.length} icon={GraduationCap} variant="primary" description="活跃班级" />
        <StatCard title="学生总数" value={totalStudents} icon={Users} description="已注册学生" />
        <StatCard title="题目总数" value={mockQuestions.length} icon={FileQuestion} description="题库数量" />
        <StatCard title="平均正确率" value={`${avgCorrectRate}%`} icon={TrendingUp} variant="accent" description="近期测验" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-6 shadow-card animate-fade-in">
          <h2 className="text-lg font-display font-semibold mb-4">班级列表</h2>
          <div className="space-y-3">
            {mockClasses.map((cls) => (
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
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card animate-fade-in">
          <h2 className="text-lg font-display font-semibold mb-4">近期答题统计</h2>
          <div className="space-y-4">
            {mockAnswerStats.map((stat) => {
              const rate = Math.round((stat.correctCount / stat.totalResponses) * 100);
              return (
                <div key={stat.questionId} className="p-4 rounded-lg bg-secondary/50">
                  <p className="font-medium text-sm text-card-foreground mb-2">{stat.questionTitle}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-primary transition-all duration-700"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-sm font-display font-semibold text-primary">{rate}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.correctCount}/{stat.totalResponses} 人答对
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
