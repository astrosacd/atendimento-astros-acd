-- Allow non-admin authenticated users to read ONLY non-sensitive Lyra chat configuration keys
-- This keeps billing_config locked down while enabling the in-app Chat button and behavior.

CREATE POLICY "Authenticated users can read Lyra public config"
ON public.billing_config
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND config_key = ANY (
    ARRAY[
      'chat_enabled',
      'chat_name',
      'chat_welcome_message',
      'chat_placeholder',
      'chat_response_delay',
      'chat_theme_color',
      'chat_operating_hours_enabled',
      'chat_operating_hours_start',
      'chat_operating_hours_end',
      'chat_offline_message',
      'chat_quick_replies',
      'chat_ai_provider',
      'chat_ai_model',
      'chat_ai_prompt',
      'chat_role_restriction_enabled',
      'chat_role_topics',
      'chat_denial_message'
    ]
  )
);
