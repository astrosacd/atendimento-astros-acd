-- Update the cron job to run every 5 minutes instead of every hour
SELECT cron.unschedule('gateway-abandoned-cart-cron');

SELECT cron.schedule(
  'gateway-abandoned-cart-cron',
  '*/5 * * * *',
  'SELECT public.execute_gateway_abandoned_cart();'
);