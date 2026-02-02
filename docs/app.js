/**
 * Smart Recipe - Static Version
 * 클라이언트 사이드에서 OpenRouter API를 직접 호출
 * localStorage를 사용하여 레시피 저장
 */

// ==================== Constants ====================
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// 이미지 인식 모델 (우선순위)
const IMAGE_MODELS = [
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3-4b-it:free',
];

// 텍스트 생성 모델 (레시피용)
const TEXT_MODELS = [
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    'deepseek/deepseek-r1-0528:free',
];

// ==================== State ====================
let ingredients = [];
let currentRecipe = null;
let currentImageBase64 = null;
let currentMimeType = null;

// ==================== LocalStorage ====================
function getApiKey() {
    return localStorage.getItem('openrouter_api_key') || '';
}

function setApiKey(key) {
    localStorage.setItem('openrouter_api_key', key);
    updateApiKeyBanner();
}

function getSavedRecipes() {
    try {
        return JSON.parse(localStorage.getItem('saved_recipes') || '[]');
    } catch {
        return [];
    }
}

function saveRecipeToStorage(recipe) {
    const recipes = getSavedRecipes();
    const newRecipe = {
        id: Date.now(),
        recipe_name: recipe.name,
        recipe_data: recipe,
        ingredients: ingredients,
        cuisine_type: document.getElementById('cuisineType').value,
        difficulty: document.getElementById('difficultyLevel').value,
        cook_time: document.getElementById('cookTime').value,
        notes: document.getElementById('recipeNotes').value,
        created_at: new Date().toISOString()
    };
    recipes.unshift(newRecipe);
    localStorage.setItem('saved_recipes', JSON.stringify(recipes));
    return newRecipe;
}

function deleteRecipeFromStorage(id) {
    const recipes = getSavedRecipes().filter(r => r.id !== id);
    localStorage.setItem('saved_recipes', JSON.stringify(recipes));
}

function clearAllRecipes() {
    localStorage.setItem('saved_recipes', '[]');
}

// ==================== UI Functions ====================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateApiKeyBanner() {
    const banner = document.getElementById('apiKeyBanner');
    const apiKey = getApiKey();
    if (apiKey) {
        banner.classList.add('configured');
        banner.querySelector('.banner-text').textContent = '✅ API 키가 설정되었습니다';
        banner.querySelector('button').textContent = '변경하기';
    } else {
        banner.classList.remove('configured');
        banner.querySelector('.banner-text').textContent = 'OpenRouter API 키를 설정해주세요';
        banner.querySelector('button').textContent = '설정하기';
    }
}

function openApiKeyModal() {
    document.getElementById('apiKeyModal').style.display = 'flex';
    document.getElementById('apiKeyInput').value = getApiKey();
}

function closeApiKeyModal() {
    document.getElementById('apiKeyModal').style.display = 'none';
}

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
        setApiKey(key);
        closeApiKeyModal();
        showToast('API 키가 저장되었습니다!', 'success');
    } else {
        showToast('API 키를 입력해주세요', 'error');
    }
}

