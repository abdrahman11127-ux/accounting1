package com.example.discordidle;

import com.google.common.base.Strings;
import com.google.inject.Provides;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import javax.inject.Inject;
import javax.inject.Singleton;
import net.runelite.api.Client;
import net.runelite.api.GameState;
import net.runelite.api.Player;
import net.runelite.api.coords.WorldPoint;
import net.runelite.api.events.GameTick;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.events.GameStateChanged;
import net.runelite.client.events.ScreenshotTaken;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.util.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@PluginDescriptor(
    name = "Discord Idle Notifier",
    description = "Sends a Discord message when your account has been idle for a configurable amount of time and forwards screenshots produced by other plugins.",
    tags = {"discord", "idle", "notification"}
)
@Singleton
public class DiscordIdleNotifierPlugin extends Plugin
{
    private static final Logger log = LoggerFactory.getLogger(DiscordIdleNotifierPlugin.class);

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss")
        .withZone(ZoneId.systemDefault());

    @Inject
    private Client client;

    @Inject
    private DiscordIdleNotifierConfig config;

    @Inject
    private DiscordWebhookClient discordWebhookClient;

    @Inject
    private StatusUpdateClient statusUpdateClient;

    private WorldPoint lastWorldPoint;
    private Instant lastInteraction;
    private boolean idleAlertActive;
    private Instant lastStatusBroadcast;
    private PlayerActivityState lastBroadcastedState;
    private long lastBroadcastedIdleSeconds;
    private String lastKnownPlayerName;

