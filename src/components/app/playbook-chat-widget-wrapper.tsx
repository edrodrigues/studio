import { headers } from 'next/headers';
import { PlaybookChatWidget } from '@/components/app/playbook-chat-widget';

export function PlaybookChatWidgetWrapper() {
  const pathname = headers().get('x-pathname') || '';
  if (pathname.includes('/gerar-exportar')) {
    return null;
  }
  return <PlaybookChatWidget />;
}
