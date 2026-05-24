-- Delivery staff need SELECT on sales (all statuses) for realtime sale verify/reject alerts.
DROP POLICY IF EXISTS "Employees view sales for workspace alerts" ON public.sales;
CREATE POLICY "Employees view sales for workspace alerts"
ON public.sales
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'employee'::public.app_role)
  AND deleted_at IS NULL
);