function updateStepIndicator(step) {
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step${i}-indicator`);
        indicator.classList.remove('active', 'completed');
        if (i < step) {
            indicator.classList.add('completed');
        } else if (i === step) {
            indicator.classList.add('active');
        }
    }
}

function renderIngredients() {
    const list = document.getElementById('ingredientsList');
    const preview = document.getElementById('ingredientsPreview');

    list.innerHTML = ingredients.map((ing, i) => `
        <div class="ingredient-tag">
            <span>${ing}</span>
            <span class="remove" onclick="removeIngredient(${i})">×</span>
        </div>
    `).join('');

    preview.innerHTML = ingredients.map(ing => `
        <span class="tag">${ing}</span>
    `).join('');

    // Enable/disable generate button
    const generateBtn = document.getElementById('generateRecipeBtn');
    if (generateBtn) {
        generateBtn.disabled = ingredients.length === 0;
    }
}

function removeIngredient(index) {
    ingredients.splice(index, 1);
    renderIngredients();
}

function addIngredient() {
    const input = document.getElementById('newIngredient');
    const value = input.value.trim();
    if (value && !ingredients.includes(value)) {
        ingredients.push(value);
        renderIngredients();
        input.value = '';
    }
}

function renderSavedRecipes() {
    const recipes = getSavedRecipes();
    const grid = document.getElementById('recipesGrid');
    const statsBar = document.getElementById('statsBar');
    const clearBtn = document.getElementById('clearAllBtn');

    if (recipes.length === 0) {
        grid.innerHTML = '<p class="empty-message">저장된 레시피가 없습니다.</p>';
        statsBar.style.display = 'none';
        clearBtn.style.display = 'none';
    } else {
        document.getElementById('totalRecipes').textContent = recipes.length;
        statsBar.style.display = 'flex';
        clearBtn.style.display = 'block';

        grid.innerHTML = recipes.map(r => `
            <div class="recipe-item" onclick="showRecipeDetail(${r.id})">
                <div class="recipe-item-header">
                    <span class="recipe-item-name">${r.recipe_name}</span>
                    <span class="recipe-item-date">${formatDate(r.created_at)}</span>
                </div>
                <div class="recipe-item-meta">
                    ${r.cuisine_type || ''} · ${r.difficulty || ''} · ${r.cook_time || ''}
                </div>
            </div>
        `).join('');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function showRecipeDetail(id) {
    const recipes = getSavedRecipes();
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const r = recipe.recipe_data;
    const content = document.getElementById('recipeDetailContent');

    content.innerHTML = `
        <h2>${r.name}</h2>
        <p style="color: #666; margin-bottom: 20px;">${r.description || ''}</p>
        
        <div class="recipe-meta" style="margin-bottom: 20px;">
            <div class="meta-item"><span>⏱️</span><span>${r.cookTime || recipe.cook_time}</span></div>
            <div class="meta-item"><span>📊</span><span>${r.difficulty || recipe.difficulty}</span></div>
            <div class="meta-item"><span>👥</span><span>${r.servings || '2'}인분</span></div>
        </div>
        
        <div class="recipe-section">
            <h3>📝 재료</h3>
            <ul class="recipe-ingredients">
                ${(r.ingredients || []).map(i => `
                    <li>
                        <span>${typeof i === 'string' ? i : i.name}</span>
                        <span class="amount">${typeof i === 'string' ? '' : i.amount || ''}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        
        <div class="recipe-section">
            <h3>👨‍🍳 조리 순서</h3>
            <ol class="recipe-steps">
                ${(r.steps || []).map(s => `<li>${s}</li>`).join('')}
            </ol>
        </div>
        
        ${r.tips ? `
        <div class="tips-section">
            <h3>💡 조리 팁</h3>
            <p class="recipe-tips">${r.tips}</p>
        </div>
        ` : ''}
        
        ${recipe.notes ? `
        <div style="background: #f0f0f0; padding: 15px; border-radius: 10px; margin-top: 15px;">
            <h3 style="margin-bottom: 8px;">📝 메모</h3>
            <p style="color: #666;">${recipe.notes}</p>
        </div>
        ` : ''}
        
        <p style="color: #999; font-size: 0.85rem; margin-top: 20px;">저장일: ${formatDate(recipe.created_at)}</p>
        
        <div class="recipe-actions" style="margin-top: 20px;">
            <button class="btn btn-danger" onclick="deleteRecipe(${id})">🗑️ 삭제하기</button>
            <button class="btn btn-secondary" onclick="closeRecipeDetailModal()">닫기</button>
        </div>
    `;

    document.getElementById('recipeDetailModal').style.display = 'flex';
}

function closeRecipeDetailModal() {
    document.getElementById('recipeDetailModal').style.display = 'none';
}

function deleteRecipe(id) {
    if (confirm('이 레시피를 삭제하시겠습니까?')) {
        deleteRecipeFromStorage(id);
        closeRecipeDetailModal();
        renderSavedRecipes();
        showToast('레시피가 삭제되었습니다', 'success');
    }
}

function renderRecipe(recipe) {
    document.getElementById('recipeName').textContent = recipe.name || '추천 레시피';
    document.getElementById('recipeDescription').textContent = recipe.description || '';
    document.getElementById('recipeTime').textContent = recipe.cookTime || document.getElementById('cookTime').value;
    document.getElementById('recipeDifficulty').textContent = recipe.difficulty || document.getElementById('difficultyLevel').value;
    document.getElementById('recipeServings').textContent = (recipe.servings || document.getElementById('servings').value) + '인분';

    // Ingredients
    const ingredientsList = document.getElementById('recipeIngredients');
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        ingredientsList.innerHTML = recipe.ingredients.map(i => {
            if (typeof i === 'string') {
                return `<li><span>${i}</span><span class="amount"></span></li>`;
            }
            return `
                <li>
                    <span>${i.name}${i.available === false ? ' <span class="unavailable">(추가 필요)</span>' : ''}</span>
                    <span class="amount">${i.amount || ''}</span>
                </li>
            `;
        }).join('');
    } else {
        ingredientsList.innerHTML = '<li>재료 정보가 없습니다.</li>';
    }

    // Steps
    const stepsList = document.getElementById('recipeSteps');
    if (recipe.steps && recipe.steps.length > 0) {
        stepsList.innerHTML = recipe.steps.map(s => `<li>${s}</li>`).join('');
    } else {
        stepsList.innerHTML = '<li>조리 순서 정보가 없습니다.</li>';
    }

    // Tips
    document.getElementById('recipeTips').textContent = recipe.tips || '맛있게 드세요! 🍽️';
}

// ==================== API Functions ====================
async function callOpenRouter(model, messages) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('API 키를 먼저 설정해주세요');
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'Smart Recipe'
        },
        body: JSON.stringify({
            model: model,
            messages: messages
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API 요청 실패');
    }

    return await response.json();
}

