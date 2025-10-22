package com.example.discordidle.monitor;

import com.example.discordidle.PlayerActivityState;
import com.example.discordidle.PlayerStatusUpdate;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

final class PlayerStatusRecord
{
    private final String player;
    private PlayerActivityState state;
    private long reportedIdleSeconds;
    private Integer world;
    private Instant lastUpdate;
    private Instant stateSince;

    PlayerStatusRecord(String player)
    {
        this.player = Objects.requireNonNull(player, "player");
        this.state = PlayerActivityState.LOGGED_OUT;
        this.reportedIdleSeconds = 0L;
        this.stateSince = Instant.now();
        this.lastUpdate = Instant.now();
    }

    synchronized PlayerActivityState getState()
    {
        return state;
    }

    synchronized long computeIdleSeconds(Instant now)
    {
        if (state != PlayerActivityState.IDLE)
        {
            return 0L;
        }

        long extra = Duration.between(lastUpdate, now).getSeconds();
        return reportedIdleSeconds + Math.max(0L, extra);
    }

    synchronized long computeStateDurationSeconds(Instant now)
    {
        return Math.max(0L, Duration.between(stateSince, now).getSeconds());
    }

    synchronized Instant getLastUpdate()
    {
        return lastUpdate;
    }

    synchronized Integer getWorld()
    {
        return world;
    }

    String getPlayer()
    {
        return player;
    }

    synchronized PlayerActivityState apply(PlayerStatusUpdate update, Instant receivedAt)
    {
        PlayerActivityState previous = state;
        state = Objects.requireNonNull(update.getState(), "state");
        reportedIdleSeconds = Math.max(0L, update.getIdleSeconds());
        world = update.getWorld();
        lastUpdate = Objects.requireNonNullElse(update.getTimestamp(), receivedAt);
        if (state != previous)
        {
            stateSince = lastUpdate;
            if (state != PlayerActivityState.IDLE)
            {
                reportedIdleSeconds = 0L;
            }
        }
        return previous;
    }
}
