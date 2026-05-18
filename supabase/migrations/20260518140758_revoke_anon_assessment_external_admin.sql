-- PMO Autovalutazione - hardening grant RPC admin Link esterno
-- Revoca esplicitamente anon dalle RPC amministrative di assessment_external_requests.
-- Mantiene pubblica solo la RPC di submit del link esterno.

revoke all on function public.get_assessment_external_requests_admin(text, integer) from public;
revoke all on function public.get_assessment_external_requests_admin(text, integer) from anon;
grant execute on function public.get_assessment_external_requests_admin(text, integer) to authenticated;

revoke all on function public.update_assessment_external_request_admin(uuid, text, text, text, text) from public;
revoke all on function public.update_assessment_external_request_admin(uuid, text, text, text, text) from anon;
grant execute on function public.update_assessment_external_request_admin(uuid, text, text, text, text) to authenticated;

revoke all on function public.cleanup_assessment_external_requests_admin(uuid) from public;
revoke all on function public.cleanup_assessment_external_requests_admin(uuid) from anon;
grant execute on function public.cleanup_assessment_external_requests_admin(uuid) to authenticated;

revoke all on function public.submit_assessment_external_request_public(jsonb) from public;
grant execute on function public.submit_assessment_external_request_public(jsonb) to anon, authenticated;
