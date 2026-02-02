"""
Step 2 API 테스트 스크립트 - 레시피 생성
"""
import json
import urllib.request
import urllib.error
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test_recipe_api(ingredients, cuisine="한식", difficulty="중급", cook_time="30분 이내", servings=2):
    """레시피 생성 API 테스트"""
    url = "http://127.0.0.1:5000/api/recipe"
    headers = {"Content-Type": "application/json"}
    data = json.dumps({
        "ingredients": ingredients,
        "cuisine": cuisine,
        "difficulty": difficulty,
        "cookTime": cook_time,
        "servings": servings
    }).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode('utf-8')}
    except Exception as e:
        return {"error": str(e)}

print("=" * 60)
print("Step 2 API 테스트 - 레시피 생성")
print("=" * 60)

# Step 1에서 인식된 재료 (예시)
ingredients = ["토마토", "아보카도", "오이", "당근", "브로콜리", "양파"]

print(f"\n입력 재료: {', '.join(ingredients)}")
print(f"요리 종류: 양식")
print(f"난이도: 초급")
print(f"조리 시간: 15분 이내")
print(f"인원: 2인분")

print("\nAPI 호출 중... (최대 90초 소요)")

result = test_recipe_api(
    ingredients=ingredients,
    cuisine="양식",
    difficulty="초급",
    cook_time="15분 이내",
    servings=2
)

print("\n" + "=" * 60)
print("레시피 생성 결과")
print("=" * 60)

if result.get('success'):
    print(f"사용된 모델: {result.get('model', 'unknown')}")

    recipe = result.get('recipe', {})
    print(f"\n📍 요리 이름: {recipe.get('name', 'N/A')}")
    print(f"📝 설명: {recipe.get('description', 'N/A')}")
    print(f"⏱️  조리 시간: {recipe.get('cookTime', 'N/A')}")
    print(f"📊 난이도: {recipe.get('difficulty', 'N/A')}")
    print(f"👥 인원: {recipe.get('servings', 'N/A')}인분")

    print(f"\n🥗 재료:")
    for ing in recipe.get('ingredients', []):
        if isinstance(ing, dict):
            status = "✓" if ing.get('available', True) else "✗ (추가 필요)"
            print(f"   - {ing.get('name', 'N/A')}: {ing.get('amount', '')} {status}")
        else:
            print(f"   - {ing}")

    print(f"\n👨‍🍳 조리 순서:")
    for i, step in enumerate(recipe.get('steps', []), 1):
        print(f"   {i}. {step}")

    if recipe.get('tips'):
        print(f"\n💡 조리 팁: {recipe.get('tips')}")

else:
    print(f"오류: {result.get('error', 'unknown error')}")

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)
