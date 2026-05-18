import { headers } from 'next/headers';
import { PlaybookChatWidget } from '@/components/app/playbook-chat-widget';

export async function PlaybookChatWidgetWrapper() {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  if (pathname.includes('/gerar-exportar')) {
    return null;
  }
  return <PlaybookChatWidget />;
}
