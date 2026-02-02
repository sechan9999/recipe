"""
냉장고 재료 인식 웹 애플리케이션 - Step 1, 2 & 3
Flask 백엔드 서버
"""

import os
import json
import re
import sqlite3
import hashlib
import secrets
from datetime import datetime
import urllib.request
import urllib.error
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, g
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB 제한
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
BASE_URL = "https://openrouter.ai/api/v1"
DATABASE = 'smart_recipe.db'

# 이미지 인식 모델 (우선순위)
IMAGE_MODELS = [
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
]

# 텍스트 생성 모델 (레시피용)
TEXT_MODELS = [
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "deepseek/deepseek-r1-0528:free",
]


# ===== 데이터베이스 =====

def get_db():
    """데이터베이스 연결"""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """요청 종료 시 DB 연결 해제"""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """데이터베이스 초기화"""
    db = sqlite3.connect(DATABASE)
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nickname TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            allergies TEXT DEFAULT '[]',
            dietary_restrictions TEXT DEFAULT '[]',
            preferred_cuisines TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS saved_recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            recipe_name TEXT NOT NULL,
            recipe_data TEXT NOT NULL,
            ingredients TEXT DEFAULT '[]',
            cuisine_type TEXT,
            difficulty TEXT,
            cook_time TEXT,
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            notes TEXT,
            tags TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            detected_ingredients TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    db.commit()
    db.close()


# 앱 시작 시 DB 초기화
with app.app_context():
    init_db()


def hash_password(password):
    """비밀번호 해시화"""
    return hashlib.sha256(password.encode()).hexdigest()


def login_required(f):
    """로그인 필수 데코레이터"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"success": False, "error": "로그인이 필요합니다"}), 401
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """현재 로그인한 사용자 조회"""
    if 'user_id' not in session:
        return None
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    return dict(user) if user else None


# ===== OpenRouter API =====

def call_openrouter(model, messages, timeout=60):
    """OpenRouter API 호출"""
    url = f"{BASE_URL}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}"
    }
    data = json.dumps({
        "model": model,
        "messages": messages
    }).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            return {"error": json.loads(error_body)}
        except:
            return {"error": {"message": error_body}}
    except Exception as e:
        return {"error": {"message": str(e)}}


# ===== Step 1: 이미지 분석 =====

def extract_ingredients(text):
    """텍스트에서 재료 배열 추출"""
    json_match = re.search(r'\[.*?\]', text, re.DOTALL)
    if json_match:
        try:
            ingredients = json.loads(json_match.group())
            if isinstance(ingredients, list):
                return [str(i).strip() for i in ingredients if i]
        except json.JSONDecodeError:
            pass

    lines = re.split(r'[,\n]', text)
    ingredients = []
    for line in lines:
        cleaned = re.sub(r'^[\d\.\-\*\•]+\s*', '', line.strip())
        cleaned = re.sub(r'["\'\[\]]', '', cleaned)
        if cleaned and len(cleaned) > 1 and len(cleaned) < 50:
            ingredients.append(cleaned)

    return ingredients[:30]


def analyze_image(base64_image, mime_type="image/jpeg"):
    """이미지 분석하여 재료 추출"""
    prompt = """이 냉장고/식재료 사진에서 보이는 모든 식재료를 분석해주세요.

다음 JSON 형식으로만 응답해주세요:
["재료1", "재료2", "재료3"]

예시: ["계란", "우유", "당근", "양파", "돼지고기"]

