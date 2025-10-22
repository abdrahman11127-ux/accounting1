package com.example.discordidle.monitor;

import com.example.discordidle.DiscordWebhookClient;
import com.example.discordidle.PlayerActivityState;
import com.example.discordidle.PlayerStatusUpdate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

final class PlayerStatusMonitor
{
    private final Map<String, PlayerStatusRecord> records = new ConcurrentHashMap<>();
    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();
    private final MonitorOptions options;
    private final DiscordWebhookClient webhookClient;

    PlayerStatusMonitor(MonitorOptions options)
    {
        this(options, new DiscordWebhookClient());
    }

    PlayerStatusMonitor(MonitorOptions options, DiscordWebhookClient webhookClient)
    {
        this.options = Objects.requireNonNull(options, "options");
        this.webhookClient = Objects.requireNonNull(webhookClient, "webhookClient");
    }

    void onUpdate(PlayerStatusUpdate update, Instant receivedAt)
    {
        if (update == null || update.getPlayer() == null)
        {
            return;
        }

        String key = update.getPlayer();
        PlayerStatusRecord record = records.computeIfAbsent(key, PlayerStatusRecord::new);
        PlayerActivityState previous;
        long previousIdleSeconds;
        synchronized (record)
        {
            previousIdleSeconds = record.computeIdleSeconds(receivedAt);
            previous = record.apply(update, receivedAt);
        }
        maybeNotifyDiscord(record, previous, previousIdleSeconds, receivedAt);
        notifyListeners();
    }

    List<PlayerStatusRecord> snapshot()
    {
        List<PlayerStatusRecord> snapshot = new ArrayList<>(records.values());
        snapshot.sort(Comparator.comparing(PlayerStatusRecord::getPlayer, String.CASE_INSENSITIVE_ORDER));
        return Collections.unmodifiableList(snapshot);
    }

    void addListener(Runnable listener)
    {
        listeners.add(listener);
    }

    private void notifyListeners()
    {
        for (Runnable listener : listeners)
        {
            listener.run();
        }
    }

    private void maybeNotifyDiscord(PlayerStatusRecord record, PlayerActivityState previous, long previousIdleSeconds, Instant now)
    {
        String webhook = options.discordWebhookUrl();
        if (webhook == null)
        {
            return;
        }

        PlayerActivityState current;
        long idleSeconds;
        long stateDuration;
        Integer world;
        synchronized (record)
        {
            current = record.getState();
            idleSeconds = record.computeIdleSeconds(now);
            stateDuration = record.computeStateDurationSeconds(now);
            world = record.getWorld();
        }

        if (current == PlayerActivityState.IDLE && previous != PlayerActivityState.IDLE && idleSeconds >= options.idleThresholdSeconds())
        {
            String message = String.format("%s has been idle for %s%s", record.getPlayer(), formatDuration(idleSeconds), formatWorld(world));
            webhookClient.sendMessage(webhook, message);
        }
        else if (current == PlayerActivityState.ACTIVE && previous == PlayerActivityState.IDLE && stateDuration >= 2)
        {
            long idleToReport = previousIdleSeconds > 0 ? previousIdleSeconds : idleSeconds;
            String message = String.format("%s is active again after %s idle%s", record.getPlayer(), formatDuration(idleToReport), formatWorld(world));
            webhookClient.sendMessage(webhook, message);
        }
    }

    static String formatDuration(long totalSeconds)
    {
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        if (minutes > 0)
        {
            if (seconds > 0)
            {
                return String.format("%d minute%s %d second%s", minutes, minutes == 1 ? "" : "s", seconds, seconds == 1 ? "" : "s");
            }
            return String.format("%d minute%s", minutes, minutes == 1 ? "" : "s");
        }
        return String.format("%d second%s", seconds, seconds == 1 ? "" : "s");
    }

    private static String formatWorld(Integer world)
    {
        if (world == null)
        {
            return "";
        }
        return String.format(" (World %d)", world);
    }
}
