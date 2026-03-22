import { NextResponse } from 'next/server';
import { handleGetAlexFeedback } from '@/lib/actions';

export async function GET() {
  try {
    const result = await handleGetAlexFeedback();
    
    if (result.success) {
      return NextResponse.json({ feedbacks: result.data }, { status: 200 });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
