-- Enable realtime for scan_results so PC presenter can sync live
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_results;