# Discord Idle Notifier

A RuneLite plugin that posts to Discord whenever the current account has been idle for a configurable amount of time (60 seconds by default). This is useful when you run multiple accounts and need an external alert if one of them stops acting.

## Features

- Detects when the local player has stopped moving, animating, or interacting.
- Sends a Discord webhook message after the player has been idle for the configured number of seconds.
- Customisable message template with placeholders for player name and idle duration.

## Configuration

1. Open the plugin panel in RuneLite and search for **Discord Idle Notifier**.
2. Enter your Discord webhook URL. You can create one under *Server Settings → Integrations → Webhooks* in Discord.
3. Optionally change the idle threshold (in seconds) and the message template.

### Message placeholders

The message template understands the following placeholders:

| Placeholder | Replaced with |
|-------------|---------------|
| `%PLAYER%` | The account name. |
| `%SECONDS%` | Total number of idle seconds. |
| `%MINUTES%` | Whole minutes in the idle duration. |
| `%REMAINING_SECONDS%` | Remaining seconds after the whole minutes are removed. |

## Building

```bash
gradle build
```

The compiled plugin jar will be placed in `build/libs/`.

## Discord message example

```
MyAccount has been idle for 60 seconds.
```

Adjust the message template to suit your workflow.
