import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { 
  LayoutDashboard, Users, GraduationCap, FileQuestion, BarChart3, 
  Smartphone, CreditCard, Printer, LogOut
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/classes", icon: GraduationCap, label: "班级管理" },
  { to: "/students", icon: Users, label: "学生管理" },
  { to: "/questions", icon: FileQuestion, label: "题目管理" },
  { to: "/cards", icon: CreditCard, label: "卡片分配" },
  { to: "/print-cards", icon: Printer, label: "打印卡片" },
  { to: "/statistics", icon: BarChart3, label: "答题统计" },
  { to: "/scan", icon: Smartphone, label: "扫描模式" },
];

export function AppSidebar() {
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground min-h-screen">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-sidebar-primary-foreground">互动课堂</h1>
            <p className="text-xs text-sidebar-foreground/60">教学互动平台</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary">
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full">
          <LogOut className="w-5 h-5" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
