INSERT INTO public.suppliers (name, type, active)
SELECT 'bestway', 'wholesaler', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.suppliers
  WHERE lower(name) = 'bestway'
);