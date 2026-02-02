# PRD Step 3: 사용자 프로필 및 레시피 저장

## 개요
사용자 계정을 통해 생성된 레시피를 저장하고 관리하는 기능

## 목표
- 사용자 회원가입/로그인 시스템 구축
- 레시피 저장 및 즐겨찾기 기능
- 저장된 레시피 조회 및 관리

## 기능 요구사항

### 3.1 사용자 인증
- 회원가입 (이메일, 비밀번호)
- 로그인/로그아웃
- 비밀번호 재설정
- 소셜 로그인 (Google, Kakao) - 선택사항

### 3.2 사용자 프로필
- 프로필 정보 (닉네임, 프로필 이미지)
- 식단 선호도 설정
  - 알레르기 정보 (견과류, 유제품, 해산물 등)
  - 식이 제한 (채식, 비건, 할랄 등)
  - 선호하는 요리 종류
- 프로필 수정 기능

### 3.3 레시피 저장
- Step 2에서 생성된 레시피 저장
- 레시피에 메모 추가 기능
- 별점/평가 기능
- 카테고리/태그 분류

### 3.4 저장된 레시피 관리
- 저장된 레시피 목록 조회
- 검색 및 필터링 (카테고리, 재료, 조리시간)
- 레시피 삭제
- 레시피 공유 (링크 생성)

### 3.5 히스토리
- 최근 분석한 냉장고 이미지 기록
- 최근 생성한 레시피 기록
- 자주 사용하는 재료 통계

## 기술 스택
- Database: PostgreSQL (MCP 서버 활용)
- Authentication: JWT 또는 세션 기반
- Storage: 로컬 또는 클라우드 (이미지 저장용)

## 데이터베이스 스키마

### users 테이블
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  profile_image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_preferences 테이블
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  allergies TEXT[], -- 알레르기 목록
  dietary_restrictions TEXT[], -- 식이 제한
  preferred_cuisines TEXT[], -- 선호 요리 종류
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### saved_recipes 테이블
```sql
CREATE TABLE saved_recipes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipe_name VARCHAR(255) NOT NULL,
  recipe_data JSONB NOT NULL, -- 전체 레시피 정보
  ingredients TEXT[], -- 사용된 재료
  cuisine_type VARCHAR(50),
  difficulty VARCHAR(20),
  cook_time INTEGER, -- 분 단위
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### analysis_history 테이블
```sql
CREATE TABLE analysis_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  image_url VARCHAR(500),
  detected_ingredients TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `POST /api/auth/reset-password` - 비밀번호 재설정

### 프로필
- `GET /api/profile` - 프로필 조회
- `PUT /api/profile` - 프로필 수정
- `GET /api/profile/preferences` - 선호도 조회
- `PUT /api/profile/preferences` - 선호도 수정

### 레시피
- `POST /api/recipes` - 레시피 저장
- `GET /api/recipes` - 저장된 레시피 목록
- `GET /api/recipes/:id` - 레시피 상세
- `PUT /api/recipes/:id` - 레시피 수정 (메모, 평점)
- `DELETE /api/recipes/:id` - 레시피 삭제

### 히스토리
- `GET /api/history/analysis` - 분석 기록
- `GET /api/history/ingredients` - 자주 사용하는 재료

## UI/UX 요구사항
- 로그인/회원가입 모달 또는 페이지
- 프로필 페이지 (설정 포함)
- 저장된 레시피 갤러리/리스트 뷰
- 레시피 상세 페이지
- 반응형 디자인 (모바일 우선)

## 성공 지표
- 회원가입 전환율
- 레시피 저장 비율
- 재방문율
- 평균 저장 레시피 수

## 보안 요구사항
- 비밀번호 해시화 (bcrypt)
- JWT 토큰 만료 설정
- HTTPS 필수
- SQL Injection 방지
- XSS 방지

## 향후 확장 가능성
- 레시피 공유 커뮤니티
- 장보기 목록 자동 생성
- 주간 식단 플래너
- 레시피 알림 (저장한 재료 기반)
