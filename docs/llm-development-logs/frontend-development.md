# LLM Development Logs — Frontend Implementation

This log tracks the frontend implementation, detailing how we achieved Vite bundle optimization, Perplexity-style UI flows, and custom Recharts charts.

---

## 1. Application Architecture

The frontend is built using **React 19**, **Vite**, **Tailwind CSS**, and **Framer Motion**.

### Code Splitting
To avoid loading the heavy Recharts dependency in the initial JS bundle, we set up code splitting using `React.lazy()` and `Suspense` in `App.jsx`:
```javascript
const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const ResearchWorkspace = React.lazy(() => import('./pages/ResearchWorkspace'));
```
**Outcome**: Decreased initial load bundle size to **409KB**, resulting in faster initial paint times.

---

## 2. Interactive SWOT & Chart Implementations

Rather than showing static text lists, we built:
- **SWOT Cards**: Color-coded tiles with hover and stagger animations (`framer-motion`).
- **Interactive Charts**: A unified chart panel that handles area graphs for Revenue, Net Profit, and Cash Flow, and line charts for ROE and EPS. It features a Yearly/Quarterly toggle that swaps datasets instantly.

---

## 3. Explainable AI Elements (Dynamic UX)

We built three custom explanation portals:
1. **Explain Category Scores**: Every score bar has an `Explain` button. Clicking it triggers an inline query requesting the AI model to explain that *specific* category score based on the company's report.
2. **Explain Confidence Waterfall**: Clicking `Why?` on the confidence score opens a modal displaying how each category contributed to or subtracted from the baseline 50-point score.
3. **HTML Previewer**: Instead of auto-downloading reports, users can open an inline interactive preview frame before choosing to export or share.
