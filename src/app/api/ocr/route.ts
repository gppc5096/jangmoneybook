import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureAdminApp } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  return `당신은 한국 소매점 영수증을 판독하는 OCR 전문가입니다. 아래 영수증 이미지에서 결제 정보를 최대한 정확히 추출해 주세요.

## 이미지 조건에 대한 주의사항
- 사진이 90도/180도 회전되어 있거나 기울어져 있을 수 있습니다. 방향과 무관하게 내용을 읽어내세요.
- 화질이 낮거나 흐릿해도 최선을 다해 판독하고, 그 불확실성은 추측 대신 confidence 수치를 낮추는 것으로 반영하세요.
- 영수증 위에 볼펜으로 쓴 손글씨, 동그라미, 밑줄, 도장 등 인쇄되지 않은 표시가 있을 수 있습니다. 이런 필기 메모는 전부 무시하고 인쇄된 영수증 원본 내용만 추출 대상으로 삼으세요. 손글씨가 있다는 이유로 분석을 거부하지 마세요.
- 상품명 아래/옆에 있는 바코드·상품코드 숫자열(예: 8801xxxxxxxxxx)은 상품명에 포함하지 마세요.

## 필드별 추출 규칙
- date: 결제일. 영수증에 "2026-07-20", "26.07.20", "2026/07/20" 등 다양한 표기가 있을 수 있으며, 반드시 YYYY-MM-DD 형식으로 정규화하세요. 판독할 수 없으면 null.
- merchant: 상호명(매장명). 영수증 상단 로고/제목이나 하단 사업자 정보에서 찾으세요. 판독할 수 없으면 null.
- items: 개별 품목 목록. 한국 영수증은 보통 "상품명 / 단가 / 수량 / 금액" 형태의 표 구조입니다.
  - name: 상품명 (바코드 번호 제외)
  - amount: 반드시 그 줄의 "금액"(단가 × 수량 = 그 줄의 합계) 을 사용하세요. "단가"(수량 1개당 가격)를 넣지 마세요. 수량이 2 이상이면 금액은 단가보다 큽니다.
  - 소계/부가세/합계/과세/면세 등 요약 행은 items 에 포함하지 말고, 개별 상품 행만 포함하세요.
  - 품목이 전혀 안 보이면 빈 배열.
- totalAmount: 이 영수증으로 실제 결제한 총액. "합계", "총액", "결제금액", "받을금액" 같은 라벨이 붙은 최종 금액을 사용하세요. "소계"(부가세 전 금액)는 totalAmount 가 아닙니다 — 소계와 합계가 다르면 반드시 합계 쪽을 선택하세요. 판독할 수 없으면 null.
- confidence: 추출 결과 전체에 대한 신뢰도를 0~1 사이 숫자로. 글자가 흐리거나 잘려서 일부를 확신하지 못하면 0.5~0.7 정도로, 명확하게 다 읽었으면 0.9 이상으로 표기하세요.

추측하지 말고, 이미지에서 끝내 확인되지 않는 값만 null 로 두세요.

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
      max_tokens: 4096,
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
      return NextResponse.json({ error: '영수증 이미지 분석이 거부되었습니다.' }, { status: 422 });
    }
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: '영수증 품목이 너무 많아 응답이 잘렸습니다. 직접 입력해 주세요.' },
        { status: 502 },
      );
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock) {
      return NextResponse.json({ error: '모델이 텍스트 응답을 반환하지 않았습니다.' }, { status: 502 });
    }

    try {
      return NextResponse.json(JSON.parse(textBlock.text));
    } catch (parseError) {
      console.error('OCR JSON parse failed. Raw text:', textBlock.text);
      throw parseError;
    }
  } catch (e) {
    console.error('OCR failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '영수증 분석 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
