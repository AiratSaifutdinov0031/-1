const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

function showMessage(type, text, containerId = 'message-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="message ${type}">${text}</div>`;
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);
}

function updateNav() {
    const authNav = document.getElementById('auth-nav');
    const mainNav = document.querySelector('.main-nav ul');
    if (!authNav || !mainNav) return;

    if (token) {
        authNav.innerHTML = `
            <li><a href="profile.html">Профиль</a></li>
            <li><a href="#" id="logout-btn">Выход</a></li>
        `;
        if (!document.querySelector('a[href="suggestions.html"]')) {
             mainNav.innerHTML += `<li><a href="suggestions.html">Предложить</a></li>`;
        }
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.user.role === 'admin') {
                authNav.innerHTML = `
                    <li><a href="admin.html">Админ</a></li>
                    <li><a href="#" id="logout-btn">Выход</a></li>
                `;
            }
        } catch (e) { console.error("Ошибка декодирования токена", e); logout(); }
        document.getElementById('logout-btn').addEventListener('click', logout);
    } else {
        authNav.innerHTML = `
            <li><a href="login.html">Авторизация</a></li>
            <li><a href="register.html">Регистрация</a></li>
        `;
    }
}

function logout(e) {
    if (e) e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    const pageId = document.body.id;
    switch (pageId) {
        case 'home-page': loadHomePageDanetki(); break;
        case 'catalog-page': loadCatalogDanetki(); setupFilters(); break;
        case 'danetka-page': loadSingleDanetka(); break;
        case 'reviews-page': loadReviews(); setupReviewForm(); break;
        case 'suggestions-page': setupSuggestionForm(); break;
        case 'register-page': setupRegisterForm(); break;
        case 'login-page': setupLoginForm(); break;
        case 'admin-page': loadAdminSuggestions(); break;
        case 'profile-page': loadProfile(); break;
    }
});

async function loadHomePageDanetki() {
    try {
        const response = await fetch(`${API_URL}/danetki`);
        const danetki = await response.json();
        const grid = document.getElementById('danetki-grid');
        grid.innerHTML = '';
        danetki.slice(0, 3).forEach(danetka => {
            grid.innerHTML += createDanetkaCard(danetka);
        });
    } catch (error) { console.error('Ошибка загрузки данеток:', error); }
}

async function loadCatalogDanetki(category = 'all') {
    try {
        const url = category === 'all' ? `${API_URL}/danetki` : `${API_URL}/danetki?category=${category}`;
        const response = await fetch(url);
        const danetki = await response.json();
        const grid = document.getElementById('danetki-grid');
        grid.innerHTML = '';
        if (danetki.length === 0) {
            grid.innerHTML = '<p>В этой категории пока нет данеток.</p>';
        } else {
            danetki.forEach(danetka => {
                grid.innerHTML += createDanetkaCard(danetka);
            });
        }
    } catch (error) { console.error('Ошибка загрузки каталога:', error); }
}

function setupFilters() {
    const filterContainer = document.querySelector('.filter-container');
    if (!filterContainer) return;
    filterContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const category = e.target.dataset.category;
            loadCatalogDanetki(category);
        }
    });
}

function createDanetkaCard(danetka) {
    // Убираем слэш в начале, если он есть, чтобы путь стал полностью относительным
    const imagePath = danetka.image.startsWith('/') ? danetka.image.substring(1) : danetka.image;

    return `
        <div class="danetka-card">
            <img src="${imagePath}" alt="${danetka.title}" class="danetka-card__image">
            <div class="danetka-card__content">
                <h3 class="danetka-card__title">${danetka.title}</h3>
                <p class="danetka-card__text">${danetka.question.substring(0, 100)}...</p>
                <a href="danetka.html?id=${danetka._id}" class="danetka-card__button">Разгадать</a>
            </div>
        </div>
    `;
}