function extractIngredients(text) {
    // Try to parse JSON array
    const jsonMatch = text.match(/\[.*?\]/s);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed.map(i => String(i).trim()).filter(i => i && i.length > 1);
            }
        } catch { }
    }

    // Fallback: extract from text
    const lines = text.split(/[,\n]/);
    const result = [];
    for (const line of lines) {
        let cleaned = line.replace(/^[\d.\-*•]+\s*/, '').trim();
        cleaned = cleaned.replace(/["'\[\]]/g, '');
        if (cleaned && cleaned.length > 1 && cleaned.length < 50) {
            result.push(cleaned);
        }
    }
    return result.slice(0, 30);
}

function extractRecipeJson(text) {
    // Try to parse JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch { }
    }

    // Fallback: create basic recipe structure
    return {
        name: '추천 레시피',
        description: text.slice(0, 100),
        difficulty: document.getElementById('difficultyLevel').value,
        cookTime: document.getElementById('cookTime').value,
        servings: parseInt(document.getElementById('servings').value),
        ingredients: ingredients.map(i => ({ name: i, amount: '', available: true })),
        steps: [text],
        tips: ''
    };
}

async function analyzeImage() {
    if (!currentImageBase64) {
        showToast('이미지를 먼저 업로드해주세요', 'error');
        return;
    }

    if (!getApiKey()) {
        openApiKeyModal();
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.textContent = '분석 중...';
    spinner.style.display = 'inline-block';

    const prompt = `이 냉장고/식재료 사진에서 보이는 모든 식재료를 분석해주세요.

다음 JSON 형식으로만 응답해주세요:
["재료1", "재료2", "재료3"]

예시: ["계란", "우유", "당근", "양파", "돼지고기"]

주의사항:
- 보이는 식재료만 나열
- 한글로 작성
- JSON 배열 형식만 출력`;

    const messages = [
        {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${currentMimeType};base64,${currentImageBase64}`
                    }
                }
            ]
        }
    ];

    let lastError = null;

    for (const model of IMAGE_MODELS) {
        try {
            const result = await callOpenRouter(model, messages);
            const content = result.choices[0].message.content;
            ingredients = extractIngredients(content);

            if (ingredients.length > 0) {
                document.getElementById('ingredients-section').style.display = 'block';
                document.getElementById('step2-section').style.display = 'block';
                renderIngredients();
                updateStepIndicator(2);
                showToast(`${ingredients.length}개의 재료가 인식되었습니다!`, 'success');
                break;
            }
        } catch (err) {
            lastError = err;
            console.log(`Model ${model} failed:`, err.message);
            // Try next model
        }
    }

    if (ingredients.length === 0) {
        showToast(lastError?.message || '재료를 인식할 수 없습니다. 다시 시도해주세요.', 'error');
    }

    btn.disabled = !currentImageBase64;
    btnText.textContent = '🔍 재료 분석하기';
    spinner.style.display = 'none';
}

async function generateRecipe() {
    if (ingredients.length === 0) {
        showToast('먼저 재료를 인식해주세요', 'error');
        return;
    }

    if (!getApiKey()) {
        openApiKeyModal();
        return;
    }

    const btn = document.getElementById('generateRecipeBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.textContent = '레시피 생성 중...';
    spinner.style.display = 'inline-block';

    const cuisine = document.getElementById('cuisineType').value;
    const difficulty = document.getElementById('difficultyLevel').value;
    const cookTime = document.getElementById('cookTime').value;
    const servings = document.getElementById('servings').value;

    const prompt = `당신은 전문 요리사입니다. 주어진 재료로 맛있는 요리 레시피를 추천해주세요.

사용 가능한 재료: ${ingredients.join(', ')}
요리 종류: ${cuisine}
난이도: ${difficulty}
조리 시간: ${cookTime}
인원: ${servings}인분

반드시 다음 JSON 형식으로만 응답해주세요:
{
  "name": "요리 이름",
  "description": "요리에 대한 간단한 설명 (1-2문장)",
  "difficulty": "${difficulty}",
  "cookTime": "${cookTime}",
  "servings": ${servings},
  "ingredients": [
    {"name": "재료명", "amount": "분량", "available": true},
    {"name": "추가 필요한 재료", "amount": "분량", "available": false}
  ],
  "steps": [
    "1. 첫 번째 조리 단계",
    "2. 두 번째 조리 단계",
    "3. 세 번째 조리 단계"
  ],
  "tips": "조리 팁이나 주의사항"
}

주의사항:
- 주어진 재료를 최대한 활용하세요
- 추가로 필요한 기본 재료(소금, 설탕, 식용유 등)는 available: false로 표시
- 단계는 구체적이고 따라하기 쉽게 작성
- 반드시 유효한 JSON 형식으로 응답`;

    const messages = [
        { role: 'user', content: prompt }
    ];

    let lastError = null;

    for (const model of TEXT_MODELS) {
        try {
            const result = await callOpenRouter(model, messages);
            const content = result.choices[0].message.content;
            currentRecipe = extractRecipeJson(content);

            renderRecipe(currentRecipe);
            document.getElementById('recipe-section').style.display = 'block';
            document.getElementById('recipeNotes').value = '';
            updateStepIndicator(3);
            showToast('레시피가 생성되었습니다! 🍳', 'success');

            // Scroll to recipe
            document.getElementById('recipe-section').scrollIntoView({ behavior: 'smooth' });
            break;
        } catch (err) {
            lastError = err;
            console.log(`Model ${model} failed:`, err.message);
        }
    }

    if (!currentRecipe) {
        showToast(lastError?.message || '레시피 생성에 실패했습니다. 다시 시도해주세요.', 'error');
    }

    btn.disabled = ingredients.length === 0;
    btnText.textContent = '🍳 레시피 생성하기';
    spinner.style.display = 'none';
}

function saveCurrentRecipe() {
    if (!currentRecipe) {
        showToast('저장할 레시피가 없습니다', 'error');
        return;
    }

    saveRecipeToStorage(currentRecipe);
    renderSavedRecipes();
    showToast('레시피가 저장되었습니다! 📚', 'success');
}

function resetAll() {
    ingredients = [];
    currentRecipe = null;
    currentImageBase64 = null;
    currentMimeType = null;

    document.getElementById('previewContainer').style.display = 'none';
    document.getElementById('ingredients-section').style.display = 'none';
    document.getElementById('step2-section').style.display = 'none';
    document.getElementById('recipe-section').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('imageInput').value = '';
    document.getElementById('recipeNotes').value = '';

    updateStepIndicator(1);
}

// ==================== Event Listeners ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize
    updateApiKeyBanner();
    renderSavedRecipes();

    // Image upload
    const uploadArea = document.getElementById('uploadArea');
    const imageInput = document.getElementById('imageInput');
    const analyzeBtn = document.getElementById('analyzeBtn');

    uploadArea.addEventListener('click', () => imageInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageFile(file);
        }
    });

    function handleImageFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            showToast('파일 크기는 10MB 이하여야 합니다', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            currentMimeType = file.type;
            currentImageBase64 = dataUrl.split(',')[1];

            document.getElementById('previewImage').src = dataUrl;
            document.getElementById('previewContainer').style.display = 'block';
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    // Remove image
    document.getElementById('removeImage').addEventListener('click', () => {
        currentImageBase64 = null;
        currentMimeType = null;
        document.getElementById('previewContainer').style.display = 'none';
        document.getElementById('imageInput').value = '';
        analyzeBtn.disabled = true;
    });

    // Analyze button
    analyzeBtn.addEventListener('click', analyzeImage);

    // Add ingredient
    document.getElementById('addIngredientBtn').addEventListener('click', addIngredient);
    document.getElementById('newIngredient').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addIngredient();
        }
    });

    // Generate recipe
    document.getElementById('generateRecipeBtn').addEventListener('click', generateRecipe);

    // Regenerate recipe
    document.getElementById('regenerateBtn').addEventListener('click', generateRecipe);

    // Save recipe
    document.getElementById('saveRecipeBtn').addEventListener('click', saveCurrentRecipe);

    // New recipe (reset)
    document.getElementById('newRecipeBtn').addEventListener('click', resetAll);

    // Clear all recipes
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('저장된 모든 레시피를 삭제하시겠습니까?')) {
            clearAllRecipes();
            renderSavedRecipes();
            showToast('모든 레시피가 삭제되었습니다', 'success');
        }
    });

    // Modal close on outside click
    document.getElementById('apiKeyModal').addEventListener('click', (e) => {
        if (e.target.id === 'apiKeyModal') {
            closeApiKeyModal();
        }
    });

    document.getElementById('recipeDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'recipeDetailModal') {
            closeRecipeDetailModal();
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeApiKeyModal();
            closeRecipeDetailModal();
        }
    });
});
