CREATE FUNCTION public.storage_household_id(_path text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$ BEGIN RETURN split_part(_path,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.storage_household_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_household_id(text) TO authenticated, service_role;
CREATE POLICY casa_documents_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='documents' AND public.is_member(public.storage_household_id(name)));
CREATE POLICY casa_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='documents' AND public.can_write(public.storage_household_id(name)));
CREATE POLICY casa_documents_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='documents' AND public.can_write(public.storage_household_id(name))) WITH CHECK (bucket_id='documents' AND public.can_write(public.storage_household_id(name)));
CREATE POLICY casa_documents_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='documents' AND public.can_write(public.storage_household_id(name)));