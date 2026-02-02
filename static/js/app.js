/**
 * Smart Recipe - 냉장고 재료 인식 앱
 * Step 1: 이미지 업로드 및 재료 인식
 * Step 2: 레시피 생성
 * Step 3: 사용자 인증 및 레시피 저장
 */

// ===== State =====
let currentImage = null;
let ingredients = [];
let currentRecipe = null;
let currentUser = null;

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    initEventListeners();
});

async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
            currentUser = data.user;
            updateUserUI();
        }
    } catch (e) {
        console.log('Not logged in');
    }
}

function updateUserUI() {
    if (currentUser) {
        $('guestMenu').style.display = 'none';
        $('loggedMenu').style.display = 'block';
        $('userName').textContent = currentUser.nickname || currentUser.email;
        $('recipeNotesSection').style.display = 'block';
    } else {
        $('guestMenu').style.display = 'block';
        $('loggedMenu').style.display = 'none';
        $('recipeNotesSection').style.display = 'none';
    }
}

function initEventListeners() {
    // Step 1: Image Upload
    $('uploadArea').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', (e) => handleFile(e.target.files[0]));

    $('uploadArea').addEventListener('dragover', (e) => {
        e.preventDefault();
        $('uploadArea').classList.add('dragover');
    });
    $('uploadArea').addEventListener('dragleave', () => {
        $('uploadArea').classList.remove('dragover');
    });
    $('uploadArea').addEventListener('drop', (e) => {
        e.preventDefault();
        $('uploadArea').classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    $('removeImage').addEventListener('click', removeImage);
    $('analyzeBtn').addEventListener('click', analyzeImage);

    // Ingredients
    $('addIngredientBtn').addEventListener('click', addIngredient);
    $('newIngredient').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIngredient();
    });

    // Step 2
    $('nextStepBtn').addEventListener('click', goToStep2);
    $('backToStep1Btn').addEventListener('click', goToStep1);
    $('generateRecipeBtn').addEventListener('click', generateRecipe);
    $('regenerateBtn').addEventListener('click', generateRecipe);
    $('saveRecipeBtn').addEventListener('click', saveRecipe);
    $('newSearchBtn').addEventListener('click', resetAll);

    // Auth Modals
    $('showLoginBtn').addEventListener('click', () => showModal('loginModal'));
    $('showRegisterBtn').addEventListener('click', () => showModal('registerModal'));
    $('closeLoginModal').addEventListener('click', () => hideModal('loginModal'));
    $('closeRegisterModal').addEventListener('click', () => hideModal('registerModal'));
    $('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('loginModal');
        showModal('registerModal');
    });
    $('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal('registerModal');
        showModal('loginModal');
    });

    $('loginForm').addEventListener('submit', handleLogin);
    $('registerForm').addEventListener('submit', handleRegister);
    $('logoutBtn').addEventListener('click', handleLogout);

    // My Recipes
    $('showMyRecipesBtn').addEventListener('click', showMyRecipes);
    $('backToMainBtn').addEventListener('click', showMainView);

    // Profile
    $('showProfileBtn').addEventListener('click', showProfile);
    $('backFromProfileBtn').addEventListener('click', showMainView);
    $('saveProfileBtn').addEventListener('click', saveProfile);

    // Recipe Detail Modal
    $('closeRecipeDetailModal').addEventListener('click', () => hideModal('recipeDetailModal'));
    $('deleteRecipeBtn').addEventListener('click', deleteCurrentRecipe);

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal.id);
        });
    });
}

// ===== Step Indicator =====
function setActiveStep(stepNumber) {
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < stepNumber) step.classList.add('completed');
        else if (index + 1 === stepNumber) step.classList.add('active');
    });
}

// ===== Step 1: Image Upload =====
function handleFile(file) {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError('JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('파일 크기는 10MB 이하여야 합니다.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImage = e.target.result;
        $('previewImage').src = currentImage;
        $('previewContainer').style.display = 'block';
        $('uploadArea').style.display = 'none';
        $('analyzeBtn').disabled = false;
        hideError();
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    currentImage = null;
    $('previewContainer').style.display = 'none';
    $('uploadArea').style.display = 'block';
    $('analyzeBtn').disabled = true;
    $('fileInput').value = '';
    $('ingredientsSection').style.display = 'none';
    ingredients = [];
}

async function analyzeImage() {
    if (!currentImage) return;

    setLoading($('analyzeBtn'), true);
    hideError();

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: currentImage }),
        });
        const data = await res.json();

        if (data.success) {
            ingredients = data.ingredients;
            renderIngredients();
            $('ingredientsSection').style.display = 'block';
            $('ingredientsSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            showError(data.error || '이미지 분석에 실패했습니다.');
        }
    } catch (e) {
        showError('서버 연결에 실패했습니다.');
    } finally {
        setLoading($('analyzeBtn'), false);
    }
}

