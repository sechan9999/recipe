# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Recipe - 냉장고 사진에서 재료를 인식하고 AI가 레시피를 추천하는 웹 애플리케이션

### 주요 기능
- **Step 1**: 이미지 업로드 → Gemma 3 모델로 식재료 인식
- **Step 2**: 인식된 재료 기반 → AI 레시피 생성
- **Step 3**: 사용자 인증 및 레시피 저장/관리

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: SQLite (`smart_recipe.db`)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: OpenRouter API (Gemma 3, DeepSeek)

## Commands

```bash
# 서버 실행
python app.py

# 의존성 설치
pip install flask python-dotenv

# API 테스트
python test_step1.py  # 이미지 재료 인식 테스트
python test_step2.py  # 레시피 생성 테스트
python test_step3.py  # 사용자 인증/저장 테스트
```

## Configuration

- **OpenRouter API Key**: `.env` 파일의 `OPENROUTER_API_KEY`
- **Secret Key**: Flask 세션용 (자동 생성 또는 `.env`의 `SECRET_KEY`)

## Project Structure

```
study04/
├── app.py              # Flask 백엔드 (모든 API 엔드포인트)
├── smart_recipe.db     # SQLite 데이터베이스
├── .env                # API 키 (git 제외)
├── templates/
│   └── index.html      # 메인 SPA 페이지
└── static/
    ├── css/style.css   # 스타일
    └── js/app.js       # 프론트엔드 로직
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | 이미지 재료 인식 |
| `/api/recipe` | POST | 레시피 생성 |
| `/api/auth/register` | POST | 회원가입 |
| `/api/auth/login` | POST | 로그인 |
| `/api/auth/logout` | POST | 로그아웃 |
| `/api/recipes/save` | POST | 레시피 저장 |
| `/api/recipes` | GET | 저장된 레시피 목록 |
| `/api/recipes/<id>` | GET/PUT/DELETE | 레시피 상세/수정/삭제 |

---

## OpenRouter API 가이드라인

### 사용 모델

| 용도 | 모델 (우선순위) |
|------|----------------|
| 이미지 인식 | `google/gemma-3-27b-it:free` → `google/gemma-3-12b-it:free` → `google/gemma-3-4b-it:free` |
| 레시피 생성 | `google/gemma-3-27b-it:free` → `google/gemma-3-12b-it:free` → `deepseek/deepseek-r1-0528:free` |

### API 호출 규칙

1. **모델 자동 전환**: 첫 번째 모델이 rate limit(429) 에러 시 다음 모델로 자동 전환
2. **타임아웃**: 이미지 분석 60초, 레시피 생성 90초
3. **무료 모델 제한**: rate limit이 있으므로 연속 호출 시 지연 발생 가능

### 실행 시 API 상태 확인 필수

매번 기능을 실행할 때 다음 사항을 확인하고 보고해야 합니다:

#### 1. API 호출 성공 여부
```
✅ 성공: 사용된 모델명, 응답 시간
❌ 실패: 에러 코드, 에러 메시지
```

#### 2. 확인해야 할 에러 유형

| 에러 코드 | 원인 | 해결 방법 |
|-----------|------|-----------|
| 429 | Rate limit 초과 | 다음 모델로 전환 또는 잠시 대기 |
| 502 | 네트워크 연결 끊김 | 재시도 또는 다른 모델 사용 |
| 401 | API 키 무효 | `.env` 파일의 API 키 확인 |
| 404 | 모델 없음 | 모델명 확인 (OpenRouter에서 변경 가능) |

#### 3. 응답 품질 확인

**이미지 인식 (`/api/analyze`)**:
- 응답이 JSON 배열 형식인지 확인
- 재료가 한글로 반환되는지 확인
- 빈 배열이면 이미지 품질 문제 가능

**레시피 생성 (`/api/recipe`)**:
- 응답이 유효한 JSON 객체인지 확인
- `name`, `ingredients`, `steps` 필드 존재 여부
- 조리 단계가 구체적인지 확인

#### 4. 테스트 실행 예시

```bash
# Step 1 테스트 후 확인사항
python test_step1.py
# → 사용된 모델: google/gemma-3-12b-it:free
# → 인식된 재료 수: 10개
# → 응답 형식: JSON 배열 ✅

# Step 2 테스트 후 확인사항
python test_step2.py
# → 사용된 모델: google/gemma-3-12b-it:free
# → 레시피 이름: 토마토 아보카도 샐러드
# → 조리 단계 수: 5단계
# → JSON 파싱: 성공 ✅
```

### 문제 발생 시 보고 형식

```
🔴 API 오류 발생
- 엔드포인트: /api/analyze
- 시도한 모델: google/gemma-3-27b-it:free
- 에러 코드: 429
- 에러 메시지: Rate limit exceeded
- 조치: google/gemma-3-12b-it:free로 전환하여 재시도
- 결과: 성공 ✅
```

### 모델 가용성 확인

OpenRouter의 무료 모델은 수시로 변경될 수 있습니다. 모델이 없다는 에러(404) 발생 시:

1. https://openrouter.ai/models 에서 현재 무료 모델 목록 확인
2. `app.py`의 `IMAGE_MODELS`, `TEXT_MODELS` 배열 업데이트
3. 이미지 인식 가능한 모델은 `multimodal` 지원 필수
