import { mockAnswerStats } from "@/lib/mock-data";
import { BarChart3, CheckCircle2, XCircle } from "lucide-react";

const optionLabels = ["A", "B", "C", "D"];

const Statistics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">答题统计</h1>
        <p className="text-muted-foreground mt-1">查看学生答题情况与数据分析</p>
      </div>

      <div className="space-y-5">
        {mockAnswerStats.map((stat, idx) => {
          const rate = Math.round((stat.correctCount / stat.totalResponses) * 100);
          const maxCount = Math.max(...stat.optionCounts);

          return (
            <div
              key={stat.questionId}
              className="bg-card rounded-xl p-6 shadow-card animate-fade-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{stat.questionTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stat.totalResponses} 人作答
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  rate >= 80 ? "bg-success/10 text-success" : rate >= 60 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                }`}>
                  {rate >= 80 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {rate}%
                </div>
              </div>

              <div className="space-y-3">
                {stat.optionCounts.map((count, oi) => {
                  const pct = Math.round((count / stat.totalResponses) * 100);
                  const isCorrect = oi === 0; // simplified
                  return (
                    <div key={oi} className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect ? "bg-success text-success-foreground" : "bg-secondary text-secondary-foreground"
                      }`}>
                        {optionLabels[oi]}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isCorrect ? "gradient-primary" : "bg-muted-foreground/20"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono w-16 text-right text-muted-foreground">
                        {count}人 ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Statistics;