// ===== Ingredients =====
function renderIngredients() {
    const list = $('ingredientsList');
    list.innerHTML = '';

    if (ingredients.length === 0) {
        list.innerHTML = '<p style="color: #999;">인식된 재료가 없습니다.</p>';
        return;
    }

    ingredients.forEach((ing, i) => {
        const tag = document.createElement('span');
        tag.className = 'ingredient-tag';
        tag.innerHTML = `${ing}<span class="remove" data-index="${i}">&times;</span>`;
        list.appendChild(tag);
    });

    list.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ingredients.splice(parseInt(e.target.dataset.index), 1);
            renderIngredients();
        });
    });
}

function addIngredient() {
    const value = $('newIngredient').value.trim();
    if (value && !ingredients.includes(value)) {
        ingredients.push(value);
        renderIngredients();
        $('newIngredient').value = '';
    }
}

// ===== Step Navigation =====
function goToStep2() {
    if (ingredients.length === 0) {
        showError('최소 1개 이상의 재료가 필요합니다.');
        return;
    }

    $('step1Section').style.display = 'none';
    $('ingredientsSection').style.display = 'none';
    $('recipeOptionsSection').style.display = 'block';
    $('recipeResultSection').style.display = 'none';

    renderIngredientsPreview();
    setActiveStep(2);
    $('recipeOptionsSection').scrollIntoView({ behavior: 'smooth' });
}

function goToStep1() {
    $('recipeOptionsSection').style.display = 'none';
    $('recipeResultSection').style.display = 'none';
    $('step1Section').style.display = 'block';
    $('ingredientsSection').style.display = 'block';
    setActiveStep(1);
}

function renderIngredientsPreview() {
    const preview = $('ingredientsPreview');
    preview.innerHTML = '';
    ingredients.forEach(ing => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = ing;
        preview.appendChild(tag);
    });
}

// ===== Step 2: Recipe Generation =====
async function generateRecipe() {
    if (ingredients.length === 0) {
        showError('재료가 없습니다.');
        return;
    }

    const options = {
        ingredients,
        cuisine: $('cuisineSelect').value,
        difficulty: $('difficultySelect').value,
        cookTime: $('cookTimeSelect').value,
        servings: parseInt($('servingsSelect').value)
    };

    setLoading($('generateRecipeBtn'), true);
    setLoading($('regenerateBtn'), true);
    hideError();

    try {
        const res = await fetch('/api/recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
        });
        const data = await res.json();

        if (data.success && data.recipe) {
            currentRecipe = data.recipe;
            currentRecipe._ingredients = ingredients;
            currentRecipe._cuisineType = options.cuisine;
            displayRecipe(data.recipe);
            $('recipeOptionsSection').style.display = 'none';
            $('recipeResultSection').style.display = 'block';
            setActiveStep(3);
            $('recipeResultSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            showError(data.error || '레시피 생성에 실패했습니다.');
        }
    } catch (e) {
        showError('서버 연결에 실패했습니다.');
    } finally {
        setLoading($('generateRecipeBtn'), false);
        setLoading($('regenerateBtn'), false);
    }
}

function displayRecipe(recipe) {
    $('recipeName').textContent = recipe.name || '추천 레시피';
    $('recipeDescription').textContent = recipe.description || '';
    $('recipeCookTime').textContent = recipe.cookTime || '30분';
    $('recipeDifficulty').textContent = recipe.difficulty || '중급';
    $('recipeServings').textContent = (recipe.servings || 2) + '인분';

    const ingList = $('recipeIngredients');
    ingList.innerHTML = '';
    (recipe.ingredients || []).forEach(ing => {
        const li = document.createElement('li');
        const name = typeof ing === 'string' ? ing : ing.name;
        const amount = typeof ing === 'object' ? ing.amount : '';
        const available = typeof ing === 'object' ? ing.available !== false : true;
        li.innerHTML = `<span>${name}</span><span>${amount ? `<span class="amount">${amount}</span>` : ''}${!available ? '<span class="unavailable">(추가 필요)</span>' : ''}</span>`;
        ingList.appendChild(li);
    });

    const stepsList = $('recipeSteps');
    stepsList.innerHTML = '';
    (recipe.steps || []).forEach(step => {
        const li = document.createElement('li');
        li.textContent = step.replace(/^\d+\.\s*/, '');
        stepsList.appendChild(li);
    });

    if (recipe.tips && recipe.tips.trim()) {
        $('recipeTips').textContent = recipe.tips;
        $('tipsSectionContainer').style.display = 'block';
    } else {
        $('tipsSectionContainer').style.display = 'none';
    }
}

