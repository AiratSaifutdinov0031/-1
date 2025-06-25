// Импорт зависимостей
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

// Инициализация Express приложения
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Переменные из .env файла
const mongoUri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;
const port = process.env.PORT || 3000;

// Подключение к MongoDB
let db;
MongoClient.connect('mongodb+srv://admin:admin123@cluster0.fgn4jvw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',)
    .then(client => {
        console.log('MongoDB connected');
        db = client.db();
        seedDatabase();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Middlewares для аутентификации
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Нет токена, авторизация отклонена' });
    try {
        req.user = jwt.verify(token, jwtSecret).user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Токен недействителен' });
    }
};
const adminAuth = async (req, res, next) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
        if (user && user.role === 'admin') next();
        else res.status(403).json({ msg: 'Доступ запрещен. Требуются права администратора.' });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
};

// --- МАРШРУТЫ API ---

// Регистрация
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) return res.status(400).json({ msg: 'Пожалуйста, заполните все поля' });
        let user = await db.collection('users').findOne({ email });
        if (user) return res.status(400).json({ msg: 'Пользователь с таким email уже существует' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = { name, email, password: hashedPassword, role: 'user', solvedDanetki: [] };
        const result = await db.collection('users').insertOne(newUser);
        const payload = { user: { id: result.insertedId, role: 'user' } };
        jwt.sign(payload, jwtSecret, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) return res.status(400).json({ msg: 'Пожалуйста, заполните все поля' });
        const user = await db.collection('users').findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Неверные учетные данные' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Неверные учетные данные' });
        const payload = { user: { id: user._id.toString(), role: user.role } };
        jwt.sign(payload, jwtSecret, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Профиль
app.get('/api/profile', auth, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { password: 0 } });
        res.json(user);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Получение всех данеток
app.get('/api/danetki', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = { status: 'published' };
        if (category && category !== 'all') filter.category = category;
        const danetki = await db.collection('danetki').find(filter).toArray();
        res.json(danetki);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Получение одной данетки
app.get('/api/danetki/:id', async (req, res) => {
    try {
        const danetka = await db.collection('danetki').findOne({ _id: new ObjectId(req.params.id) });
        if (!danetka) return res.status(404).json({ msg: 'Данетка не найдена' });
        res.json(danetka);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Проверка ответа данетки
app.post('/api/danetki/:id/check', async (req, res) => {
    try {
        const { userAnswer } = req.body;
        if (!userAnswer) return res.status(400).json({ msg: 'Ответ не может быть пустым' });
        const danetka = await db.collection('danetki').findOne({ _id: new ObjectId(req.params.id) });
        if (!danetka || !danetka.keywords) return res.status(404).json({ msg: 'Загадка или ключевые слова не найдены' });
        const normalizedUserAnswer = userAnswer.toLowerCase();
        const isCorrect = danetka.keywords.every(keyword => normalizedUserAnswer.includes(keyword));
        res.json({ correct: isCorrect });
    } catch (err) {
        res.status(500).send('Ошибка сервера при проверке ответа');
    }
});

// Получение отзывов
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await db.collection('reviews').find().sort({ createdAt: -1 }).toArray();
        res.json(reviews);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Добавление отзыва
app.post('/api/reviews', auth, async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
        const newReview = { userId: new ObjectId(req.user.id), userName: user.name, text: req.body.text, createdAt: new Date() };
        await db.collection('reviews').insertOne(newReview);
        res.json(newReview);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Добавление предложения
app.post('/api/suggestions', auth, async (req, res) => {
    try {
        const { title, category, question, answer } = req.body;
        const user = await db.collection('users').findOne({_id: new ObjectId(req.user.id)});
        const newSuggestion = { title, category, question, answer, image: "images/1.png", status: 'pending', keywords: [], authorId: new ObjectId(req.user.id), authorName: user.name, createdAt: new Date() };
        await db.collection('danetki').insertOne(newSuggestion);
        res.json({ msg: 'Ваше предложение отправлено на модерацию!' });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// --- АДМИНСКИЕ МАРШРУТЫ ---

// Получение предложений
app.get('/api/admin/suggestions', auth, adminAuth, async (req, res) => {
    try {
        const suggestions = await db.collection('danetki').find({ status: 'pending' }).toArray();
        res.json(suggestions);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Публикация
app.put('/api/admin/publish/:id', auth, adminAuth, async (req, res) => {
    try {
        const result = await db.collection('danetki').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: 'published' } });
        res.json(result);
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Удаление
app.delete('/api/admin/delete/:id', auth, adminAuth, async (req, res) => {
    try {
        await db.collection('danetki').deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ msg: 'Данетка удалена' });
    } catch (err) {
        res.status(500).send('Ошибка сервера');
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// --- Функция для начального заполнения БД ---
async function seedDatabase() {
    const danetkiCollection = db.collection('danetki');
    const usersCollection = db.collection('users');
    const count = await danetkiCollection.countDocuments();
    if (count === 0) {
        console.log('No danetki found, seeding database...');
        const danetkiToInsert = [
            { title: "Прыжок", category: "Легкие", question: "Человек выпрыгнул из самолета без парашюта. Но остался жив.", answer: "Самолет стоял на земле.", image: "/images/1.png", status: "published", keywords: ["самолет", "земле"] },
            { title: "Сладких снов", category: "Легкие", question: "Матвей продолжает читать историю перед сном своему сыну несмотря на отсутствие света.", answer: "Матвей слеп и обычно читает на ночь своему сыну книжки с шрифтом Брайля.", image: "images/1.png", status: "published", keywords: ["слеп", "брайля"] },
            { title: "Не та рука", category: "Сложные", question: "Человек получает посылку, в которой лежит отрубленная рука и записка «это не та рука». Что произошло?", answer: "Несколько лет назад человек потерпел кораблекрушение и оказался на необитаемом острове с другим бедолагой...", image: "images/1.png", status: "published", keywords: ["кораблекрушение", "острове", "руку"] },
            { title: "Библиотека", category: "Детские", question: "Женщина зашла в библиотеку, достала книгу и заплакала.", answer: "Женщина была писателем и подарила библиотеке одну из своих книг... Она заплакала, потому что поняла, что никто не прочитал ее книгу.", image: "images/1.png", status: "published", keywords: ["писателем", "книгу", "никто", "прочитал"] },
            { title: "Экзамен", category: "Короткие", question: "Экзамен в военном училище... покидает экзамен с отличной оценкой.", answer: "Экзамен по азбуке Морзе. Преподаватель стучал ручкой по столу и дал сообщение...", image: "images/1.png", status: "published", keywords: ["морзе", "стучал"] },
            { title: "Нашествие котов", category: "Смешные", question: "Один человек уехал в отпуск и попросил друга присмотреть за котом. Через неделю в квартире бегали уже 8 взрослых котов.", answer: "На следующий день кот убежал, и другу пришлось дать объявление о пропаже.", image: "images/1.png", status: "published", keywords: ["убежал", "объявление", "похожих"] }
        ];
        await danetkiCollection.insertMany(danetkiToInsert);
        console.log('Danetki seeded.');
    }
    const admin = await usersCollection.findOne({ email: 'admin@danetki.local' });
    if (!admin) {
        console.log('Admin user not found, creating one...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        await usersCollection.insertOne({ name: 'Администратор', email: 'admin@danetki.local', password: hashedPassword, role: 'admin', solvedDanetki: [] });
        console.log('Admin user created. Email: admin@danetki.local, Password: admin123');
    }
}