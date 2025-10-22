package com.example.discordidle;

import java.time.Instant;
import java.util.Objects;

/**
 * Payload describing a player's current activity state.
 */
public class PlayerStatusUpdate
{
    private String player;
    private PlayerActivityState state;
    private long idleSeconds;
    private Integer world;
    private Instant timestamp;

    public PlayerStatusUpdate()
    {
        // Gson constructor
    }

    public PlayerStatusUpdate(String player, PlayerActivityState state, long idleSeconds, Integer world, Instant timestamp)
    {
        this.player = player;
        this.state = state;
        this.idleSeconds = idleSeconds;
        this.world = world;
        this.timestamp = timestamp;
    }

    public String getPlayer()
    {
        return player;
    }

    public PlayerActivityState getState()
    {
        return state;
    }

    public long getIdleSeconds()
    {
        return idleSeconds;
    }

    public Integer getWorld()
    {
        return world;
    }

    public Instant getTimestamp()
    {
        return timestamp;
    }

    public void setPlayer(String player)
    {
        this.player = player;
    }

    public void setState(PlayerActivityState state)
    {
        this.state = state;
    }

    public void setIdleSeconds(long idleSeconds)
    {
        this.idleSeconds = idleSeconds;
    }

    public void setWorld(Integer world)
    {
        this.world = world;
    }

    public void setTimestamp(Instant timestamp)
    {
        this.timestamp = timestamp;
    }

    public PlayerStatusUpdate requireValid()
    {
        Objects.requireNonNull(player, "player");
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(timestamp, "timestamp");
        return this;
    }
}