// ===== Step 3: Save Recipe =====
async function saveRecipe() {
    if (!currentRecipe) {
        showError('저장할 레시피가 없습니다.');
        return;
    }

    if (!currentUser) {
        showError('로그인이 필요합니다.');
        showModal('loginModal');
        return;
    }

    try {
        const res = await fetch('/api/recipes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipe: currentRecipe,
                ingredients: currentRecipe._ingredients || ingredients,
                cuisine_type: currentRecipe._cuisineType || '',
                notes: $('recipeNotes')?.value || ''
            }),
        });
        const data = await res.json();

        if (data.success) {
            showSuccess('레시피가 저장되었습니다!');
            $('recipeNotes').value = '';
        } else {
            showError(data.error || '저장에 실패했습니다.');
        }
    } catch (e) {
        showError('서버 연결에 실패했습니다.');
    }
}

function resetAll() {
    currentImage = null;
    ingredients = [];
    currentRecipe = null;

    $('previewContainer').style.display = 'none';
    $('uploadArea').style.display = 'block';
    $('analyzeBtn').disabled = true;
    $('fileInput').value = '';

    $('recipeResultSection').style.display = 'none';
    $('recipeOptionsSection').style.display = 'none';
    $('ingredientsSection').style.display = 'none';
    $('step1Section').style.display = 'block';
    $('myRecipesSection').style.display = 'none';
    $('profileSection').style.display = 'none';

    setActiveStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Authentication =====
async function handleLogin(e) {
    e.preventDefault();

    const email = $('loginEmail').value;
    const password = $('loginPassword').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            updateUserUI();
            hideModal('loginModal');
            showSuccess('로그인되었습니다!');
            $('loginForm').reset();
        } else {
            showError(data.error);
        }
    } catch (e) {
        showError('로그인에 실패했습니다.');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const email = $('registerEmail').value;
    const password = $('registerPassword').value;
    const nickname = $('registerNickname').value;

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, nickname }),
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.user;
            updateUserUI();
            hideModal('registerModal');
            showSuccess('회원가입이 완료되었습니다!');
            $('registerForm').reset();
        } else {
            showError(data.error);
        }
    } catch (e) {
        showError('회원가입에 실패했습니다.');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateUserUI();
        showMainView();
        showSuccess('로그아웃되었습니다.');
    } catch (e) {
        showError('로그아웃에 실패했습니다.');
    }
}

// ===== My Recipes =====
async function showMyRecipes() {
    if (!currentUser) {
        showModal('loginModal');
        return;
    }

    hideAllSections();
    $('myRecipesSection').style.display = 'block';

    try {
        const [recipesRes, statsRes] = await Promise.all([
            fetch('/api/recipes'),
            fetch('/api/history/stats')
        ]);

        const recipesData = await recipesRes.json();
        const statsData = await statsRes.json();

        if (statsData.success) {
            $('statRecipeCount').textContent = statsData.stats.saved_recipes;
            $('statAnalysisCount').textContent = statsData.stats.analysis_count;
        }

        const grid = $('recipesGrid');
        if (recipesData.success && recipesData.recipes.length > 0) {
            grid.innerHTML = '';
            recipesData.recipes.forEach(r => {
                const item = document.createElement('div');
                item.className = 'recipe-item';
                item.dataset.id = r.id;
                item.innerHTML = `
                    <div class="recipe-item-header">
                        <span class="recipe-item-name">${r.name}</span>
                        <span class="recipe-item-date">${formatDate(r.created_at)}</span>
                    </div>
                    <div class="recipe-item-meta">
                        ${r.difficulty || ''} · ${r.cook_time || ''} · ${r.cuisine_type || ''}
                    </div>
                `;
                item.addEventListener('click', () => showRecipeDetail(r.id));
                grid.appendChild(item);
            });
        } else {
            grid.innerHTML = '<p class="empty-message">저장된 레시피가 없습니다.</p>';
        }
    } catch (e) {
        showError('레시피를 불러올 수 없습니다.');
    }
}

let currentDetailRecipeId = null;

async function showRecipeDetail(id) {
    currentDetailRecipeId = id;

    try {
        const res = await fetch(`/api/recipes/${id}`);
        const data = await res.json();

        if (data.success) {
            const r = data.recipe;
            const recipe = r.recipe;

            $('recipeDetailContent').innerHTML = `
                <h2>${r.name}</h2>
                <p>${recipe.description || ''}</p>
                <div class="recipe-meta">
                    <span class="meta-item">⏱️ ${recipe.cookTime || ''}</span>
                    <span class="meta-item">📊 ${recipe.difficulty || ''}</span>
                    <span class="meta-item">👥 ${recipe.servings || 2}인분</span>
                </div>
                <h3>재료</h3>
                <ul>${(recipe.ingredients || []).map(i => `<li>${typeof i === 'string' ? i : i.name + (i.amount ? ': ' + i.amount : '')}</li>`).join('')}</ul>
                <h3>조리 순서</h3>
                <ol>${(recipe.steps || []).map(s => `<li>${s}</li>`).join('')}</ol>
                ${recipe.tips ? `<h3>팁</h3><p>${recipe.tips}</p>` : ''}
                ${r.notes ? `<h3>메모</h3><p>${r.notes}</p>` : ''}
                <p style="color:#999;font-size:0.8rem;margin-top:15px;">저장일: ${formatDate(r.created_at)}</p>
            `;
            showModal('recipeDetailModal');
        }
    } catch (e) {
        showError('레시피를 불러올 수 없습니다.');
    }
}

