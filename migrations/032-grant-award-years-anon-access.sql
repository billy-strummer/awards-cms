-- Grant anon role SELECT access to award_years table
-- Required for public pages (upload-documents, public-voting, etc.)
-- that need to read award information without authentication

GRANT SELECT ON public.award_years TO anon;
GRANT SELECT ON public.award_years TO authenticated;
GRANT SELECT ON public.award_years TO service_role;

-- Also grant on the awards view (alias for award_years)
GRANT SELECT ON public.awards TO anon;
GRANT SELECT ON public.awards TO authenticated;
GRANT SELECT ON public.awards TO service_role;
