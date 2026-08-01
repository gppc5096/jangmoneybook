import { NextResponse } from 'next/server';
import { ensureAdminApp } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const auth = ensureAdminApp();
    const uid = process.env.FIREBASE_USER_UID!;
    const token = await auth.createCustomToken(uid);
    return NextResponse.json({ token });
  } catch (e) {
    console.error('createCustomToken failed:', e);
    return NextResponse.json(
      { error: 'Failed to mint custom token' },
      { status: 500 },
    );
  }
}
