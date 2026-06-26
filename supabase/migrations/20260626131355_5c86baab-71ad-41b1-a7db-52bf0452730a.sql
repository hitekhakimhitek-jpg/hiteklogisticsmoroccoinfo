-- Phase C + D backfill: derive category from department, geocode country, normalize digest keys.

-- 1) Category: derive from department for every row missing it.
UPDATE public.intelligence_items
SET category = CASE
  WHEN department IN ('operations','compliance') THEN 'operational'
  WHEN department = 'finance' THEN 'financial'
  ELSE 'global'
END
WHERE category IS NULL;

-- 2) Country backfill: detect a country mentioned in headline OR summary.
WITH lookup(name, country, lat, lng) AS (
  VALUES
    ('Morocco','Morocco',31.7917,-7.0926),
    ('Moroccan','Morocco',31.7917,-7.0926),
    ('Tanger','Morocco',35.7595,-5.8340),
    ('Tangier','Morocco',35.7595,-5.8340),
    ('Casablanca','Morocco',33.5731,-7.5898),
    ('France','France',46.2276,2.2137),
    ('French','France',46.2276,2.2137),
    ('Spain','Spain',40.4637,-3.7492),
    ('Spanish','Spain',40.4637,-3.7492),
    ('Algeciras','Spain',36.1408,-5.4562),
    ('Germany','Germany',51.1657,10.4515),
    ('German','Germany',51.1657,10.4515),
    ('United Kingdom','United Kingdom',55.3781,-3.4360),
    ('British','United Kingdom',55.3781,-3.4360),
    ('UK','United Kingdom',55.3781,-3.4360),
    ('Britain','United Kingdom',55.3781,-3.4360),
    ('Belgium','Belgium',50.5039,4.4699),
    ('Belgian','Belgium',50.5039,4.4699),
    ('Antwerp','Belgium',51.2194,4.4025),
    ('Netherlands','Netherlands',52.1326,5.2913),
    ('Dutch','Netherlands',52.1326,5.2913),
    ('Rotterdam','Netherlands',51.9244,4.4777),
    ('Italy','Italy',41.8719,12.5674),
    ('Italian','Italy',41.8719,12.5674),
    ('Greece','Greece',39.0742,21.8243),
    ('Turkey','Turkey',38.9637,35.2433),
    ('Turkish','Turkey',38.9637,35.2433),
    ('China','China',35.8617,104.1954),
    ('Chinese','China',35.8617,104.1954),
    ('Shanghai','China',31.2304,121.4737),
    ('India','India',20.5937,78.9629),
    ('Indian','India',20.5937,78.9629),
    ('Pakistan','Pakistan',30.3753,69.3451),
    ('Bangladesh','Bangladesh',23.6850,90.3563),
    ('Vietnam','Vietnam',14.0583,108.2772),
    ('Singapore','Singapore',1.3521,103.8198),
    ('Indonesia','Indonesia',-0.7893,113.9213),
    ('Japan','Japan',36.2048,138.2529),
    ('Korea','South Korea',35.9078,127.7669),
    ('Australia','Australia',-25.2744,133.7751),
    ('United States','United States',39.8283,-98.5795),
    ('U.S.','United States',39.8283,-98.5795),
    (' US ','United States',39.8283,-98.5795),
    ('American','United States',39.8283,-98.5795),
    ('North America','United States',39.8283,-98.5795),
    ('Canada','Canada',56.1304,-106.3468),
    ('Mexico','Mexico',23.6345,-102.5528),
    ('Brazil','Brazil',-14.2350,-51.9253),
    ('Argentina','Argentina',-38.4161,-63.6167),
    ('Venezuela','Venezuela',6.4238,-66.5897),
    ('Chile','Chile',-35.6751,-71.5430),
    ('Russia','Russia',61.5240,105.3188),
    ('Russian','Russia',61.5240,105.3188),
    ('Ukraine','Ukraine',48.3794,31.1656),
    ('Israel','Israel',31.0461,34.8516),
    ('Iran','Iran',32.4279,53.6880),
    ('Iranian','Iran',32.4279,53.6880),
    ('Yemen','Yemen',15.5527,48.5164),
    ('Saudi','Saudi Arabia',23.8859,45.0792),
    ('Egypt','Egypt',26.8206,30.8025),
    ('Suez','Egypt',29.9668,32.5498),
    ('Algeria','Algeria',28.0339,1.6596),
    ('Tunisia','Tunisia',33.8869,9.5375),
    ('Libya','Libya',26.3351,17.2283),
    ('Senegal','Senegal',14.4974,-14.4524),
    ('Nigeria','Nigeria',9.0820,8.6753),
    ('Kenya','Kenya',-0.0236,37.9062),
    ('Ethiopia','Ethiopia',9.1450,40.4897),
    ('South Africa','South Africa',-30.5595,22.9375),
    ('Hormuz','United Arab Emirates',26.5667,56.2500),
    ('Strait of Hormuz','United Arab Emirates',26.5667,56.2500),
    ('Red Sea','Yemen',15.5527,42.0),
    ('European Union','European Union',50.8503,4.3517),
    (' EU ','European Union',50.8503,4.3517),
    ('Europe','European Union',50.8503,4.3517),
    ('Middle East','Saudi Arabia',23.8859,45.0792),
    ('Asia','China',35.8617,104.1954),
    ('Africa','Africa',1.6508,17.6791),
    ('Latin America','Brazil',-14.2350,-51.9253),
    ('Global','Global',0,0)
)
UPDATE public.intelligence_items ii
SET country = COALESCE(ii.country, m.country),
    latitude = COALESCE(ii.latitude, m.lat),
    longitude = COALESCE(ii.longitude, m.lng)
FROM (
  SELECT DISTINCT ON (i.id) i.id, l.country, l.lat, l.lng
  FROM public.intelligence_items i
  JOIN lookup l ON
    position(lower(l.name) IN lower(coalesce(i.headline,''))) > 0
    OR position(lower(l.name) IN lower(coalesce(i.summary,''))) > 0
  WHERE i.latitude IS NULL OR i.longitude IS NULL OR i.country IS NULL
  ORDER BY i.id,
    CASE WHEN position(lower(l.name) IN lower(coalesce(i.headline,''))) > 0 THEN 0 ELSE 1 END,
    length(l.name) DESC
) m
WHERE ii.id = m.id;

-- 3) Wipe old per-department weekly_digests rows so the UI (which filters by category) is consistent.
DELETE FROM public.weekly_digests
WHERE department IN ('operations','compliance','finance','commercial','it');