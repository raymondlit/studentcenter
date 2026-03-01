import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { 
  LayoutDashboard, Users, GraduationCap, FileQuestion, 
  BarChart3, Smartphone, CreditCard, Printer, Menu, X, Monitor
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/classes", icon: GraduationCap, label: "班级管理" },
  { to: "/students", icon: Users, label: "学生管理" },
  { to: "/questions", icon: FileQuestion, label: "题目管理" },
  { to: "/cards", icon: CreditCard, label: "卡片分配" },
  { to: "/print-cards", icon: Printer, label: "打印卡片" },
  { to: "/statistics", icon: BarChart3, label: "答题统计" },
  { to: "/present", icon: Monitor, label: "PC 展示" },
  { to: "/scan", icon: Smartphone, label: "手机扫描" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">互动课堂</span>
        </div>
        <button onClick={() => setOpen(!open)} className="p-2">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {open && (
        <nav className="bg-sidebar p-4 space-y-1 border-t border-sidebar-border">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent text-sidebar-primary"
              onClick={() => setOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
