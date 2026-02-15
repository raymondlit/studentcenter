
-- Junction table: many-to-many between questions and classes
CREATE TABLE public.class_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class_id, question_id)
);

ALTER TABLE public.class_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own class_questions"
  ON public.class_questions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Scan sessions: one per question+class test
CREATE TABLE public.scan_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scan_sessions"
  ON public.scan_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Scan results: individual student answers
CREATE TABLE public.scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  answer INTEGER NOT NULL, -- 0=A, 1=B, 2=C, 3=D
  is_correct BOOLEAN NOT NULL DEFAULT false,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- RLS via session's user_id
CREATE POLICY "Users manage own scan_results"
  ON public.scan_results FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.scan_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.scan_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_class_questions_class ON public.class_questions(class_id);
CREATE INDEX idx_class_questions_question ON public.class_questions(question_id);
CREATE INDEX idx_scan_results_session ON public.scan_results(session_id);
CREATE INDEX idx_scan_sessions_class_question ON public.scan_sessions(class_id, question_id);