주의사항:
- 보이는 식재료만 나열
- 한글로 작성
- JSON 배열 형식만 출력"""

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_image}"
                    }
                }
            ]
        }
    ]

    for model in IMAGE_MODELS:
        result = call_openrouter(model, messages, timeout=60)
        if "error" not in result:
            content = result['choices'][0]['message']['content']
            ingredients = extract_ingredients(content)
            return {
                "success": True,
                "ingredients": ingredients,
                "model": model,
                "raw_response": content
            }
        error_code = result.get('error', {}).get('code')
        if error_code and error_code != 429:
            break

    return {
        "success": False,
        "error": result.get('error', {}).get('message', '알 수 없는 오류'),
        "ingredients": []
    }


# ===== Step 2: 레시피 생성 =====

def extract_recipe_json(text):
    """텍스트에서 레시피 JSON 추출"""
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            recipe = json.loads(json_match.group())
            return recipe
        except json.JSONDecodeError:
            pass
    return parse_recipe_text(text)


def parse_recipe_text(text):
    """텍스트를 레시피 구조로 파싱"""
    recipe = {
        "name": "추천 레시피",
        "description": "",
        "difficulty": "중급",
        "cookTime": "30분",
        "servings": 2,
        "ingredients": [],
        "steps": [],
        "tips": ""
    }

    lines = text.split('\n')
    current_section = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if '요리' in line and ('이름' in line or '명' in line):
            current_section = 'name'
        elif '재료' in line:
            current_section = 'ingredients'
        elif '순서' in line or '단계' in line or '방법' in line or '과정' in line:
            current_section = 'steps'
        elif '팁' in line or '참고' in line:
            current_section = 'tips'
        elif '설명' in line:
            current_section = 'description'
        elif current_section == 'name' and ':' in line:
            recipe['name'] = line.split(':', 1)[1].strip()
        elif current_section == 'ingredients':
            cleaned = re.sub(r'^[\d\.\-\*\•]+\s*', '', line)
            if cleaned and len(cleaned) > 1:
                recipe['ingredients'].append({
                    "name": cleaned,
                    "amount": "",
                    "available": True
                })
        elif current_section == 'steps':
            cleaned = re.sub(r'^[\d\.\-\*\•]+\s*', '', line)
            if cleaned and len(cleaned) > 5:
                recipe['steps'].append(cleaned)
        elif current_section == 'tips':
            recipe['tips'] += line + " "

    if recipe['name'] == "추천 레시피" and lines:
        first_meaningful = next((l for l in lines if len(l.strip()) > 2), None)
        if first_meaningful:
            recipe['name'] = first_meaningful.strip()[:50]

    return recipe


def generate_recipe(ingredients, cuisine, difficulty, cook_time, servings):
    """AI로 레시피 생성"""
    prompt = f"""당신은 전문 요리사입니다. 주어진 재료로 맛있는 요리 레시피를 추천해주세요.

사용 가능한 재료: {', '.join(ingredients)}
요리 종류: {cuisine}
난이도: {difficulty}
조리 시간: {cook_time}
인원: {servings}인분

반드시 다음 JSON 형식으로만 응답해주세요:
{{
  "name": "요리 이름",
  "description": "요리에 대한 간단한 설명 (1-2문장)",
  "difficulty": "{difficulty}",
  "cookTime": "{cook_time}",
  "servings": {servings},
  "ingredients": [
    {{"name": "재료명", "amount": "분량", "available": true}},
    {{"name": "추가 필요한 재료", "amount": "분량", "available": false}}
  ],
  "steps": [
    "1. 첫 번째 조리 단계",
    "2. 두 번째 조리 단계",
    "3. 세 번째 조리 단계"
  ],
  "tips": "조리 팁이나 주의사항"
}}

