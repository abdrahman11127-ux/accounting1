package com.example.discordidle.monitor;

import java.util.Objects;

final class MonitorOptions
{
    private final int port;
    private final int idleThresholdSeconds;
    private final String discordWebhookUrl;

    MonitorOptions(int port, int idleThresholdSeconds, String discordWebhookUrl)
    {
        if (port <= 0 || port > 65535)
        {
            throw new IllegalArgumentException("Port must be between 1 and 65535");
        }
        if (idleThresholdSeconds < 5)
        {
            throw new IllegalArgumentException("Idle threshold must be at least 5 seconds");
        }
        this.port = port;
        this.idleThresholdSeconds = idleThresholdSeconds;
        this.discordWebhookUrl = discordWebhookUrl == null || discordWebhookUrl.isBlank() ? null : discordWebhookUrl;
    }

    int port()
    {
        return port;
    }

    int idleThresholdSeconds()
    {
        return idleThresholdSeconds;
    }

    String discordWebhookUrl()
    {
        return discordWebhookUrl;
    }

    @Override
    public String toString()
    {
        return "MonitorOptions{"
            + "port=" + port
            + ", idleThresholdSeconds=" + idleThresholdSeconds
            + ", discordWebhookUrl='" + (discordWebhookUrl == null ? "" : "***") + '\''
            + '}';
    }

    static MonitorOptions fromArgs(String[] args)
    {
        int port = 8085;
        int idleThreshold = 60;
        String webhook = null;

        for (int i = 0; i < args.length; i++)
        {
            String arg = args[i];
            if (arg.startsWith("--"))
            {
                String[] parts = arg.substring(2).split("=", 2);
                String key = parts[0];
                String value = parts.length > 1 ? parts[1] : null;
                if (value == null && i + 1 < args.length)
                {
                    value = args[++i];
                }

                if (Objects.equals(key, "port"))
                {
                    port = Integer.parseInt(Objects.requireNonNull(value, "Missing value for --port"));
                }
                else if (Objects.equals(key, "idle-threshold"))
                {
                    idleThreshold = Integer.parseInt(Objects.requireNonNull(value, "Missing value for --idle-threshold"));
                }
                else if (Objects.equals(key, "discord-webhook"))
                {
                    webhook = Objects.requireNonNull(value, "Missing value for --discord-webhook");
                }
            }
        }

        return new MonitorOptions(port, idleThreshold, webhook);
    }
}