async function loadSingleDanetka() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) {
        window.location.href = 'catalog.html';
        return;
    }
    try {
        const response = await fetch(`${API_URL}/danetki/${id}`);
        const danetka = await response.json();
        document.getElementById('danetka-title').textContent = danetka.title;
        document.getElementById('danetka-question').textContent = danetka.question;
        document.getElementById('danetka-answer').innerHTML = `<span>Ответ:</span> ${danetka.answer}`;
        document.getElementById('show-answer-btn').addEventListener('click', () => {
            document.getElementById('danetka-answer-box').style.display = 'block';
        });
        const answerForm = document.getElementById('answer-form');
        const answerInput = document.getElementById('user-answer-input');
        answerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userAnswer = answerInput.value;
            try {
                const checkResponse = await fetch(`${API_URL}/danetki/${id}/check`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAnswer }),
                });
                const result = await checkResponse.json();
                if (result.correct) {
                    showMessage('success', 'Правильно! Отличная работа!', 'danetka-message-container');
                    document.getElementById('danetka-answer-box').style.display = 'block';
                    answerInput.disabled = true;
                    answerForm.querySelector('button').disabled = true;
                } else {
                    showMessage('error', 'Неправильно. Попробуйте подумать еще!', 'danetka-message-container');
                }
            } catch (error) {
                showMessage('error', 'Ошибка при проверке ответа.', 'danetka-message-container');
            }
        });
    } catch (error) {
        console.error('Ошибка загрузки данетки:', error);
        document.querySelector('.danetka-page-container').innerHTML = '<p>Не удалось загрузить данетку. Пожалуйста, попробуйте еще раз.</p>';
    }
}

async function loadReviews() {
    const ribbon = document.getElementById('reviews-ribbon');
    if (!ribbon) return;
    try {
        const response = await fetch(`${API_URL}/reviews`);
        const reviews = await response.json();
        ribbon.innerHTML = '';
        if (reviews.length === 0) {
            ribbon.innerHTML = '<p>Отзывов пока нет. Будьте первым!</p>';
            return;
        }
        reviews.forEach(review => {
            ribbon.innerHTML += `<div class="review-card"><p class="review-card__text">"${review.text}"</p><p class="review-card__author">- ${review.userName}</p></div>`;
        });
        setupReviewSlider(reviews.length);
    } catch (error) { console.error('Ошибка загрузки отзывов:', error); }
}

function setupReviewSlider(itemCount) {
    const ribbon = document.getElementById('reviews-ribbon');
    const prevBtn = document.getElementById('review-prev');
    const nextBtn = document.getElementById('review-next');
    if (!prevBtn || !nextBtn || itemCount <= 3) {
        if(prevBtn) prevBtn.style.display = 'none';
        if(nextBtn) nextBtn.style.display = 'none';
        return;
    }
    let currentIndex = 0;
    const cardWidth = 300 + 32;
    nextBtn.addEventListener('click', () => {
        if (currentIndex < itemCount - 3) {
            currentIndex++;
            ribbon.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        }
    });
    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            ribbon.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        }
    });
}

function setupReviewForm() {
    const form = document.getElementById('review-form');
    if (!form) return;
    if (!token) {
        form.innerHTML = '<p>Чтобы оставить отзыв, пожалуйста, <a href="login.html">войдите</a> в свой аккаунт.</p>';
        return;
    }
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('review-text').value;
        try {
            const response = await fetch(`${API_URL}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ text }),
            });
            if (response.ok) {
                showMessage('success', 'Спасибо за ваш отзыв!');
                form.reset();
                loadReviews();
            } else {
                const data = await response.json();
                showMessage('error', data.msg || 'Произошла ошибка');
            }
        } catch (error) { showMessage('error', 'Ошибка сети'); }
    });
}

function setupSuggestionForm() {
    const form = document.getElementById('suggestion-form');
    if (!form) return;
    if (!token) {
        document.querySelector('.form-container').innerHTML = '<p style="text-align:center; font-size:1.2rem;">Чтобы предложить данетку, пожалуйста, <a href="login.html" style="color: var(--accent-orange); text-decoration:underline;">войдите</a> в свой аккаунт.</p>';
        return;
    }
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const suggestion = { title: form.title.value, category: form.category.value, question: form.question.value, answer: form.answer.value };
        try {
            const response = await fetch(`${API_URL}/suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify(suggestion),
            });
            const data = await response.json();
            if (response.ok) { showMessage('success', data.msg); form.reset(); }
            else { showMessage('error', data.msg || 'Ошибка отправки'); }
        } catch (error) { showMessage('error', 'Ошибка сети'); }
    });
}

