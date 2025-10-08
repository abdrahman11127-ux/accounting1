# Multi-System Finance Manager

A lightweight browser app for tracking cash in / cash out across four linked setups:

- **Personal Savings** – starts with PKR 1,000,000 capital, records transfers into the other businesses, and keeps the Liaqat & Sons receivable separate from everything else.
- **Game Business** – captures daily income and expenses with a supplier dropdown (Zubair Bhai is preloaded) and can export the supplier ledger to PDF.
- **Depalpur Distribution** – logs cash movements, stock adjustments, customer receivables, and Liaqat payable without letting the payable distort the net business figure.
- **Personal Account** – tracks personal salary, spending, and amounts temporarily owed back to each business after a cash draw.

A shared directory panel lets you add suppliers, workers, and custom categories once and reuse them throughout the app.

All data lives in the browser via `localStorage`, so no database or back-end is required.

## Running the app

The UI is 100% static. Choose any of the following options:

- **Open `index.html` or `standalone.html` directly.** Both files inline the CSS and JavaScript so they work offline (handy for quick bookkeeping on a laptop or phone).
- **Serve the editable sources.** If you want live reload or plan to modify the markup, use `index.template.html` with a tiny HTTP server:

  ```bash
  # Python (macOS/Linux)
  python -m http.server 8000

  # or Node.js using the serve package
  npm install --global serve
  serve .
  ```

  Then visit the printed localhost URL in your browser.

## Using the dashboards

1. Open the Dashboard tab and pick the workspace you want to update.
2. Each panel has a single **Cash In / Cash Out** toggle with the minimum number of fields.
3. When money moves between systems (for example, Personal Savings paying the Game Business), choose the linked business so the counterpart entry is created automatically.
4. Watch the **Linked Business Balances** blocks in each workspace – they total receivables/payables per system and refresh after every add, edit, or delete.
5. Use the **Liaqat & Sons widget** inside Personal Savings for quick give/receive entries – the receivable stays separate from Depalpur’s payable.
6. Use the **Depalpur quick calculator** to plug in current receivables, payables, stock, and worker advances without touching the ledgers – the total business value updates instantly.
7. Use the **Edit** and **Delete** buttons in each ledger row to correct mistakes; linked transfers, Liaqat balances, and counter-ledgers stay in sync automatically.
8. Filter any ledger by supplier/party and press **Export PDF** to snapshot it (useful for sharing the Zubair Bhai ledger).
9. Open the **party directory** to add new accounts (e.g., Liaqat & Sons) and click **View ledger** beside any name to review or export their cross-system statement.
10. Manage parties and categories in the Directory tab; they immediately appear in every form and the relevant datalists.

## Regenerating the bundled HTML

`index.html` and `standalone.html` are generated from the template, stylesheet, and script. After editing `index.template.html`, `styles.css`, or `app.js`, rerun the helper:

```bash
node scripts/build-standalone.js
```

Commit the regenerated files so end users can continue opening a single HTML document.

## Manual testing checklist

Because the interface runs entirely in the browser there’s no automated test suite. Manually verify the main flows after you make changes:

1. Record cash in / out for each workspace and confirm balances update immediately.
2. Link a transfer between Personal Savings and Game Business and ensure both ledgers receive entries with opposite directions.
3. Add a Liaqat entry and check the outstanding receivable value.
4. Add a new supplier via the Game Business quick button and confirm it appears in the dropdowns and the Directory list.
5. Export a ledger to PDF (especially the Zubair Bhai view) to make sure the snapshot downloads successfully.

## Design notes

- **Single-step forms** keep data entry fast while still supporting linked transfers.
- **Shared party and category directory** avoids retyping supplier names across systems.
- **Liaqat-specific handling** mirrors the original requirement: the receivable lives in Personal Savings, while Depalpur’s Liaqat payable is tracked separately and excluded from the net position.
- **LocalStorage persistence** means you can take backups by saving the page or exporting PDFs without setting up a server.
