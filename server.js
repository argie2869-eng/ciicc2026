
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

const app = express();
const db = new Database("jcash.db");

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
}

app.disable("x-powered-by");

if (isProduction) {
    app.set("trust proxy", 1);
}

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    pin TEXT,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

app.use(session({
    name: "jcash.sid",
    store: new SQLiteStore({
        db: "sessions.sqlite",
        dir: "./"
    }),
    secret: process.env.SESSION_SECRET ||
        crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 1000 * 60 * 30
    }
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10
});

const transactionLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10
});

app.use("/api/register", authLimiter);
app.use("/api/login", authLimiter);
app.use("/api/transaction", transactionLimiter);

function auth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Please log in first."
        });
    }
    next();
}

function getUser(id) {
    return db.prepare(
        "SELECT * FROM users WHERE id = ?"
    ).get(id);
}

function validAmount(value) {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0 &&
        value <= 1000000 &&
        Math.round(value * 100) === value * 100;
}

// REGISTER
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            name.trim().length < 2 ||
            name.length > 60 ||
            email.length > 254 ||
            password.length < 10 ||
            password.length > 72
        ) {
            return res.status(400).json({
                error: "Invalid registration details."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                error: "Invalid email."
            });
        }

        const hashed = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `).run(name.trim(), normalizedEmail, hashed);

        req.session.regenerate(err => {
            if (err) {
                return res.status(500).json({
                    error: "Session error."
                });
            }

            req.session.userId = Number(result.lastInsertRowid);

            res.json({
                message: "Account created!",
                needsPin: true
            });
        });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "Email already registered."
            });
        }

        res.status(500).json({
            error: "Registration failed."
        });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            error: "Enter email and password."
        });
    }

    const user = db.prepare(
        "SELECT * FROM users WHERE email = ?"
    ).get(email.trim().toLowerCase());

    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({
            error: "Incorrect email or password."
        });
    }

    req.session.regenerate(err => {
        if (err) {
            return res.status(500).json({
                error: "Login failed."
            });
        }

        req.session.userId = user.id;

        res.json({
            message: "Welcome back!",
            needsPin: !user.pin
        });
    });
});

// ACCOUNT INFORMATION
app.get("/api/me", auth, (req, res) => {
    const user = getUser(req.session.userId);

    if (!user) {
        return res.status(401).json({
            error: "Account not found."
        });
    }

    res.json({
        name: user.name,
        email: user.email,
        balance: user.balance / 100,
        needsPin: !user.pin
    });
});

// CREATE PIN
app.post("/api/setup-pin", auth, async (req, res) => {
    const { pin } = req.body;

    if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
        return res.status(400).json({
            error: "PIN must contain 6 digits."
        });
    }

    const user = getUser(req.session.userId);

    if (user.pin) {
        return res.status(409).json({
            error: "PIN already configured."
        });
    }

    const hashedPin = await bcrypt.hash(pin, 12);

    db.prepare(
        "UPDATE users SET pin = ? WHERE id = ?"
    ).run(hashedPin, user.id);

    res.json({
        message: "PIN created successfully."
    });
});

// TRANSACTIONS
app.post("/api/transaction", auth, async (req, res) => {
    try {
        const { type, amount, pin, recipient } = req.body;

        if (!["deposit", "send", "withdraw"].includes(type)) {
            return res.status(400).json({
                error: "Invalid transaction."
            });
        }

        if (!validAmount(amount)) {
            return res.status(400).json({
                error: "Invalid amount."
            });
        }

        if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
            return res.status(400).json({
                error: "Enter your 6-digit PIN."
            });
        }

        const sender = getUser(req.session.userId);

        if (!sender || !sender.pin) {
            return res.status(400).json({
                error: "Set up your PIN first."
            });
        }

        if (!await bcrypt.compare(pin, sender.pin)) {
            return res.status(401).json({
                error: "Incorrect PIN."
            });
        }

        const cents = Math.round(amount * 100);

        const execute = db.transaction(() => {
            const current = getUser(sender.id);

            if (type === "deposit") {
                db.prepare(
                    "UPDATE users SET balance = balance + ? WHERE id = ?"
                ).run(cents, current.id);

                db.prepare(`
                    INSERT INTO transactions
                    (user_id, type, amount, description)
                    VALUES (?, 'deposit', ?, 'Demo deposit')
                `).run(current.id, cents);

            } else if (type === "withdraw") {
                if (current.balance < cents) {
                    throw new Error("Insufficient balance.");
                }

                db.prepare(
                    "UPDATE users SET balance = balance - ? WHERE id = ?"
                ).run(cents, current.id);

                db.prepare(`
                    INSERT INTO transactions
                    (user_id, type, amount, description)
                    VALUES (?, 'withdraw', ?, 'Demo withdrawal')
                `).run(current.id, cents);

            } else {
                if (typeof recipient !== "string") {
                    throw new Error("Enter recipient email.");
                }

                const receiver = db.prepare(
                    "SELECT * FROM users WHERE email = ?"
                ).get(recipient.trim().toLowerCase());

                if (!receiver || receiver.id === current.id) {
                    throw new Error("Invalid recipient.");
                }

                if (current.balance < cents) {
                    throw new Error("Insufficient balance.");
                }

                db.prepare(
                    "UPDATE users SET balance = balance - ? WHERE id = ?"
                ).run(cents, current.id);

                db.prepare(
                    "UPDATE users SET balance = balance + ? WHERE id = ?"
                ).run(cents, receiver.id);

                db.prepare(`
                    INSERT INTO transactions
                    (user_id, type, amount, description)
                    VALUES (?, 'send', ?, ?)
                `).run(current.id, cents, "Sent to " + receiver.email);

                db.prepare(`
                    INSERT INTO transactions
                    (user_id, type, amount, description)
                    VALUES (?, 'receive', ?, ?)
                `).run(receiver.id, cents, "Received from " + current.email);
            }

            return getUser(current.id);
        });

        const updated = execute();

        res.json({
            message: "Transaction successful!",
            balance: updated.balance / 100
        });

    } catch (error) {
        res.status(400).json({
            error: error.message || "Transaction failed."
        });
    }
});

// TRANSACTION HISTORY
app.get("/api/transactions", auth, (req, res) => {
    const rows = db.prepare(`
        SELECT id, type, amount, description, created_at
        FROM transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
    `).all(req.session.userId);

    res.json(rows.map(row => ({
        ...row,
        amount: row.amount / 100
    })));
});

// LOGOUT
app.post("/api/logout", auth, (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("jcash.sid");
        res.json({ message: "Logged out." });
    });
});

// FRONTEND
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
    console.log("JCASH running on port " + PORT);
});
