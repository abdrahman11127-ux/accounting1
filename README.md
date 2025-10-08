# Integrated Finance Manager

This project delivers a browser-based command centre for managing cash, expenses, assets, receivables, and payables across multiple business setups:

- **Personal Savings Ledger** &ndash; monitors capital movements from the original PKR&nbsp;1,000,000 pool and links transfers to the other ledgers.
- **Liaqat &amp; Sons receivable tracking** &ndash; records advances and repayments separately from business payables so you can see the outstanding balance at a glance.
- **Game Business** &ndash; captures operating expenses, M purchases, memberships, computer equipment, and income with automatic supplier management.
- **Depalpur Distribution** &ndash; tracks supplier purchases, liabilities (with special attention to Liaqat &amp; Sons), stock adjustments, cash, customer receivables, and provides a parties snapshot for workers, suppliers, and customers.
- **Personal Account** &ndash; records personal spending, salary draws, and inter-company transfers from any business system.
- **Directory &amp; category manager** &ndash; maintain shared lists of suppliers, workers, and custom categories linked to each system for faster data entry.
- **Consolidated Reports** &ndash; highlights net positions, cash balances, outstanding payables, receivables, and spending breakdowns at a glance.

All records are stored locally in the browser using `localStorage`, so no server component is required.

## Getting started

### Run the app locally

The project is a static, browser-based dashboard. There are two easy ways to
open it:

- **Single-file bundle (`standalone.html`)** – open this file directly in any
  modern browser (even on mobile). It inlines all styles and scripts so the UI
  renders correctly without needing the accompanying assets.
- **Multi-file source (`index.html`)** – use this when you are editing the
  project. Either double-click the file or serve the repository with any static
  file server so that relative asset paths resolve. Examples:

- **Python** (ships with macOS/Linux and is available on Windows via the
  Microsoft Store):

  ```bash
  cd /path/to/accounting1
  python -m http.server 8000
  ```

  Then browse to <http://localhost:8000>.

- **Node.js** using [`serve`](https://www.npmjs.com/package/serve):

  ```bash
  npm install --global serve
  serve .
  ```

 The CLI prints the local URL (usually <http://localhost:3000>).

### Using the dashboard

1. Open the local URL (or `standalone.html` / `index.html`) in Chrome, Edge,
   Firefox, or Safari.
2. Use the dashboard cards to open the detailed workspace for each system.
3. Submit forms to record movements. Built-in automation keeps the ledgers in
   sync when you link transactions between systems.
4. Data is persisted in the same browser. Clear the browser storage or use the
   in-app backup/restore controls to reset or migrate data.

## Testing

There is no automated test suite because the application runs entirely in the
browser. To verify changes:

1. Start the static server (or open `index.html`).
2. Walk through key flows, such as adding expenses or settling supplier
   balances, and confirm the summary cards update immediately.
3. Use the backup/export buttons to ensure downloads still function in your
   browser.
4. Optionally open the developer console to confirm there are no runtime
   errors.

### Regenerating the single-file bundle

If you change `styles.css`, `app.js`, or `index.html`, run the helper script to
refresh `standalone.html`:

```bash
node scripts/build-standalone.js
```

Commit the regenerated file so end users can continue opening a single HTML
document without needing a local web server.

## Key design decisions

- **Professional dashboard layout** with responsive cards and detail panels for a desktop-like feel.
- **Cross-system automation** to mirror transfers between ledgers and keep cash positions aligned without double entry bookkeeping.
- **Supplier and party management** letting you extend the default lists (Zubair Bhai, Kehkashan Mehndi, Olympia Chemical, Liaqat &amp; Sons, Nazim Ali) with custom names tied to specific ledgers.
- **External settlement handling** keeps cash ledgers accurate by marking personal-savings-funded supplier payments as non-cash adjustments in the destination system while still reducing supplier balances.
- **Integrated exports and backup** via per-ledger CSV downloads and JSON backup/restore controls.
- **Depalpur cash ledger filters** include quick date range selectors and CSV export so you can reconcile periods or share activity snapshots without manual copy/paste.
- **Net business value calculation** for the Depalpur Distribution hub honours the Liaqat &amp; Sons payable requirement by excluding it from the net figure while still showing the outstanding liability.

Feel free to extend the JavaScript data model to introduce authentication, reporting, or data export features if you need to scale beyond a single user/device.
