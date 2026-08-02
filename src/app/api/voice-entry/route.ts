import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureAdminApp } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TRANSCRIPT_MAX_LENGTH = 1000;

const VOICE_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    date: {
      type: ['string', 'null'],
      description: 'YYYY-MM-DD 형식의 거래일. 발화에 날짜 단서가 전혀 없으면 null',
    },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemName: { type: 'string', description: '발화된 항목명 원문' },
          amount: { type: 'number', description: '원 단위 정수 금액' },
          categoryMatch: {
            type: 'object',
            properties: {
              matchedName: {
                type: ['string', 'null'],
                description: '아래 제공된 기존 분류 이름 목록 중 이 항목에 가장 잘 맞는 것과 정확히 동일한 문자열. 잘 맞는 게 없으면 null.',
              },
              type: { type: 'string', enum: ['income', 'expense'] },
              suggestedName: {
                type: ['string', 'null'],
                description: 'matchedName 이 null 일 때만: 기존 목록에 없는 새 대분류(관) 이름을 2~6자 한글로 제안. matchedName 이 있으면 null.',
              },
              suggestedSubCategories: {
                type: 'array',
                items: { type: 'string' },
                description: 'suggestedName 이 있을 때 그 아래 소분류(항) 이름 1~3개 제안. 없으면 빈 배열.',
              },
            },
            required: ['matchedName', 'type', 'suggestedName', 'suggestedSubCategories'],
            additionalProperties: false,
          },
          confidence: { type: 'number', description: '이 항목 하나에 대한 추출 신뢰도 0~1' },
        },
        required: ['itemName', 'amount', 'categoryMatch', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['date', 'entries'],
  additionalProperties: false,
};

/** 서버는 UTC 로 동작하므로 "오늘/어제" 해석 기준일은 KST 로 계산한다. */
function todayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildPrompt(transcript: string, categories: { name: string; type: string }[]) {
  const expenseNames = categories.filter((c) => c.type === 'expense').map((c) => c.name);
  const incomeNames = categories.filter((c) => c.type === 'income').map((c) => c.name);

  return `당신은 한국어 구어체 발화를 가계부 거래 데이터로 변환하는 전문가입니다. 아래는 사용자가 음성으로 말한 내용을 브라우저 음성 인식이 받아쓴 원문입니다.

## 받아쓰기 원문
"""
${transcript}
"""

## 입력 조건에 대한 주의사항
- 음성 인식 결과라 오탈자, 띄어쓰기 오류, 조사 누락이 섞여 있을 수 있습니다. 문맥으로 자연스럽게 보정해서 읽어내세요.
- 날짜, 수입/지출 구분, 항목명, 금액이 어떤 순서로 언급되든 정확히 추출하세요. 말한 순서에 의존해 위치로 파싱하지 마세요.
- 같은 뜻을 나타내는 구어 표현은 매우 다양합니다("오늘은 ~", "오늘 날짜는 ~", "수입 항목에는 ~", "지출로 ~" 등). 표현을 하나하나 대조하지 말고 의미로 판단하세요.
- 한 번의 발화에 여러 건의 거래가 섞여 있을 수 있습니다. 거래 한 건당 entries 원소 하나로 분리하세요.
- 인사말, "어", "그", "음" 같은 군말, 거래와 무관한 잡담은 무시하세요.

## 필드별 추출 규칙
- date: 발화에서 언급된 거래일을 YYYY-MM-DD 로 정규화하세요. "오늘", "어제", "그제", "지난 금요일" 같은 상대 표현은 아래 기준일로 계산하세요. 날짜 단서가 전혀 없으면 null.
- entries[].itemName: 사용자가 말한 항목 이름을 그대로 적으세요 (예: "국민연금", "주유비", "장보기").
- entries[].amount: 원 단위 정수. 브라우저가 이미 아라비아 숫자로 받아쓴 표기와 한글 수 표기가 섞여 들어올 수 있으므로 둘 다 처리하세요.
  - 변환 예: "사십오만원"/"45만원" → 450000, "2만3천원" → 23000, "3천3백원" → 3300, "십만 오천원" → 105000, "백이십만원" → 1200000, "45만 5천" → 455000, "천원" → 1000.
  - "만", "천", "백" 같은 단위를 빠뜨리지 말고 자릿수를 정확히 맞추세요. 금액을 확신할 수 없으면 그 항목의 confidence 를 낮추세요.
- entries[].confidence: 그 항목 하나에 대한 신뢰도를 0~1 사이 숫자로. 금액이나 수입/지출 구분을 확신하기 어려우면 0.5~0.7, 발화가 명확하면 0.9 이상으로 표기하세요.

추측으로 항목을 만들어내지 마세요. 거래로 볼 만한 내용이 전혀 없으면 entries 를 빈 배열로 두세요.

기준일(오늘): ${todayKST()}

사용자의 기존 가계부 분류(관) 목록:
- 지출: ${expenseNames.length ? expenseNames.join(', ') : '(없음)'}
- 수입: ${incomeNames.length ? incomeNames.join(', ') : '(없음)'}

각 항목마다 수입인지 지출인지 판단하고(categoryMatch.type), 위 목록 중 그 항목에 가장 자연스럽게 맞는 분류가 있으면 그 이름을 categoryMatch.matchedName 에 정확히 그대로 적어주세요.
목록에 적절한 분류가 전혀 없을 때만 categoryMatch.suggestedName 에 새 분류 이름을(예: "반려동물", "구독료" 등 2~6자 한글) 제안하고, suggestedSubCategories 에 그 아래 소분류 후보를 1~3개 제안하세요. 이 경우 matchedName 은 null 로 두세요.
애매하게 비슷한 분류가 있다면 새로 만들지 말고 그 분류를 matchedName 으로 선택하세요 (분류가 너무 많아지지 않도록 하는 것이 중요합니다).
발화에 수입/지출 구분이 명시되지 않았다면 항목명으로 미루어 판단하고(예: "국민연금"·"배당금"은 수입, "주유비"·"장보기"는 지출), 이렇게 유추한 항목은 confidence 를 낮게 설정하세요.`;
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

    const { transcript, categories } = await request.json();

    if (typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }
    if (transcript.length > TRANSCRIPT_MAX_LENGTH) {
      return NextResponse.json(
        { error: '음성이 너무 깁니다. 나눠서 말해 주세요.' },
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
      output_config: { format: { type: 'json_schema', schema: VOICE_ENTRY_SCHEMA } },
      messages: [
        { role: 'user', content: buildPrompt(transcript.trim(), categoryList) },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: '음성 내용 분석이 거부되었습니다.' }, { status: 422 });
    }
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: '말씀하신 항목이 너무 많아 응답이 잘렸습니다. 나눠서 말해 주세요.' },
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
      console.error('Voice entry JSON parse failed. Raw text:', textBlock.text);
      throw parseError;
    }
  } catch (e) {
    console.error('Voice entry failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '음성 분석 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
