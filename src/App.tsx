import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import Students from "./pages/Students";
import Questions from "./pages/Questions";
import Cards from "./pages/Cards";
import Statistics from "./pages/Statistics";
import ScanMode from "./pages/ScanMode";
import PresentMode from "./pages/PresentMode";
import Papers from "./pages/Papers";

import SessionDetail from "./pages/SessionDetail";
import PaperReport from "./pages/PaperReport";
import StudentReport from "./pages/StudentReport";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/students" element={<Students />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/scan" element={<ScanMode />} />
        <Route path="/present" element={<PresentMode />} />
        <Route path="/papers" element={<Papers />} />
        <Route path="/session/:sessionId" element={<SessionDetail />} />
        <Route path="/paper-report/:paperId" element={<PaperReport />} />
        <Route path="/student-report/:studentId" element={<StudentReport />} />
        
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
