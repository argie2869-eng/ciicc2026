const app = document.getElementById("app");

let currentUser = null;
let currentAction = "";

// API CONNECTION
async function api(url, method = "GET", data) {
    const response = await fetch("/api" + url, {
        method,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: data ? JSON.stringify(data) : undefined
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Something went wrong.");
    }

    return result;
}

// SAFE HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// CURRENCY
function money(value) {
    return Number(value).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP"
    });
}

// ERROR MESSAGE
function showError(message) {
    const error = document.getElementById("error");

    if (error) {
        error.textContent = message;
    } else {
        alert(message);
    }
}

// START APPLICATION
async function init() {
    try {
        currentUser = await api("/me");

        if (currentUser.needsPin) {
            showPinSetup();
        } else {
            showDashboard();
        }
    } catch {
        showLogin();
    }
}

// LOGIN PAGE
function showLogin() {
    app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">

        <div class="logo">JCASH.</div>
        <p>Your money, your control.</p>

        <h2>Welcome Back</h2>

        <form id="loginForm">

          <input id="email"
            type="email"
            placeholder="Email address"
            required>

          <input id="password"
            type="password"
            placeholder="Password"
            required>

          <button class="primary">
            Login to JCASH
          </button>

        </form>

        <div class="error" id="error"></div>

        <button class="link" onclick="showRegister()">
          Create a new account
        </button>

      </div>
    </div>`;

    document.getElementById("loginForm")
        .addEventListener("submit", login);
}

// REGISTER PAGE
function showRegister() {
    app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">

        <div class="logo">JCASH.</div>

        <h2>Create Account</h2>

        <p>Join the JCASH banking experience.</p>

        <form id="registerForm">

          <input id="name"
            placeholder="Full name"
            maxlength="60"
            required>

          <input id="email"
            type="email"
            placeholder="Email address"
            required>

          <input id="password"
            type="password"
            placeholder="Password (minimum 10 characters)"
            minlength="10"
            required>

          <button class="primary">
            Create Account
          </button>

        </form>

        <div class="error" id="error"></div>

        <button class="link" onclick="showLogin()">
          Already have an account? Login
        </button>

      </div>
    </div>`;

    document.getElementById("registerForm")
        .addEventListener("submit", register);
}

// REGISTER
async function register(event) {
    event.preventDefault();

    try {
        await api("/register", "POST", {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        });

        currentUser = await api("/me");

        showPinSetup();

    } catch (error) {
        showError(error.message);
    }
}

// LOGIN
async function login(event) {
    event.preventDefault();

    try {
        const result = await api("/login", "POST", {
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
        });

        currentUser = await api("/me");

        if (result.needsPin) {
            showPinSetup();
        } else {
            showDashboard();
        }

    } catch (error) {
        showError(error.message);
    }
}

