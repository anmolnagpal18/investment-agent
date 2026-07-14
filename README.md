# InvestIQ

InvestIQ is a full-stack investment research platform that automates equity analysis through a modular pipeline. It collects financial data, analyzes corporate news, evaluates risk metrics, and generates comprehensive, explainable research reports.

The frontend is built with React 19, Tailwind CSS, and Framer Motion, featuring real-time analysis tracking and interactive Recharts data visualization. The backend is powered by Django REST Framework, utilizing `yfinance` for market data and a LangGraph-orchestrated LLM pipeline (Gemini 2.5 Flash) for quantitative summaries and SWOT reasoning.

---

## 🏗️ System Architecture & Workflow

InvestIQ uses a modular pipeline to process stock analysis requests. Instead of relying on a single prompt to generate a rating, the system breaks down the analysis into distinct operational steps. Each node has a specialized scope, and the outputs are combined deterministically to produce the final recommendation.

### Pipeline Flow
```mermaid
graph TD
    Start([User Query: e.g. 'Apple']) --> Init[Initialize State]
    Init --> CR[Company Research Node]
    CR --> FA[Financial Analysis Node]
    FA --> NA[News Analysis Node]
    NA --> RA[Risk Assessment Node]
    RA --> SA[SWOT Analysis Node]
    SA --> SC[Scoring Engine Node]
    SC --> REC[AI Recommendation Node]
    REC --> RG[Report Generator Node]
    RG --> End([HTML Report Written + Saved to DB])
```

1. **Company Research**: Resolves the ticker and pulls corporate metadata (CEO, industry, employees).
2. **Financial Analysis**: Fetches multi-year statements and computes capital ratios (P/E, P/B, ROE, Debt/Equity, margins).
3. **News Analysis**: Aggregates corporate headlines and classifies overall sentiment.
4. **Risk Assessment**: Audits structural balance sheet risks and macroeconomic headwinds.
5. **SWOT Analysis**: Compiles Strengths, Weaknesses, Opportunities, and Threats.
6. **Scoring Engine**: Computes deterministic weighted scores based on the collected data.
7. **Recommendation**: Synthesizes the quantitative metrics into an investment thesis.
8. **Report Generator**: Saves records to the database and compiles the final print-ready A4 HTML layout.

---

## 📊 Scoring & Recommendation Formula

To ensure transparency, the final AI Score is calculated using weighted category parameters:

$$\text{AI Score} = (\text{Financial Health} \times 0.30) + (\text{Growth} \times 0.25) + (\text{Valuation} \times 0.20) + (\text{Risk Safety} \times 0.15) + (\text{News Sentiment} \times 0.10)$$

Where:
- **Financial Health**: Evaluates liquidity (current ratio) and solvency (debt-to-equity).
- **Growth**: Assesses year-over-year revenue and net income growth rates.
- **Valuation**: Grades trailing multiples (P/E, P/B, P/S) relative to historical baselines.
- **Risk Safety**: Measures structural leverage metrics and stability index.
- **News Sentiment**: Computes headline lexicon tone and sentiment classification.

### Recommendation Thresholds
- **$\ge$ 90**: Strong BUY 🟢
- **80 – 89**: BUY 🟢
- **60 – 79**: HOLD 🟡
- **< 60**: PASS 🔴

---

## ⚡ Core Features

- **Live Analysis Tracker**: Displays real-time backend state updates in the UI as the pipeline progresses.
- **Explainable Metrics**: Graphically displays how each financial category contributes to the final score.
- **Interactive Financial Visualizer**: Dual-axes Recharts layouts for Revenue vs. Net Income and Operating Cash Flow across yearly or quarterly timelines.
- **Multi-Stock Comparator**: Evaluates multiple tickers side-by-side and generates comparative reports.
- **Dynamic Watchlist**: Saves target price goals, tracks current stock margins, and updates user notes dynamically.
- **Historical Reports**: Stores full HTML reports in the database, allowing for instantaneous loading and retrospective reviews.
- **A4 Print-Ready Export**: Compiles styled HTML layouts that convert to PDFs with clean page breaks and proper formatting.

---

## 📂 Project Structure

```
investment-agent/
├── backend/
│   ├── config/                 # Django settings, ASGI/WSGI routing
│   ├── authentication/         # JWT auth, user profiles
│   ├── companies/              # Data services (yfinance parser, Recharts transformers)
│   ├── research/               # LangGraph flows, database models, export views
│   ├── chat/                   # Interactive chat assistant nodes and prompts
│   ├── test_services.py        # Core data layer verification script
│   ├── test_api_integration.py # Mocked API endpoint tests
│   └── requirements.txt        # Backend dependencies
└── frontend/
    ├── src/
    │   ├── context/            # Global state (Auth, Theme, Toast)
    │   ├── components/         # Global Layout, Protected Route, navigation
    │   ├── pages/              # Main dashboard viewports (Watchlist, Comparison, reports)
    │   ├── services/           # Axios HTTP adapters
    │   ├── App.jsx             # React routing entry point
    │   └── index.css           # Global typography and theme configurations
    ├── tailwind.config.js      # CSS styling variables
    └── vite.config.js          # Hot-reloading development server
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone & Configure Environments
Create a `.env` file inside the `backend/` directory based on the `.env.example` in the root:
```env
DEBUG=True
SECRET_KEY=your_secret_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 2. Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the Django API server:
   ```bash
   python manage.py runserver
   ```
   The backend will start on `http://127.0.0.1:8000`.

### 3. Frontend Setup
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install package dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will run locally at `http://localhost:5173`.

---

## 🧪 Running Tests & Verifications

The repository contains isolated test files to audit both the network services and Django controllers.

### Verify Data Service Layer (yfinance & charts)
```bash
cd backend
.\venv\Scripts\python.exe test_services.py
```

### Verify Endpoint Integration
```bash
cd backend
.\venv\Scripts\python.exe test_api_integration.py
```

---

## 🛡️ Security & Performance

- **Environment Variables**: Sensitive configuration is managed through `.env` files.
- **CORS Handling**: Django CORS headers are configured via environment variables.
- **Payload Compression**: Financial chart data uses pre-summarized yearly and quarterly models to minimize network payload volumes.
- **Caching Mechanism**: Stock details and financial statements are cached inside the database to reduce redundant API calls to `yfinance`.

