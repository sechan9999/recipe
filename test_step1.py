"""
Step 1 API 테스트 스크립트
"""
import json
import urllib.request
import base64
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 테스트용 이미지 URL (Unsplash - 무료 이미지)
TEST_IMAGE_URL = "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400"

def download_and_encode_image(url):
    """이미지 다운로드 후 Base64 인코딩"""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        image_data = response.read()
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return f"data:image/jpeg;base64,{base64_data}"

def test_analyze_api(image_data):
    """분석 API 테스트"""
    url = "http://127.0.0.1:5000/api/analyze"
    headers = {"Content-Type": "application/json"}
    data = json.dumps({"image": image_data}).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode('utf-8')}
    except Exception as e:
        return {"error": str(e)}

print("=" * 60)
print("Step 1 API 테스트 - 재료 인식")
print("=" * 60)

print(f"\n테스트 이미지: 야채/샐러드 이미지")
print(f"URL: {TEST_IMAGE_URL}")
print("\n이미지 다운로드 중...")

try:
    image_data = download_and_encode_image(TEST_IMAGE_URL)
    print(f"이미지 다운로드 완료: {len(image_data)} bytes (Base64)")

    print("\nAPI 호출 중... (최대 60초 소요)")
    result = test_analyze_api(image_data)

    print("\n" + "=" * 60)
    print("분석 결과")
    print("=" * 60)

    if result.get('success'):
        print(f"사용된 모델: {result.get('model', 'unknown')}")
        print(f"\n인식된 재료 ({len(result['ingredients'])}개):")
        for i, ingredient in enumerate(result['ingredients'], 1):
            print(f"  {i}. {ingredient}")

        print(f"\n원본 응답:")
        print(result.get('raw_response', '')[:500])
    else:
        print(f"오류: {result.get('error', 'unknown error')}")

except Exception as e:
    print(f"테스트 실패: {e}")

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)