async function deleteCurrentRecipe() {
    if (!currentDetailRecipeId) return;
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(`/api/recipes/${currentDetailRecipeId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            hideModal('recipeDetailModal');
            showMyRecipes();
            showSuccess('레시피가 삭제되었습니다.');
        } else {
            showError(data.error);
        }
    } catch (e) {
        showError('삭제에 실패했습니다.');
    }
}

// ===== Profile =====
async function showProfile() {
    if (!currentUser) {
        showModal('loginModal');
        return;
    }

    hideAllSections();
    $('profileSection').style.display = 'block';

    try {
        const [profileRes, statsRes] = await Promise.all([
            fetch('/api/profile'),
            fetch('/api/history/stats')
        ]);

        const profileData = await profileRes.json();
        const statsData = await statsRes.json();

        if (profileData.success) {
            const p = profileData.profile;
            $('profileNickname').value = p.nickname || '';
            $('profileAllergies').value = (p.preferences.allergies || []).join(', ');

            const dietary = $('profileDietary');
            Array.from(dietary.options).forEach(opt => {
                opt.selected = (p.preferences.dietary_restrictions || []).includes(opt.value);
            });

            const cuisines = $('profileCuisines');
            Array.from(cuisines.options).forEach(opt => {
                opt.selected = (p.preferences.preferred_cuisines || []).includes(opt.value);
            });
        }

        if (statsData.success && statsData.stats.top_ingredients.length > 0) {
            const list = $('topIngredientsList');
            list.innerHTML = '';
            statsData.stats.top_ingredients.forEach(ing => {
                const tag = document.createElement('span');
                tag.className = 'top-ing-tag';
                tag.textContent = `${ing.name} (${ing.count})`;
                list.appendChild(tag);
            });
        }
    } catch (e) {
        showError('프로필을 불러올 수 없습니다.');
    }
}

async function saveProfile() {
    const nickname = $('profileNickname').value;
    const allergies = $('profileAllergies').value.split(',').map(s => s.trim()).filter(s => s);
    const dietary = Array.from($('profileDietary').selectedOptions).map(o => o.value);
    const cuisines = Array.from($('profileCuisines').selectedOptions).map(o => o.value);

    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nickname,
                preferences: {
                    allergies,
                    dietary_restrictions: dietary,
                    preferred_cuisines: cuisines
                }
            }),
        });
        const data = await res.json();

        if (data.success) {
            currentUser.nickname = nickname;
            updateUserUI();
            showSuccess('프로필이 저장되었습니다.');
        } else {
            showError(data.error);
        }
    } catch (e) {
        showError('저장에 실패했습니다.');
    }
}

// ===== View Management =====
function hideAllSections() {
    $('step1Section').style.display = 'none';
    $('ingredientsSection').style.display = 'none';
    $('recipeOptionsSection').style.display = 'none';
    $('recipeResultSection').style.display = 'none';
    $('myRecipesSection').style.display = 'none';
    $('profileSection').style.display = 'none';
}

function showMainView() {
    hideAllSections();
    $('step1Section').style.display = 'block';
    if (ingredients.length > 0) {
        $('ingredientsSection').style.display = 'block';
    }
    setActiveStep(1);
}

// ===== Utilities =====
function showModal(id) { $(id).style.display = 'flex'; }
function hideModal(id) { $(id).style.display = 'none'; }

function setLoading(btn, loading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loading');
    if (text && loader) {
        btn.disabled = loading;
        text.style.display = loading ? 'none' : 'inline';
        loader.style.display = loading ? 'inline-flex' : 'none';
    }
}

function showError(msg) {
    $('errorText').textContent = msg;
    $('errorMessage').style.display = 'block';
    $('successMessage').style.display = 'none';
    setTimeout(() => $('errorMessage').style.display = 'none', 5000);
}

function hideError() { $('errorMessage').style.display = 'none'; }

function showSuccess(msg) {
    $('successText').textContent = msg;
    $('successMessage').style.display = 'block';
    $('errorMessage').style.display = 'none';
    setTimeout(() => $('successMessage').style.display = 'none', 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
