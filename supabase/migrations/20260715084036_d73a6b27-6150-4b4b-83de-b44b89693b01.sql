
-- 1) Instagram deletion requests: remove public read policy, expose a narrow RPC lookup by code.
DROP POLICY IF EXISTS "Public can lookup deletion status by code" ON public.instagram_data_deletion_requests;

CREATE OR REPLACE FUNCTION public.get_instagram_deletion_status(p_code text)
RETURNS TABLE(
  confirmation_code text,
  status text,
  requested_at timestamptz,
  completed_at timestamptz,
  error_message text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.confirmation_code, r.status, r.requested_at, r.completed_at, r.error_message
  FROM public.instagram_data_deletion_requests r
  WHERE r.confirmation_code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_instagram_deletion_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_instagram_deletion_status(text) TO anon, authenticated;

-- 2) chat_conversations / chat_messages: scope policies to authenticated + block anon explicitly.
DROP POLICY IF EXISTS "Users can create their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chat_conversations;

CREATE POLICY "Users can view their own conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations"
  ON public.chat_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations"
  ON public.chat_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Block anon access to chat_conversations"
  ON public.chat_conversations AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete messages from their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.chat_messages;

CREATE POLICY "Users can view messages from their conversations"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "Users can create messages in their conversations"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete messages from their conversations"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Block anon access to chat_messages"
  ON public.chat_messages AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);
