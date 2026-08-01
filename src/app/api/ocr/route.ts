import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureAdminApp } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD 형식의 결제일' },
    totalAmount: { type: ['number', 'null'], description: '총 결제 금액 (원)' },
    merchant: { type: ['string', 'null'], description: '상호명' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['name', 'amount'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'number', description: '추출 신뢰도 0~1' },
    categoryMatch: {
      type: 'object',
      properties: {
        matchedName: {
          type: ['string', 'null'],
          description: '아래 제공된 기존 분류 이름 목록 중 이 영수증에 가장 잘 맞는 것과 정확히 동일한 문자열. 잘 맞는 게 없으면 null.',
        },
        type: { type: 'string', enum: ['income', 'expense'] },
        suggestedName: {
          type: ['string', 'null'],
          description: 'matchedName 이 null 일 때만: 기존 목록에 없는 새 대분류(관) 이름을 2~6자 한글로 제안. matchedName 이 있으면 null.',
        },
        suggestedSubCategories: {
          type: 'array',
          items: { type: 'string' },
          description: 'suggestedName 이 있을 때 그 아래 소분류(항) 이름 1~3개 제안 (예: 품목/용도 기준). 없으면 빈 배열.',
        },
      },
      required: ['matchedName', 'type', 'suggestedName', 'suggestedSubCategories'],
      additionalProperties: false,
    },
  },
  required: ['date', 'totalAmount', 'merchant', 'items', 'confidence', 'categoryMatch'],
  additionalProperties: false,
};

function buildPrompt(categories: { name: string; type: string }[]) {
  const expenseNames = categories.filter((c) => c.type === 'expense').map((c) => c.name);
  const incomeNames = categories.filter((c) => c.type === 'income').map((c) => c.name);

  return `이 영수증 이미지에서 결제 정보를 추출해 주세요.
- date: 결제일을 YYYY-MM-DD 형식으로. 판독할 수 없으면 null.
- totalAmount: 총 결제 금액을 숫자로 (통화기호/쉼표 제외). 판독할 수 없으면 null.
- merchant: 상호명. 판독할 수 없으면 null.
- items: 개별 품목의 name 과 amount 목록. 품목이 보이지 않으면 빈 배열.
- confidence: 추출 결과 전체에 대한 신뢰도를 0~1 사이 숫자로.
추측하지 말고, 이미지에서 확인되지 않는 값은 null 로 두세요.

사용자의 기존 가계부 분류(관) 목록:
- 지출: ${expenseNames.length ? expenseNames.join(', ') : '(없음)'}
- 수입: ${incomeNames.length ? incomeNames.join(', ') : '(없음)'}

이 영수증이 지출인지 수입인지 판단하고(categoryMatch.type), 위 목록 중 이 영수증에 가장 자연스럽게 맞는 분류가 있으면 그 이름을 categoryMatch.matchedName 에 정확히 그대로 적어주세요.
목록에 적절한 분류가 전혀 없을 때만 categoryMatch.suggestedName 에 새 분류 이름을(예: "반려동물", "구독료" 등 2~6자 한글) 제안하고, suggestedSubCategories 에 그 아래 소분류 후보를 1~3개 제안하세요. 이 경우 matchedName 은 null 로 두세요.
애매하게 비슷한 분류가 있다면 새로 만들지 말고 그 분류를 matchedName 으로 선택하세요 (분류가 너무 많아지지 않도록 하는 것이 중요합니다).`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await ensureAdminApp().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (decoded.uid !== process.env.FIREBASE_USER_UID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { image, mediaType, categories } = await request.json();

    if (typeof image !== 'string' || !image) {
      return NextResponse.json({ error: 'image (base64) is required' }, { status: 400 });
    }
    if (!MEDIA_TYPES.includes(mediaType as MediaType)) {
      return NextResponse.json(
        { error: `mediaType must be one of ${MEDIA_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const categoryList: { name: string; type: string }[] = Array.isArray(categories)
      ? categories.filter(
          (c): c is { name: string; type: string } =>
            c && typeof c.name === 'string' && typeof c.type === 'string',
        )
      : [];

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as MediaType, data: image },
            },
            { type: 'text', text: buildPrompt(categoryList) },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Request was refused' }, { status: 422 });
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock) {
      return NextResponse.json({ error: 'No text returned from model' }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (e) {
    console.error('OCR failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'OCR failed' },
      { status: 500 },
    );
  }
}
