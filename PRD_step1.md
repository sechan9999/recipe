# PRD Step 1: 냉장고 이미지 재료 인식

## 개요
사용자가 냉장고 사진을 업로드하면 AI가 이미지에서 식재료를 자동으로 인식하는 기능

## 목표
- 사용자가 쉽게 냉장고 사진을 업로드할 수 있는 인터페이스 제공
- OpenRouter API를 통해 google/gemma-3-27b-it:free 모델로 이미지 분석
- 인식된 재료 목록을 사용자에게 표시

## 기능 요구사항

### 1.1 이미지 업로드
- 드래그 앤 드롭 또는 파일 선택으로 이미지 업로드
- 지원 형식: JPG, PNG, WebP
- 최대 파일 크기: 10MB
- 이미지 미리보기 표시

### 1.2 이미지 분석
- OpenRouter API 연동 (google/gemma-3-27b-it:free)
- 이미지를 Base64로 인코딩하여 API 전송
- 분석 중 로딩 상태 표시

### 1.3 재료 목록 표시
- 인식된 재료를 리스트 형태로 표시
- 각 재료에 대한 확신도 또는 카테고리 표시 (가능한 경우)
- 사용자가 재료를 추가/삭제/수정 가능

## 기술 스택
- Frontend: HTML, CSS, JavaScript (Vanilla 또는 React)
- Backend: Node.js 또는 Python (Flask/FastAPI)
- API: OpenRouter API

## API 연동 상세

### 요청 형식
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "이 냉장고 사진에서 보이는 모든 식재료를 JSON 배열로 나열해주세요. 형식: [\"재료1\", \"재료2\", ...]"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,{BASE64_IMAGE}"
          }
        }
      ]
    }
  ]
}
```

### 응답 처리
- JSON 파싱하여 재료 배열 추출
- 파싱 실패 시 텍스트에서 재료 추출 로직 적용

## UI/UX 요구사항
- 모바일 반응형 디자인
- 이미지 업로드 영역은 명확하게 표시
- 분석 결과는 편집 가능한 태그/칩 형태로 표시
- 다음 단계(레시피 추천)로 이동하는 버튼 제공

## 성공 지표
- 이미지 업로드 성공률 > 95%
- API 응답 시간 < 30초
- 재료 인식 정확도 (사용자 수정 비율로 측정)

## 제약사항
- 무료 API 사용으로 rate limit 존재 가능
- 대체 모델: google/gemma-3-12b-it:free (27b 모델 사용 불가 시)
