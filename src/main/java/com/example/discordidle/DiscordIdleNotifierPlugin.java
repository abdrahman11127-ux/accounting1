package com.example.discordidle;

import com.google.inject.Provides;
import javax.inject.Inject;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import java.io.IOException;
import java.time.Duration;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.Player;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.GameTick;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.util.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@PluginDescriptor(
    name = "Discord Idle Notifier",
    description = "Send a Discord message when the local player has been idle for too long.",
    tags = {"discord", "idle", "notification"}
)
public class DiscordIdleNotifierPlugin extends Plugin
{
    private static final Logger log = LoggerFactory.getLogger(DiscordIdleNotifierPlugin.class);
    private static final double TICK_LENGTH_SECONDS = 0.6D;
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    @Inject
    private Client client;

    @Inject
    private OkHttpClient okHttpClient;

    @Inject
    private DiscordIdleNotifierConfig config;

    private int lastActiveTick = -1;
    private boolean idleAlertSent;

    @Override
    protected void startUp()
    {
        resetIdleTimer();
        log.debug("Discord Idle Notifier started");
    }

    @Override
    protected void shutDown()
    {
        resetIdleTimer();
        log.debug("Discord Idle Notifier stopped");
    }

    @Subscribe
    public void onGameStateChanged(final GameStateChanged event)
    {
        if (event.getGameState() == GameState.LOGGED_IN)
        {
            lastActiveTick = client.getTickCount();
            idleAlertSent = false;
        }
        else if (event.getGameState() == GameState.LOGIN_SCREEN || event.getGameState() == GameState.HOPPING)
        {
            resetIdleTimer();
        }
    }

    @Subscribe
    public void onGameTick(final GameTick gameTick)
    {
        if (!config.enabled())
        {
            return;
        }

        if (client.getGameState() != GameState.LOGGED_IN)
        {
            resetIdleTimer();
            return;
        }

        final Player localPlayer = client.getLocalPlayer();
        if (localPlayer == null)
        {
            return;
        }

        final int tickCount = client.getTickCount();

        if (playerIsActive(localPlayer))
        {
            lastActiveTick = tickCount;
            idleAlertSent = false;
            return;
        }

        if (lastActiveTick < 0)
        {
            lastActiveTick = tickCount;
            return;
        }

        final int idleTicks = tickCount - lastActiveTick;
        final int thresholdTicks = ticksFromSeconds(config.idleSeconds());

        if (idleTicks >= thresholdTicks && !idleAlertSent)
        {
            final int idleSeconds = (int) Math.round(idleTicks * TICK_LENGTH_SECONDS);
            sendDiscordNotification(localPlayer, idleSeconds);
            idleAlertSent = true;
        }
    }

    private boolean playerIsActive(final Player player)
    {
        if (player.isMoving())
        {
            return true;
        }

        if (player.getAnimation() != -1)
        {
            return true;
        }

        if (player.getPoseAnimation() != player.getIdlePoseAnimation())
        {
            return true;
        }

        return player.getInteracting() != null;
    }

    private void sendDiscordNotification(final Player player, final int idleSeconds)
    {
        final String webhookUrl = config.webhookUrl();
        if (webhookUrl == null)
        {
            log.warn("Discord webhook URL is not configured; skipping notification");
            return;
        }

        final String trimmedWebhookUrl = webhookUrl.trim();
        if (trimmedWebhookUrl.isEmpty())
        {
            log.warn("Discord webhook URL is not configured; skipping notification");
            return;
        }

        final String playerName = player != null ? Text.removeTags(player.getName()) : "Unknown";
        final String message = buildMessage(playerName, idleSeconds);

        final String payloadJson = '{' + "\"content\": " + escapeJson(message) + '}';
        final RequestBody body = RequestBody.create(payloadJson, JSON);
        final Request request = new Request.Builder()
            .url(trimmedWebhookUrl)
            .post(body)
            .build();

        okHttpClient.newCall(request).enqueue(new Callback()
        {
            @Override
            public void onFailure(final Call call, final IOException e)
            {
                log.warn("Failed to send Discord notification", e);
            }

            @Override
            public void onResponse(final Call call, final Response response) throws IOException
            {
                try (ResponseBody responseBody = response.body())
                {
                    if (!response.isSuccessful())
                    {
                        log.warn("Discord webhook responded with status {}", response.code());
                    }
                    else
                    {
                        log.debug("Sent idle notification for {}", playerName);
                    }
                }
            }
        });
    }

    private String buildMessage(final String playerName, final int idleSeconds)
    {
        final Duration idleDuration = Duration.ofSeconds(idleSeconds);
        final long minutesPart = idleDuration.toMinutes();
        final long secondsPart = idleDuration.minusMinutes(minutesPart).getSeconds();

        String message = config.messageTemplate();
        message = message.replace("%PLAYER%", playerName);
        message = message.replace("%SECONDS%", Integer.toString(idleSeconds));
        message = message.replace("%MINUTES%", Long.toString(minutesPart));
        message = message.replace("%REMAINING_SECONDS%", Long.toString(secondsPart));
        return message;
    }

    private String escapeJson(final String text)
    {
        final StringBuilder builder = new StringBuilder();
        builder.append('"');
        for (int i = 0; i < text.length(); i++)
        {
            final char c = text.charAt(i);
            switch (c)
            {
                case '\\':
                case '"':
                    builder.append('\\').append(c);
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '\t':
                    builder.append("\\t");
                    break;
                case '\b':
                    builder.append("\\b");
                    break;
                case '\f':
                    builder.append("\\f");
                    break;
                default:
                    if (c < 0x20)
                    {
                        builder.append(String.format("\\u%04x", (int) c));
                    }
                    else
                    {
                        builder.append(c);
                    }
                    break;
            }
        }
        builder.append('"');
        return builder.toString();
    }

    private int ticksFromSeconds(final int seconds)
    {
        final int ticks = (int) Math.round(seconds / TICK_LENGTH_SECONDS);
        return Math.max(ticks, 1);
    }

    private void resetIdleTimer()
    {
        lastActiveTick = -1;
        idleAlertSent = false;
    }

    @Provides
    DiscordIdleNotifierConfig provideConfig(final ConfigManager configManager)
    {
        return configManager.getConfig(DiscordIdleNotifierConfig.class);
    }
}
