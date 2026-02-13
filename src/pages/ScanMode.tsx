import { Smartphone, Camera, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ScanMode = () => {
  const { toast } = useToast();

  const handleScan = () => {
    toast({
      title: "扫描提示",
      description: "摄像头扫描功能需要在移动设备上使用，请在手机端打开本应用",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">扫描模式</h1>
        <p className="text-muted-foreground mt-1">使用手机摄像头扫描学生卡片</p>
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 mx-auto rounded-2xl gradient-primary flex items-center justify-center shadow-elevated">
            <Camera className="w-12 h-12 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold mb-2">扫描答题卡</h2>
            <p className="text-muted-foreground">
              选择一道题目后，使用手机摄像头扫描学生手中的卡片。
              系统会自动识别卡片编号和学生选择的答案（A/B/C/D）。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="bg-card rounded-xl p-4 shadow-card">
              <Scan className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold text-sm">实时扫描</h3>
              <p className="text-xs text-muted-foreground mt-1">
                对准学生卡片即可识别答案
              </p>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-card">
              <Smartphone className="w-6 h-6 text-accent mb-2" />
              <h3 className="font-semibold text-sm">移动端适配</h3>
              <p className="text-xs text-muted-foreground mt-1">
                手机端最佳扫描体验
              </p>
            </div>
          </div>

          <Button
            onClick={handleScan}
            size="lg"
            className="gradient-primary text-primary-foreground border-0 shadow-card hover:opacity-90 px-8"
          >
            <Camera className="w-5 h-5 mr-2" />
            开始扫描
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScanMode;