function setupRegisterForm() {
    if (token) { window.location.href = 'index.html'; return; }
    const form = document.getElementById('register-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.name.value, email = form.email.value, password = form.password.value;
        if (password.length < 6) { showMessage('error', 'Пароль должен быть не менее 6 символов'); return; }
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await response.json();
            if (response.ok) { localStorage.setItem('token', data.token); window.location.href = 'index.html'; }
            else { showMessage('error', data.msg); }
        } catch (error) { showMessage('error', 'Ошибка сети'); }
    });
}

function setupLoginForm() {
    if (token) { window.location.href = 'index.html'; return; }
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value, password = form.password.value;
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) { localStorage.setItem('token', data.token); window.location.href = 'index.html'; }
            else { showMessage('error', data.msg); }
        } catch (error) { showMessage('error', 'Ошибка сети'); }
    });
}

async function loadAdminSuggestions() {
    const container = document.getElementById('suggestions-list');
    if (!container) return;
    if (!token) { window.location.href = 'login.html'; return; }
    try {
        const response = await fetch(`${API_URL}/admin/suggestions`, { headers: { 'x-auth-token': token } });
        if (response.status === 403 || response.status === 401) { container.innerHTML = `<p>У вас нет прав для просмотра этой страницы.</p>`; return; }
        const suggestions = await response.json();
        container.innerHTML = '';
        if (suggestions.length === 0) { container.innerHTML = '<p>Новых предложений нет.</p>'; return; }
        suggestions.forEach(s => {
            container.innerHTML += `<div class="admin-suggestion" data-id="${s._id}"><h3>${s.title} <span style="font-size: 0.8rem; color: #ccc;">(от ${s.authorName})</span></h3><p><strong>Категория:</strong> ${s.category}</p><p><strong>Вопрос:</strong> ${s.question}</p><p><strong>Ответ:</strong> ${s.answer}</p><div class="admin-suggestion-controls"><button class="admin-btn btn-publish">Опубликовать</button><button class="admin-btn btn-delete">Удалить</button></div></div>`;
        });
        container.querySelectorAll('.admin-btn').forEach(btn => btn.addEventListener('click', handleAdminAction));
    } catch (error) { console.error('Ошибка загрузки предложений:', error); container.innerHTML = '<p>Ошибка загрузки данных.</p>'; }
}

async function handleAdminAction(e) {
    const suggestionDiv = e.target.closest('.admin-suggestion');
    const id = suggestionDiv.dataset.id;
    let action = e.target.classList.contains('btn-publish') ? 'publish' : (e.target.classList.contains('btn-delete') ? 'delete' : '');
    if (!action) return;
    const method = (action === 'delete') ? 'DELETE' : 'PUT';
    try {
        const response = await fetch(`${API_URL}/admin/${action}/${id}`, { method: method, headers: { 'x-auth-token': token } });
        if (response.ok) { showMessage('success', `Данетка успешно ${action === 'publish' ? 'опубликована' : 'удалена'}!`, 'admin-message-container'); suggestionDiv.remove(); }
        else { const data = await response.json(); showMessage('error', data.msg || 'Произошла ошибка', 'admin-message-container'); }
    } catch (error) { showMessage('error', 'Ошибка сети', 'admin-message-container'); }
}

async function loadProfile() {
    const container = document.getElementById('profile-container');
    if (!container) return;
    if (!token) { window.location.href = 'login.html'; return; }
    try {
        const response = await fetch(`${API_URL}/profile`, { headers: { 'x-auth-token': token } });
        if (!response.ok) { logout(); return; }
        const user = await response.json();
        container.innerHTML = `<h2>Профиль пользователя</h2><p><strong>Имя:</strong> ${user.name}</p><p><strong>Email:</strong> ${user.email}</p><p><strong>Роль:</strong> ${user.role === 'admin' ? 'Администратор' : 'Пользователь'}</p><p><strong>Отгадано данеток:</strong> ${user.solvedDanetki.length}</p>`;
    } catch (error) { console.error("Ошибка загрузки профиля:", error); container.innerHTML = '<p>Не удалось загрузить данные профиля.</p>'; }
}