// PIN SETUP
function showPinSetup() {
    app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">

        <div class="logo">JCASH.</div>

        <h2>Create Transaction PIN</h2>

        <p>
          Create a 6-digit PIN to authorize
          your demo transactions.
        </p>

        <form id="pinForm">

          <input id="pin"
            type="password"
            inputmode="numeric"
            maxlength="6"
            pattern="[0-9]{6}"
            placeholder="Enter 6-digit PIN"
            required>

          <button class="primary">
            Save PIN
          </button>

        </form>

        <div id="error" class="error"></div>

      </div>
    </div>`;

    document.getElementById("pinForm")
        .addEventListener("submit", setupPin);
}

// SAVE PIN
async function setupPin(event) {
    event.preventDefault();

    try {
        const pin = document.getElementById("pin").value;

        await api("/setup-pin", "POST", { pin });

        showDashboard();

    } catch (error) {
        showError(error.message);
    }
}

// DASHBOARD
async function showDashboard() {
    try {
        currentUser = await api("/me");

        const transactions = await api("/transactions");

        app.innerHTML = `
        <header>

          <div class="logo">JCASH.</div>

          <button class="logout" onclick="logout()">
            Logout
          </button>

        </header>

        <div class="container">

          <div class="welcome">
            <h2>
              Hello, ${escapeHTML(currentUser.name)} 👋
            </h2>

            <p>Welcome to your JCASH dashboard.</p>
          </div>

          <div class="balance-card">

            <p>Total Account Balance</p>

            <div class="balance">
              ${money(currentUser.balance)}
            </div>

            <p>JCASH DIGITAL ACCOUNT</p>

            <div class="account-number">
              •••• •••• •••• JCASH
            </div>

          </div>

          <div class="actions">

            <button class="action"
              onclick="openTransaction('deposit')">
              <span>📥</span>
              Deposit
            </button>

            <button class="action"
              onclick="openTransaction('send')">
              <span>📤</span>
              Send Money
            </button>

            <button class="action"
              onclick="openTransaction('withdraw')">
              <span>💸</span>
              Withdraw
            </button>

          </div>

          <div class="panel">

            <h3>Recent Transactions</h3>

            <div id="history">
              ${renderTransactions(transactions)}
            </div>

          </div>

          <p class="note">
            JCASH DEMO: All balances and transfers
            are simulated. No real money is moved.
          </p>

        </div>

        <div class="modal" id="modal">

          <div class="modal-box">

            <h2 id="modalTitle">Transaction</h2>

            <form id="transactionForm">

              <div id="recipientField"
                style="display:none">

                <input id="recipient"
                  type="email"
                  placeholder="Recipient's JCASH email">

              </div>

              <input id="amount"
                type="number"
                placeholder="Amount in PHP"
                min="0.01"
                max="1000000"
                step="0.01"
                required>

              <input id="transactionPin"
                type="password"
                placeholder="6-digit transaction PIN"
                inputmode="numeric"
                maxlength="6"
                pattern="[0-9]{6}"
                required>

              <button class="primary">
                Confirm Transaction
              </button>

            </form>

            <div class="error" id="error"></div>

            <button class="secondary"
              onclick="closeTransaction()">
              Cancel
            </button>

          </div>

        </div>`;

        document.getElementById("transactionForm")
            .addEventListener("submit", submitTransaction);

    } catch {
        showLogin();
    }
}

// TRANSACTION HISTORY
function renderTransactions(items) {
    if (!items.length) {
        return '<p class="empty">No transactions yet.</p>';
    }

    return items.map(tx => {
        const positive =
            ["deposit", "receive"].includes(tx.type);

        return `
        <div class="transaction">

          <div>
            <strong>
              ${escapeHTML(tx.description)}
            </strong>

            <small>
              ${escapeHTML(tx.created_at)}
            </small>
          </div>

          <div class="${positive ? "income" : "expense"}">
            ${positive ? "+" : "-"}${money(tx.amount)}
          </div>

        </div>`;
    }).join("");
}

// OPEN TRANSACTION
function openTransaction(action) {
    currentAction = action;

    document.getElementById("modal").style.display = "flex";

    document.getElementById("modalTitle").textContent =
        action.toUpperCase();

    document.getElementById("recipientField").style.display =
        action === "send" ? "block" : "none";

    document.getElementById("error").textContent = "";

    document.getElementById("amount").value = "";
    document.getElementById("transactionPin").value = "";
    document.getElementById("recipient").value = "";
}

// CLOSE TRANSACTION
function closeTransaction() {
    document.getElementById("modal").style.display = "none";
}

// SUBMIT TRANSACTION
async function submitTransaction(event) {
    event.preventDefault();

    const amount = Number(
        document.getElementById("amount").value
    );

    const pin =
        document.getElementById("transactionPin").value;

    const recipient =
        document.getElementById("recipient").value;

    try {
        const result = await api("/transaction", "POST", {
            type: currentAction,
            amount,
            pin,
            recipient
        });

        closeTransaction();

        await showDashboard();

        alert(result.message);

    } catch (error) {
        showError(error.message);
    }
}

// LOGOUT
async function logout() {
    try {
        await api("/logout", "POST");
    } finally {
        currentUser = null;
        showLogin();
    }
}

// START
init();
