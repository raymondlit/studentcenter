
CREATE TABLE public.checkin_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.checkin_records ENABLE ROW LEVEL SECURITY;

-- Teachers can view check-in records for their own classes
CREATE POLICY "Teachers view checkin records"
  ON public.checkin_records FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = checkin_records.class_id AND c.user_id = auth.uid()
  ));

-- Allow service role to insert (from edge function)
CREATE POLICY "Service role insert checkin"
  ON public.checkin_records FOR INSERT
  WITH CHECK (true);

-- Teachers can delete checkin records for their classes
CREATE POLICY "Teachers delete checkin records"
  ON public.checkin_records FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = checkin_records.class_id AND c.user_id = auth.uid()
  ));
