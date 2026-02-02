---
description: 코드 버그 분석 보고서 - docs/app.js 리뷰 결과
---

# 📝 Code Review Report

## 📊 Summary
| 항목 | 값 |
|------|-----|
| **리뷰 파일** | `docs/app.js` |
| **리뷰 일시** | 2026-02-01 |
| **총 라인 수** | 709 lines |
| **총 이슈 수** | 🔴 P1: 2개, 🟠 P2: 4개, 🟡 P3: 5개, 🔵 P4: 4개 |
| **상태** | ✅ P1 이슈 수정 완료 |

---

## 🔴 Critical Issues (P1) - ✅ 수정 완료

### Issue #1: XSS (Cross-Site Scripting) 취약점 ✅ FIXED
- **파일**: `docs/app.js:135-144, 183-193, 211-260`
- **문제**: `innerHTML`에 사용자 입력 또는 API 응답 데이터를 직접 삽입하여 XSS 공격에 취약
- **영향**: 악의적인 사용자가 레시피 이름에 `<script>alert('XSS')</script>` 같은 코드를 주입할 수 있음
- **해결**: `escapeHtml()` 유틸리티 함수 추가 및 모든 동적 콘텐츠에 적용

```javascript
// 추가된 보안 유틸리티 함수
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
```

### Issue #2: API 키 보안 취약점 ✅ FIXED
- **파일**: `docs/app.js:31-38`
- **문제**: API 키가 `localStorage`에 평문으로 저장되어 XSS 공격 시 탈취 가능
- **영향**: API 키가 노출되면 공격자가 사용자의 API 크레딧을 소진할 수 있음
- **해결**: `sessionStorage`로 변경 (브라우저 닫으면 자동 삭제)

```javascript
function getApiKey() {
    // sessionStorage 사용 - 브라우저 닫으면 자동 삭제되어 더 안전
    return sessionStorage.getItem('openrouter_api_key') || '';
}
```

---

## 🟠 Major Issues (P2)

### Issue #3: API 응답 처리 시 Null 참조 가능성
- **파일**: `docs/app.js:442, 535`
- **문제**: `result.choices[0].message.content` 접근 시 `choices`가 없거나 빈 배열일 경우 에러 발생
- **해결책**:

```javascript
const content = result?.choices?.[0]?.message?.content;
if (!content) {
    throw new Error('API 응답이 올바르지 않습니다');
}
```

### Issue #4: JSON 파싱 에러 미처리
- **파일**: `docs/app.js:337`
- **문제**: `response.json()` 실패 시 에러 처리 없음
- **해결책**:

```javascript
if (!response.ok) {
    let errorMessage = 'API 요청 실패';
    try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
    } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
    }
    throw new Error(errorMessage);
}
```

### Issue #5: 레시피 ID 충돌 가능성
- **파일**: `docs/app.js:51`
- **문제**: `Date.now()`를 ID로 사용하면 같은 밀리초에 여러 번 저장 시 ID 충돌
- **해결책**:

```javascript
id: Date.now().toString(36) + Math.random().toString(36).substr(2),
```

### Issue #6: FileReader 에러 핸들링 누락
- **파일**: `docs/app.js:634-644`
- **문제**: `reader.onerror` 핸들러가 없어 파일 읽기 실패 시 피드백 없음
- **해결책**:

```javascript
reader.onerror = () => {
    showToast('파일을 읽을 수 없습니다', 'error');
};
```

---

## 🟡 Minor Issues (P3)

### Issue #7: 전역 변수 사용
- **파일**: `docs/app.js:25-28`
- **문제**: `ingredients`, `currentRecipe` 등이 전역 스코프에 노출됨
- **해결책**: IIFE 또는 모듈 패턴으로 캡슐화

### Issue #8: 매직 넘버 사용
- **파일**: `docs/app.js:80, 629, 366`
- **문제**: `3000`, `10 * 1024 * 1024`, `30` 등 하드코딩된 값
- **해결책**: 상수로 분리

```javascript
const CONFIG = {
    TOAST_DURATION_MS: 3000,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    MAX_INGREDIENTS_COUNT: 30,
};
```

### Issue #9: console.log 프로덕션 코드에 존재
- **파일**: `docs/app.js:455, 549`
- **문제**: 디버깅용 `console.log`가 남아있음
- **해결책**: 제거하거나 커스텀 로거 사용

### Issue #10: innerHTML 효율성
- **파일**: 여러 곳
- **문제**: 대량 DOM 업데이트 시 `innerHTML` 반복 사용은 비효율적
- **해결책**: DocumentFragment 사용

### Issue #11: 이벤트 리스너 중복 등록 가능성
- **파일**: `docs/app.js:591-707`
- **문제**: 모듈 재로드 시 이벤트 리스너 중복 등록 가능
- **해결책**: named function으로 등록 후 제거 관리

---

## 🔵 Suggestions (P4)

### Suggestion #1: 병렬 API 호출
- **현재**: 모델 순차 호출
- **제안**: `Promise.allSettled`로 병렬 호출 후 첫 성공 사용

### Suggestion #2: 디바운스 적용
- **파일**: `docs/app.js:661-665`
- **제안**: 재료 추가 시 Enter 키 연타 방지

### Suggestion #3: AbortController 도입
- **제안**: 새 분석 시작 전 이전 요청 취소 기능 추가

### Suggestion #4: 상태 관리 통합
- **제안**: 로딩 상태 통합 관리 패턴 도입

---

## ✅ 잘 작성된 부분

1. **명확한 코드 구조**: 섹션별로 주석으로 구분되어 있어 가독성 우수
2. **에러 처리 기본 구현**: try-catch 적절히 사용
3. **Fallback 전략**: 여러 AI 모델을 순차적으로 시도하는 안정적 설계
4. **사용자 피드백**: Toast 알림으로 모든 액션에 피드백 제공
5. **반응형 UI 로직**: 상태에 따른 버튼 활성화/비활성화 처리
6. **JSON 파싱 폴백**: 정규식으로 부분 JSON도 추출 시도

---

## 📈 개선 권장사항 (우선순위)

1. ~~**보안 강화** (P1): XSS 방지 함수 적용~~ ✅ 완료
2. ~~**API 키 보안** (P1): sessionStorage로 변경~~ ✅ 완료
3. **P2 이슈 수정**: API 응답 null 체크, 에러 핸들링 강화
4. **TypeScript 전환**: 타입 안정성 확보
5. **테스트 추가**: 핵심 함수에 대한 단위 테스트 작성

---

## 📋 수정 이력

| 날짜 | 수정 내용 | 수정자 |
|------|----------|--------|
| 2026-02-01 | P1 이슈 2건 수정 (XSS 방지, API 키 보안) | Code Reviewer Agent |
