import { mockStudents } from "@/lib/mock-data";
import { CreditCard, QrCode } from "lucide-react";

const Cards = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">卡片分配</h1>
        <p className="text-muted-foreground mt-1">
          每位学生持有唯一编号卡片（1-70），用于课堂答题扫描
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <QrCode className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">高三(1)班 - 卡片分配状态</h2>
            <p className="text-sm text-muted-foreground">共 {mockStudents.length} 名学生，已全部分配</p>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-3">
          {mockStudents.map((s) => (
            <div
              key={s.id}
              className="relative aspect-square rounded-xl bg-secondary/50 border-2 border-primary/20 hover:border-primary hover:shadow-elevated flex flex-col items-center justify-center p-1 transition-all cursor-pointer group"
            >
              <CreditCard className="w-5 h-5 text-primary mb-1 group-hover:scale-110 transition-transform" />
              <span className="font-mono text-xs font-bold text-foreground">
                #{String(s.cardNo).padStart(3, "0")}
              </span>
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cards;
