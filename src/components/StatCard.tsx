import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "primary" | "accent" | "success";
}

const variantStyles = {
  default: "bg-card shadow-card",
  primary: "gradient-primary text-primary-foreground",
  accent: "gradient-accent text-accent-foreground",
  success: "bg-success text-success-foreground",
};

export function StatCard({ title, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  const isPrimary = variant !== "default";

  return (
    <div className={`rounded-xl p-6 ${variantStyles[variant]} animate-fade-in`}>
      <div className="flex items-center justify-between mb-4">
        <p className={`text-sm font-medium ${isPrimary ? "opacity-80" : "text-muted-foreground"}`}>
          {title}
        </p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isPrimary ? "bg-white/20" : "bg-secondary"
        }`}>
          <Icon className={`w-5 h-5 ${isPrimary ? "" : "text-primary"}`} />
        </div>
      </div>
      <p className="text-3xl font-display font-bold animate-count-up">{value}</p>
      {description && (
        <p className={`text-sm mt-1 ${isPrimary ? "opacity-70" : "text-muted-foreground"}`}>
          {description}
        </p>
      )}
    </div>
  );
}