    @Provides
    DiscordIdleNotifierConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(DiscordIdleNotifierConfig.class);
    }

    @Override
    protected void startUp()
    {
        resetState();
        log.debug("Discord idle notifier started");
    }

    @Override
    protected void shutDown()
    {
        resetState();
        log.debug("Discord idle notifier stopped");
    }

    private void resetState()
    {
        lastWorldPoint = null;
        lastInteraction = Instant.now();
        idleAlertActive = false;
        lastStatusBroadcast = Instant.EPOCH;
        lastBroadcastedState = PlayerActivityState.LOGGED_OUT;
        lastBroadcastedIdleSeconds = 0L;
        lastKnownPlayerName = null;
    }

    @Subscribe
    public void onGameStateChanged(GameStateChanged gameStateChanged)
    {
        if (gameStateChanged.getGameState() == GameState.LOGGING_IN || gameStateChanged.getGameState() == GameState.LOGGED_IN)
        {
            markInteraction();
        }
        else if (gameStateChanged.getGameState() == GameState.HOPPING || gameStateChanged.getGameState() == GameState.LOGIN_SCREEN)
        {
            idleAlertActive = false;
            broadcastStatus(PlayerActivityState.LOGGED_OUT, 0L, Instant.now());
        }
    }

    @Subscribe
    public void onGameTick(GameTick event)
    {
        Instant now = Instant.now();
        if (client.getGameState() != GameState.LOGGED_IN)
        {
            if (lastBroadcastedState != PlayerActivityState.LOGGED_OUT
                || Duration.between(lastStatusBroadcast, now).getSeconds() >= config.statusUpdateIntervalSeconds())
            {
                broadcastStatus(PlayerActivityState.LOGGED_OUT, 0L, now);
            }
            lastWorldPoint = null;
            idleAlertActive = false;
            return;
        }

        Player player = client.getLocalPlayer();
        if (player == null)
        {
            if (lastBroadcastedState != PlayerActivityState.LOGGED_OUT
                || Duration.between(lastStatusBroadcast, now).getSeconds() >= config.statusUpdateIntervalSeconds())
            {
                broadcastStatus(PlayerActivityState.LOGGED_OUT, 0L, now);
            }
            idleAlertActive = false;
            return;
        }

        boolean interacted = false;

        if (client.getMouseIdleTicks() < config.mouseMovementGraceTicks()
            || client.getKeyboardIdleTicks() < config.keyboardMovementGraceTicks())
        {
            interacted = true;
        }

        if (player.getAnimation() != -1 || player.getPoseAnimation() != player.getIdlePoseAnimation())
        {
            interacted = true;
        }

        WorldPoint worldPoint = player.getWorldLocation();
        if (worldPoint != null && !worldPoint.equals(lastWorldPoint))
        {
            interacted = true;
            lastWorldPoint = worldPoint;
        }

        if (interacted)
        {
            markInteraction();
        }

        Duration idleDuration = Duration.between(lastInteraction, now);
        long idleSeconds = Math.max(0L, idleDuration.getSeconds());
        PlayerActivityState state = idleSeconds >= config.idleThresholdSeconds()
            ? PlayerActivityState.IDLE
            : PlayerActivityState.ACTIVE;

        if (state == PlayerActivityState.ACTIVE)
        {
            idleAlertActive = false;
        }
        else if (!idleAlertActive && config.sendIdleAlertsToDiscord())
        {
            idleAlertActive = true;
            sendIdleNotification(player, idleDuration);
        }

        boolean shouldBroadcast = state != lastBroadcastedState;

        if (state == PlayerActivityState.ACTIVE)
        {
            if (Duration.between(lastStatusBroadcast, now).getSeconds() >= config.statusUpdateIntervalSeconds())
            {
                shouldBroadcast = true;
            }
        }
        else if (state == PlayerActivityState.IDLE && idleSeconds >= config.idleThresholdSeconds())
        {
            if (lastBroadcastedState != PlayerActivityState.IDLE
                || idleSeconds - lastBroadcastedIdleSeconds >= config.idleBroadcastIntervalSeconds())
            {
                shouldBroadcast = true;
            }
        }

        if (shouldBroadcast)
        {
            broadcastStatus(state, state == PlayerActivityState.IDLE ? idleSeconds : 0L, now);
        }
    }

    private void markInteraction()
    {
        lastInteraction = Instant.now();
        Player player = client.getLocalPlayer();
        if (player != null)
        {
            lastWorldPoint = player.getWorldLocation();
            if (player.getName() != null)
            {
                String sanitized = Text.sanitize(player.getName());
                if (!Strings.isNullOrEmpty(sanitized))
                {
                    lastKnownPlayerName = sanitized;
                }
            }
        }
        idleAlertActive = false;
    }

    private void broadcastStatus(PlayerActivityState state, long idleSeconds, Instant timestamp)
    {
        String endpoint = config.statusEndpointUrl();
        if (Strings.isNullOrEmpty(endpoint))
        {
            lastBroadcastedState = state;
            lastBroadcastedIdleSeconds = idleSeconds;
            lastStatusBroadcast = timestamp;
            return;
        }

        String playerName = resolvePlayerName();
        if (Strings.isNullOrEmpty(playerName))
        {
            return;
        }

        lastBroadcastedState = state;
        lastBroadcastedIdleSeconds = idleSeconds;
        lastStatusBroadcast = timestamp;

        Integer world = null;
        if (state != PlayerActivityState.LOGGED_OUT && client.getWorld() > 0)
        {
            world = client.getWorld();
        }

        PlayerStatusUpdate update = new PlayerStatusUpdate(playerName, state, idleSeconds, world, timestamp);
        statusUpdateClient.postStatus(endpoint, update);
    }

    private String resolvePlayerName()
    {
        Player player = client.getLocalPlayer();
        if (player != null && player.getName() != null)
        {
            String sanitized = Text.sanitize(player.getName());
            if (!Strings.isNullOrEmpty(sanitized))
            {
                lastKnownPlayerName = sanitized;
                return sanitized;
            }
        }
        return lastKnownPlayerName;
    }

    private void sendIdleNotification(Player player, Duration idleDuration)
    {
        if (!config.sendIdleAlertsToDiscord())
        {
            return;
        }

        String webhook = config.discordWebhookUrl();
        if (webhook == null || webhook.trim().isEmpty())
        {
            log.debug("Skipping Discord notification because webhook URL is missing");
            return;
        }

        long minutes = idleDuration.toMinutes();
        long seconds = idleDuration.minusMinutes(minutes).getSeconds();

        String worldString = "";
        if (config.includeWorld() && client.getWorld() > 0)
        {
            worldString = " on World " + client.getWorld();
        }

        String template = config.messageTemplate();
        String playerName = player.getName() != null ? Text.sanitize(player.getName()) : "your account";
        String message = template
            .replace("%PLAYER%", playerName)
            .replace("%DURATION%", formatDuration(minutes, seconds))
            .replace("%TIME%", TIME_FORMATTER.format(Instant.now()))
            .replace("%WORLD%", worldString);

        discordWebhookClient.sendMessage(webhook, message);
    }

    private static String formatDuration(long minutes, long seconds)
    {
        StringBuilder builder = new StringBuilder();
        if (minutes > 0)
        {
            builder.append(minutes).append(" minute");
            if (minutes != 1)
            {
                builder.append('s');
            }
        }

        if (seconds > 0)
        {
            if (builder.length() > 0)
            {
                builder.append(' ');
            }
            builder.append(seconds).append(" second");
            if (seconds != 1)
            {
                builder.append('s');
            }
        }

        if (builder.length() == 0)
        {
            builder.append("0 seconds");
        }

        return builder.toString();
    }

    @Subscribe
    public void onScreenshotTaken(ScreenshotTaken screenshotTaken)
    {
        if (!config.forwardScreenshotsToDiscord())
        {
            return;
        }

        String webhook = config.discordWebhookUrl();
        if (webhook == null || webhook.trim().isEmpty())
        {
            return;
        }

        Player player = client.getLocalPlayer();
        String playerName = player != null && player.getName() != null ? Text.sanitize(player.getName()) : "your account";
        String message = config.screenshotMessageTemplate()
            .replace("%PLAYER%", playerName)
            .replace("%FILE%", Objects.requireNonNullElse(screenshotTaken.getFileName(), "screenshot"));

        discordWebhookClient.sendScreenshot(webhook, message, screenshotTaken.getImage(), screenshotTaken.getFileName());
    }
}
