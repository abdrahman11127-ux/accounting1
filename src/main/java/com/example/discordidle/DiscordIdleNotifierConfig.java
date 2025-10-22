package com.example.discordidle;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("discordidlenotifier")
public interface DiscordIdleNotifierConfig extends Config
{
    @ConfigItem(
        keyName = "enabled",
        name = "Enable Discord notifications",
        description = "Toggle sending Discord messages when the account is idle.",
        position = 0
    )
    default boolean enabled()
    {
        return true;
    }

    @ConfigItem(
        keyName = "webhookUrl",
        name = "Discord webhook URL",
        description = "The webhook URL that will receive idle notifications.",
        position = 1
    )
    default String webhookUrl()
    {
        return "";
    }

    @ConfigItem(
        keyName = "idleSeconds",
        name = "Idle threshold (seconds)",
        description = "How long the player can be idle before a Discord message is sent.",
        position = 2
    )
    default int idleSeconds()
    {
        return 60;
    }

    @ConfigItem(
        keyName = "messageTemplate",
        name = "Message template",
        description = "Template for the Discord message. Use %PLAYER%, %SECONDS%, %MINUTES%, and %REMAINING_SECONDS% as placeholders.",
        position = 3
    )
    default String messageTemplate()
    {
        return "%PLAYER% has been idle for %SECONDS% seconds.";
    }
}
