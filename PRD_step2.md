# PRD Step 2: AI 레시피 생성

## 개요
Step 1에서 인식된 재료를 기반으로 AI가 맞춤형 레시피를 생성하는 기능

## 목표
- 인식된 재료로 만들 수 있는 레시피 추천
- OpenRouter API를 통해 deepseek/deepseek-chat-v3.1:free 모델로 레시피 생성
- 상세한 조리법과 함께 레시피 제공

## 기능 요구사항

### 2.1 레시피 생성 옵션
- 요리 종류 선택 (한식, 양식, 중식, 일식, 기타)
- 난이도 선택 (초급, 중급, 고급)
- 조리 시간 선택 (15분 이내, 30분 이내, 1시간 이내, 상관없음)
- 인원 수 선택 (1인분, 2인분, 4인분 등)

### 2.2 레시피 생성
- deepseek/deepseek-chat-v3.1:free 모델 사용
- 재료 목록과 옵션을 프롬프트에 포함
- 생성 중 로딩/스트리밍 상태 표시

### 2.3 레시피 표시
- 요리 이름 및 설명
- 필요한 재료 목록 (보유 재료 / 추가 필요 재료 구분)
- 단계별 조리 방법
- 예상 조리 시간
- 영양 정보 (가능한 경우)

### 2.4 레시피 재생성
- "다른 레시피 보기" 버튼으로 새로운 레시피 요청
- 이전 레시피 히스토리 유지 (세션 내)

## 기술 스택
- API: OpenRouter API (deepseek/deepseek-chat-v3.1:free)
- 대체 모델: deepseek/deepseek-r1-0528:free (v3.1 사용 불가 시)

## API 연동 상세

### 요청 형식
```json
{
  "model": "deepseek/deepseek-chat-v3.1:free",
  "messages": [
    {
      "role": "system",
      "content": "당신은 전문 요리사입니다. 주어진 재료로 만들 수 있는 레시피를 추천해주세요."
    },
    {
      "role": "user",
      "content": "재료: [재료 목록]\n요리 종류: {cuisine}\n난이도: {difficulty}\n조리 시간: {time}\n인원: {servings}\n\n위 조건에 맞는 레시피를 JSON 형식으로 제공해주세요."
    }
  ]
}
```

### 응답 형식 (기대값)
```json
{
  "name": "요리 이름",
  "description": "요리 설명",
  "difficulty": "중급",
  "cookTime": "30분",
  "servings": 2,
  "ingredients": [
    {"name": "재료1", "amount": "100g", "available": true},
    {"name": "재료2", "amount": "1개", "available": false}
  ],
  "steps": [
    "1단계 설명",
    "2단계 설명"
  ],
  "tips": "조리 팁"
}
```

## UI/UX 요구사항
- 옵션 선택은 드롭다운 또는 버튼 그룹으로 구현
- 레시피 카드 형태로 깔끔하게 표시
- 조리 단계는 체크리스트 형태로 진행 상황 표시 가능
- 레시피 저장 버튼 제공 (Step 3 연동)

## 성공 지표
- 레시피 생성 성공률 > 90%
- 평균 레시피 생성 시간 < 20초
- 사용자 만족도 (레시피 저장 비율)

## 제약사항
- 무료 API rate limit 고려
- 모델 응답 형식이 일정하지 않을 수 있음 (파싱 로직 필요)
- 실제 모델명은 OpenRouter에서 확인 필요 (deepseek/deepseek-r1-0528:free 대체 가능)
