"""
Step 3 API 테스트 스크립트 - 사용자 인증 및 레시피 저장
"""
import json
import urllib.request
import urllib.error
import sys
from http.cookiejar import CookieJar

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:5000"

# 쿠키 유지를 위한 opener
cookie_jar = CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

def api_call(method, endpoint, data=None):
    """API 호출"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if data:
        req = urllib.request.Request(url, json.dumps(data).encode('utf-8'), headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)

    try:
        with opener.open(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode('utf-8'), "status": e.code}
    except Exception as e:
        return {"error": str(e)}

print("=" * 60)
print("Step 3 API 테스트 - 사용자 인증 및 레시피 저장")
print("=" * 60)

# 1. 회원가입 테스트
print("\n[1] 회원가입 테스트")
result = api_call("POST", "/api/auth/register", {
    "email": "test@example.com",
    "password": "test123",
    "nickname": "테스트유저"
})
if result.get('success'):
    print(f"   ✓ 회원가입 성공: {result['user']['nickname']} ({result['user']['email']})")
else:
    print(f"   - {result.get('error', '회원가입 실패')}")

# 2. 로그인 테스트
print("\n[2] 로그인 테스트")
result = api_call("POST", "/api/auth/login", {
    "email": "test@example.com",
    "password": "test123"
})
if result.get('success'):
    print(f"   ✓ 로그인 성공: {result['user']['nickname']}")
else:
    print(f"   ✗ 로그인 실패: {result.get('error')}")
    sys.exit(1)

# 3. 현재 사용자 확인
print("\n[3] 현재 사용자 확인")
result = api_call("GET", "/api/auth/me")
if result.get('success') and result.get('user'):
    print(f"   ✓ 로그인 상태: {result['user']['nickname']}")
else:
    print(f"   ✗ 로그인 상태 확인 실패")

# 4. 프로필 조회
print("\n[4] 프로필 조회")
result = api_call("GET", "/api/profile")
if result.get('success'):
    print(f"   ✓ 프로필: {result['profile']['nickname']}")
    print(f"      알레르기: {result['profile']['preferences']['allergies']}")
else:
    print(f"   ✗ 프로필 조회 실패")

# 5. 프로필 수정
print("\n[5] 프로필 수정")
result = api_call("PUT", "/api/profile", {
    "nickname": "요리왕",
    "preferences": {
        "allergies": ["땅콩", "새우"],
        "dietary_restrictions": ["채식"],
        "preferred_cuisines": ["한식", "일식"]
    }
})
if result.get('success'):
    print(f"   ✓ 프로필 수정 성공")
else:
    print(f"   ✗ 프로필 수정 실패")

# 6. 레시피 저장
print("\n[6] 레시피 저장 테스트")
test_recipe = {
    "name": "토마토 아보카도 샐러드",
    "description": "신선한 채소로 만든 건강 샐러드",
    "difficulty": "초급",
    "cookTime": "15분",
    "servings": 2,
    "ingredients": [
        {"name": "토마토", "amount": "2개", "available": True},
        {"name": "아보카도", "amount": "1개", "available": True},
        {"name": "올리브오일", "amount": "2큰술", "available": False}
    ],
    "steps": [
        "토마토와 아보카도를 깍둑썰기한다",
        "올리브오일과 소금으로 간한다",
        "잘 섞어서 그릇에 담는다"
    ],
    "tips": "레몬즙을 뿌리면 더 상큼해요"
}

result = api_call("POST", "/api/recipes/save", {
    "recipe": test_recipe,
    "ingredients": ["토마토", "아보카도", "올리브오일"],
    "cuisine_type": "양식",
    "notes": "처음 만들어본 샐러드, 맛있었음!"
})
if result.get('success'):
    saved_recipe_id = result['recipe_id']
    print(f"   ✓ 레시피 저장 성공 (ID: {saved_recipe_id})")
else:
    print(f"   ✗ 레시피 저장 실패: {result.get('error')}")
    saved_recipe_id = None

# 7. 저장된 레시피 목록 조회
print("\n[7] 저장된 레시피 목록")
result = api_call("GET", "/api/recipes")
if result.get('success'):
    print(f"   ✓ 저장된 레시피: {len(result['recipes'])}개")
    for r in result['recipes']:
        print(f"      - {r['name']} ({r['difficulty']}, {r['cook_time']})")
else:
    print(f"   ✗ 목록 조회 실패")

# 8. 레시피 상세 조회
if saved_recipe_id:
    print(f"\n[8] 레시피 상세 조회 (ID: {saved_recipe_id})")
    result = api_call("GET", f"/api/recipes/{saved_recipe_id}")
    if result.get('success'):
        r = result['recipe']
        print(f"   ✓ {r['name']}")
        print(f"      메모: {r['notes']}")
    else:
        print(f"   ✗ 상세 조회 실패")

# 9. 레시피 수정 (평점 추가)
if saved_recipe_id:
    print(f"\n[9] 레시피 평점 추가")
    result = api_call("PUT", f"/api/recipes/{saved_recipe_id}", {
        "rating": 5,
        "notes": "정말 맛있었어요! 다음에 또 만들기"
    })
    if result.get('success'):
        print(f"   ✓ 평점 추가 성공")
    else:
        print(f"   ✗ 수정 실패")

# 10. 통계 조회
print("\n[10] 통계 정보")
result = api_call("GET", "/api/history/stats")
if result.get('success'):
    stats = result['stats']
    print(f"   ✓ 저장된 레시피: {stats['saved_recipes']}개")
    print(f"   ✓ 분석 횟수: {stats['analysis_count']}회")
    if stats['top_ingredients']:
        print(f"   ✓ 자주 사용하는 재료: {', '.join([i['name'] for i in stats['top_ingredients'][:5]])}")
else:
    print(f"   ✗ 통계 조회 실패")

# 11. 로그아웃
print("\n[11] 로그아웃")
result = api_call("POST", "/api/auth/logout")
if result.get('success'):
    print(f"   ✓ 로그아웃 성공")
else:
    print(f"   ✗ 로그아웃 실패")

# 12. 로그아웃 후 상태 확인
print("\n[12] 로그아웃 후 상태 확인")
result = api_call("GET", "/api/auth/me")
if not result.get('user'):
    print(f"   ✓ 로그아웃 확인됨")
else:
    print(f"   ✗ 여전히 로그인 상태")

print("\n" + "=" * 60)
print("Step 3 테스트 완료!")
print("=" * 60)
print("\n브라우저에서 http://127.0.0.1:5000 을 열어 전체 기능을 테스트하세요.")
