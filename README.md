# Discord Idle Notifier & Monitor

A RuneLite plugin that sends Discord webhook messages when your account has been idle for a configurable amount of time. It can also forward RuneLite screenshots (for example, death or level-up captures from other plugins) directly to the same webhook.

For multi-account setups, a standalone desktop monitor application is included. Point each RuneLite client at the monitor and it will display every player, their current activity state, and an always-on idle timer. The monitor can optionally relay alerts to Discord so you only receive a single consolidated notification per account.

## Features

- Track local-player activity and notify Discord after a configurable idle delay (default 60 seconds).
- Detects activity via mouse/keyboard input, animation changes, and movement.
- Customisable Discord message templates with placeholders for the player name, idle duration, timestamp, and world.
- Optional forwarding of RuneLite screenshots (including attachments) to Discord with a separate template.
- Broadcast activity state to the bundled monitor app for an overview of every connected RuneLite client.
- Monitor app displays live idle timers, last-update timestamps, and per-account worlds in a sortable table.
- Monitor app can forward idle/active state transitions to Discord via a single webhook.

## Getting started

1. Create a Discord webhook in the channel where you want to receive notifications and copy the URL (optional when using the monitor without Discord).
2. Build the plugin jar and monitor application:

   ```bash
   ./gradlew build
   ```

   The compiled plugin will be available at `build/libs/discord-idle-notifier-1.0.0.jar`.
3. Install the jar via RuneLite's external plugin manager (or your preferred deployment method).
4. (Optional) launch the monitor desktop app. From the repository root:

   ```bash
   ./gradlew run --args="--port 8085 --idle-threshold 60 --discord-webhook https://discord.com/api/webhooks/..."
   ```

   Omit `--discord-webhook` to run the monitor purely offline. The monitor listens for HTTP POST requests on `/status` (default port `8085`) and opens a Swing window that lists every connected player alongside their state, idle timer, world, and last update timestamp.
5. Open the RuneLite plugin configuration:
   - **Webhook URL** – Discord webhook used when the plugin sends notifications directly.
   - **Send idle alerts to Discord** – Toggle to disable plugin-originated Discord messages when the monitor should handle them.
   - **Idle threshold / grace ticks** – Adjust activity detection to suit your workflow.
   - **Status endpoint URL** – HTTP endpoint exposed by the monitor (default `http://localhost:8085/status`). Leave blank to disable monitor updates.
   - **Active update interval** – How frequently the plugin sends keep-alive updates while the account is active.
   - **Idle broadcast interval** – How often additional idle updates are sent after the initial alert.
   - Customise the message templates if desired.
   - Enable or disable screenshot forwarding.

## Configuration placeholders

| Placeholder | Idle notification | Screenshot notification | Description |
|-------------|-------------------|-------------------------|-------------|
| `%PLAYER%`  | ✅                 | ✅                       | Sanitised RuneScape display name (falls back to “your account”). |
| `%DURATION%`| ✅                 | ❌                       | Human-readable idle duration (minutes and seconds). |
| `%TIME%`    | ✅                 | ❌                       | Local time when the alert was triggered. |
| `%WORLD%`   | ✅                 | ❌                       | World indicator in the format `World 301` when available. |
| `%FILE%`    | ❌                 | ✅                       | The RuneLite screenshot file name. |

## Monitor app HTTP contract

- Endpoint: `POST /status`
- Content type: `application/json`
- Payload schema:

  ```json
  {
    "player": "My Account",
    "state": "ACTIVE" | "IDLE" | "LOGGED_OUT",
    "idleSeconds": 42,
    "world": 301,
    "timestamp": "2024-05-25T12:34:56Z"
  }
  ```

The RuneLite plugin emits these payloads automatically when the status endpoint is configured. Third-party tooling can post the same schema to surface additional accounts in the monitor if needed.

## Notes

- The plugin sends messages asynchronously using the standard RuneLite HTTP client stack (OkHttp).
- Discord rate limits apply; both the plugin and monitor will log warnings if a webhook call fails.
- To avoid spam, the plugin only emits one idle notification per idle period and resets once activity resumes. The monitor mirrors this behaviour when relaying alerts.
- The monitor app is optional; leave the status endpoint blank if you only need Discord notifications straight from RuneLite.

## License

This project is provided without an explicit license. Adapt as needed for your own use.
