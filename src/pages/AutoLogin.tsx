import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Auto-login page: exchanges a temporary token for a session,
 * then redirects to the target path (e.g. /scan?session=xxx).
 */
const AutoLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const fallbackPath = searchParams.get("redirect") || "/";

    if (!token) {
      setError("无效的链接");
      return;
    }

    (async () => {
      try {
        // Call edge function to exchange token
        const { data, error: fnErr } = await supabase.functions.invoke(
          "exchange-token",
          { body: { token } }
        );

        if (fnErr || data?.error) {
          setError(data?.error || fnErr?.message || "令牌无效或已过期");
          return;
        }

        // Use the hashed_token to verify OTP and create session
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: "magiclink",
        });

        if (verifyErr) {
          setError("自动登录失败: " + verifyErr.message);
          return;
        }

        // Redirect to the target path
        const redirectPath = data.redirect_path || fallbackPath;
        navigate(redirectPath, { replace: true });
      } catch (e: any) {
        setError("登录失败: " + (e.message || "未知错误"));
      }
    })();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <button
            onClick={() => navigate("/auth")}
            className="text-primary hover:underline text-sm"
          >
            前往登录页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground text-sm">正在自动登录...</p>
      </div>
    </div>
  );
};

export default AutoLogin;
