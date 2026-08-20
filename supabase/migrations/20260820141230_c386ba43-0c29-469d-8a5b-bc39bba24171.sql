UPDATE public.intelligence_items
SET severity = 'this_week'
WHERE department = 'it'
  AND severity = 'act_now'
  AND NOT (
    (coalesce(headline,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(impact,'')) ~* '(microsoft teams|onedrive|sharepoint|outlook|exchange online|microsoft 365|office 365|m365|windows|cargowise|sap|portnet|badr)'
    AND (coalesce(headline,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(impact,'')) ~* '(outage|down|offline|unavailable|disruption|migration|end of life|end of support|major update|breaking change|deprecat)'
    AND (coalesce(headline,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(impact,'')) !~* '(hack|breach|ransomware|malware|phish|vulnerab|cve|exploit|flaw|zero-day|leak)'
  );