주의사항:
- 주어진 재료를 최대한 활용하세요
- 추가로 필요한 기본 재료(소금, 설탕, 식용유 등)는 available: false로 표시
- 단계는 구체적이고 따라하기 쉽게 작성
- 반드시 유효한 JSON 형식으로 응답"""

    messages = [
        {"role": "user", "content": prompt}
    ]

    last_error = None
    for model in TEXT_MODELS:
        result = call_openrouter(model, messages, timeout=90)
        if "error" not in result:
            content = result['choices'][0]['message']['content']
            recipe = extract_recipe_json(content)
            return {
                "success": True,
                "recipe": recipe,
                "model": model,
                "raw_response": content
            }
        last_error = result.get('error', {})
        error_code = last_error.get('code')
        if error_code and error_code != 429:
            break

    return {
        "success": False,
        "error": last_error.get('message', '알 수 없는 오류') if last_error else '알 수 없는 오류',
        "recipe": None
    }


# ===== 라우트: 페이지 =====

@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')


# ===== 라우트: Step 1 & 2 API =====

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """이미지 분석 API"""
    data = request.get_json()
    if not data or 'image' not in data:
        return jsonify({"success": False, "error": "이미지가 필요합니다"}), 400

    image_data = data['image']
    if ',' in image_data:
        header, base64_image = image_data.split(',', 1)
        mime_match = re.search(r'data:([^;]+)', header)
        mime_type = mime_match.group(1) if mime_match else 'image/jpeg'
    else:
        base64_image = image_data
        mime_type = 'image/jpeg'

    result = analyze_image(base64_image, mime_type)

    # 로그인한 사용자면 히스토리 저장
    if 'user_id' in session and result.get('success'):
        db = get_db()
        db.execute(
            'INSERT INTO analysis_history (user_id, detected_ingredients) VALUES (?, ?)',
            (session['user_id'], json.dumps(result['ingredients']))
        )
        db.commit()

    return jsonify(result)


@app.route('/api/recipe', methods=['POST'])
def recipe():
    """레시피 생성 API"""
    data = request.get_json()
    if not data or 'ingredients' not in data:
        return jsonify({"success": False, "error": "재료 목록이 필요합니다"}), 400

    ingredients = data.get('ingredients', [])
    cuisine = data.get('cuisine', '상관없음')
    difficulty = data.get('difficulty', '중급')
    cook_time = data.get('cookTime', '30분 이내')
    servings = data.get('servings', 2)

    if not ingredients:
        return jsonify({"success": False, "error": "최소 1개 이상의 재료가 필요합니다"}), 400

    result = generate_recipe(ingredients, cuisine, difficulty, cook_time, servings)
    return jsonify(result)


# ===== Step 3: 인증 API =====

@app.route('/api/auth/register', methods=['POST'])
def register():
    """회원가입"""
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    nickname = data.get('nickname', '').strip()

    if not email or not password:
        return jsonify({"success": False, "error": "이메일과 비밀번호를 입력해주세요"}), 400

    if len(password) < 6:
        return jsonify({"success": False, "error": "비밀번호는 6자 이상이어야 합니다"}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        return jsonify({"success": False, "error": "이미 등록된 이메일입니다"}), 400

    password_hash = hash_password(password)
    cursor = db.execute(
        'INSERT INTO users (email, password_hash, nickname) VALUES (?, ?, ?)',
        (email, password_hash, nickname or email.split('@')[0])
    )
    db.commit()

    user_id = cursor.lastrowid
    db.execute('INSERT INTO user_preferences (user_id) VALUES (?)', (user_id,))
    db.commit()

    session['user_id'] = user_id
    return jsonify({
        "success": True,
        "user": {"id": user_id, "email": email, "nickname": nickname or email.split('@')[0]}
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    """로그인"""
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"success": False, "error": "이메일과 비밀번호를 입력해주세요"}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if not user or user['password_hash'] != hash_password(password):
        return jsonify({"success": False, "error": "이메일 또는 비밀번호가 올바르지 않습니다"}), 401

    session['user_id'] = user['id']
    return jsonify({
        "success": True,
        "user": {"id": user['id'], "email": user['email'], "nickname": user['nickname']}
    })


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """로그아웃"""
    session.pop('user_id', None)
    return jsonify({"success": True})


@app.route('/api/auth/me', methods=['GET'])
def get_me():
    """현재 사용자 정보"""
    user = get_current_user()
    if not user:
        return jsonify({"success": False, "user": None})

    return jsonify({
        "success": True,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "nickname": user['nickname']
        }
    })


# ===== Step 3: 프로필 API =====

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    """프로필 조회"""
    user = get_current_user()
    db = get_db()
    prefs = db.execute(
        'SELECT * FROM user_preferences WHERE user_id = ?',
        (session['user_id'],)
    ).fetchone()

    return jsonify({
        "success": True,
        "profile": {
            "email": user['email'],
            "nickname": user['nickname'],
            "preferences": {
                "allergies": json.loads(prefs['allergies']) if prefs else [],
                "dietary_restrictions": json.loads(prefs['dietary_restrictions']) if prefs else [],
                "preferred_cuisines": json.loads(prefs['preferred_cuisines']) if prefs else []
            }
        }
    })


@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    """프로필 수정"""
    data = request.get_json()
    db = get_db()

    if 'nickname' in data:
        db.execute(
            'UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?',
            (data['nickname'], datetime.now(), session['user_id'])
        )

    if 'preferences' in data:
        prefs = data['preferences']
        db.execute('''
            UPDATE user_preferences SET
                allergies = ?,
                dietary_restrictions = ?,
                preferred_cuisines = ?
            WHERE user_id = ?
        ''', (
            json.dumps(prefs.get('allergies', [])),
            json.dumps(prefs.get('dietary_restrictions', [])),
            json.dumps(prefs.get('preferred_cuisines', [])),
            session['user_id']
        ))

    db.commit()
    return jsonify({"success": True})


# ===== Step 3: 레시피 저장 API =====

@app.route('/api/recipes/save', methods=['POST'])
@login_required
def save_recipe():
    """레시피 저장"""
    data = request.get_json()
    recipe_data = data.get('recipe')

    if not recipe_data:
        return jsonify({"success": False, "error": "레시피 데이터가 필요합니다"}), 400

    db = get_db()
    cursor = db.execute('''
        INSERT INTO saved_recipes
        (user_id, recipe_name, recipe_data, ingredients, cuisine_type, difficulty, cook_time, notes, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        session['user_id'],
        recipe_data.get('name', '저장된 레시피'),
        json.dumps(recipe_data),
        json.dumps(data.get('ingredients', [])),
        data.get('cuisine_type', ''),
        recipe_data.get('difficulty', ''),
        recipe_data.get('cookTime', ''),
        data.get('notes', ''),
        json.dumps(data.get('tags', []))
    ))
    db.commit()

    return jsonify({"success": True, "recipe_id": cursor.lastrowid})


@app.route('/api/recipes', methods=['GET'])
@login_required
def get_saved_recipes():
    """저장된 레시피 목록"""
    db = get_db()
    recipes = db.execute('''
        SELECT * FROM saved_recipes
        WHERE user_id = ?
        ORDER BY created_at DESC
    ''', (session['user_id'],)).fetchall()

    result = []
    for r in recipes:
        result.append({
            "id": r['id'],
            "name": r['recipe_name'],
            "recipe": json.loads(r['recipe_data']),
            "ingredients": json.loads(r['ingredients']),
            "cuisine_type": r['cuisine_type'],
            "difficulty": r['difficulty'],
            "cook_time": r['cook_time'],
            "rating": r['rating'],
            "notes": r['notes'],
            "tags": json.loads(r['tags']),
            "created_at": r['created_at']
        })

    return jsonify({"success": True, "recipes": result})


@app.route('/api/recipes/<int:recipe_id>', methods=['GET'])
@login_required
def get_recipe_detail(recipe_id):
    """레시피 상세"""
    db = get_db()
    r = db.execute(
        'SELECT * FROM saved_recipes WHERE id = ? AND user_id = ?',
        (recipe_id, session['user_id'])
    ).fetchone()

    if not r:
        return jsonify({"success": False, "error": "레시피를 찾을 수 없습니다"}), 404

    return jsonify({
        "success": True,
        "recipe": {
            "id": r['id'],
            "name": r['recipe_name'],
            "recipe": json.loads(r['recipe_data']),
            "ingredients": json.loads(r['ingredients']),
            "cuisine_type": r['cuisine_type'],
            "difficulty": r['difficulty'],
            "cook_time": r['cook_time'],
            "rating": r['rating'],
            "notes": r['notes'],
            "tags": json.loads(r['tags']),
            "created_at": r['created_at']
        }
    })


@app.route('/api/recipes/<int:recipe_id>', methods=['PUT'])
@login_required
def update_recipe(recipe_id):
    """레시피 수정 (메모, 평점)"""
    data = request.get_json()
    db = get_db()

    r = db.execute(
        'SELECT id FROM saved_recipes WHERE id = ? AND user_id = ?',
        (recipe_id, session['user_id'])
    ).fetchone()

    if not r:
        return jsonify({"success": False, "error": "레시피를 찾을 수 없습니다"}), 404

    updates = []
    params = []

    if 'rating' in data:
        updates.append('rating = ?')
        params.append(data['rating'])

    if 'notes' in data:
        updates.append('notes = ?')
        params.append(data['notes'])

    if 'tags' in data:
        updates.append('tags = ?')
        params.append(json.dumps(data['tags']))

    if updates:
        params.append(recipe_id)
        db.execute(f'UPDATE saved_recipes SET {", ".join(updates)} WHERE id = ?', params)
        db.commit()

    return jsonify({"success": True})


@app.route('/api/recipes/<int:recipe_id>', methods=['DELETE'])
@login_required
def delete_recipe(recipe_id):
    """레시피 삭제"""
    db = get_db()

    r = db.execute(
        'SELECT id FROM saved_recipes WHERE id = ? AND user_id = ?',
        (recipe_id, session['user_id'])
    ).fetchone()

    if not r:
        return jsonify({"success": False, "error": "레시피를 찾을 수 없습니다"}), 404

    db.execute('DELETE FROM saved_recipes WHERE id = ?', (recipe_id,))
    db.commit()

    return jsonify({"success": True})


# ===== Step 3: 히스토리 API =====

@app.route('/api/history/analysis', methods=['GET'])
@login_required
def get_analysis_history():
    """분석 히스토리"""
    db = get_db()
    history = db.execute('''
        SELECT * FROM analysis_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
    ''', (session['user_id'],)).fetchall()

    result = []
    for h in history:
        result.append({
            "id": h['id'],
            "ingredients": json.loads(h['detected_ingredients']),
            "created_at": h['created_at']
        })

    return jsonify({"success": True, "history": result})


@app.route('/api/history/stats', methods=['GET'])
@login_required
def get_stats():
    """통계 정보"""
    db = get_db()

    # 저장된 레시피 수
    recipe_count = db.execute(
        'SELECT COUNT(*) as count FROM saved_recipes WHERE user_id = ?',
        (session['user_id'],)
    ).fetchone()['count']

    # 분석 횟수
    analysis_count = db.execute(
        'SELECT COUNT(*) as count FROM analysis_history WHERE user_id = ?',
        (session['user_id'],)
    ).fetchone()['count']

    # 자주 사용하는 재료
    history = db.execute(
        'SELECT detected_ingredients FROM analysis_history WHERE user_id = ?',
        (session['user_id'],)
    ).fetchall()

    ingredient_counts = {}
    for h in history:
        for ing in json.loads(h['detected_ingredients']):
            ingredient_counts[ing] = ingredient_counts.get(ing, 0) + 1

    top_ingredients = sorted(ingredient_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return jsonify({
        "success": True,
        "stats": {
            "saved_recipes": recipe_count,
            "analysis_count": analysis_count,
            "top_ingredients": [{"name": k, "count": v} for k, v in top_ingredients]
        }
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
