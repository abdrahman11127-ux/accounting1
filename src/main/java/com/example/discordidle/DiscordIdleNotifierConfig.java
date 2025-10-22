package com.example.discordidle;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;
import net.runelite.client.config.ConfigSection;
import net.runelite.client.config.Range;

@ConfigGroup(DiscordIdleNotifierConfig.GROUP)
public interface DiscordIdleNotifierConfig extends Config
{
    String GROUP = "discordIdleNotifier";

    @ConfigSection(
        keyName = "discord",
        name = "Discord",
        description = "Discord webhook configuration",
        position = 0
    )
    String discordSection = "discord";

    @ConfigSection(
        keyName = "idle",
        name = "Idle detection",
        description = "Tune how the plugin determines inactivity",
        position = 1
    )
    String idleSection = "idle";

    @ConfigSection(
        keyName = "screenshots",
        name = "Screenshot forwarding",
        description = "Forward RuneLite screenshots to Discord",
        position = 2
    )
    String screenshotSection = "screenshots";

    @ConfigSection(
        keyName = "monitor",
        name = "Monitor app",
        description = "Send activity updates to the standalone monitor UI",
        position = 3
    )
    String monitorSection = "monitor";

    @ConfigItem(
        keyName = "discordWebhookUrl",
        name = "Webhook URL",
        description = "Discord webhook URL used for notifications.",
        position = 0,
        section = discordSection
    )
    default String discordWebhookUrl()
    {
        return "";
    }

    @ConfigItem(
        keyName = "messageTemplate",
        name = "Idle message template",
        description = "Template used when sending idle messages. Supported placeholders: %PLAYER%, %DURATION%, %TIME%, %WORLD%.",
        position = 1,
        section = discordSection
    )
    default String messageTemplate()
    {
        return "%PLAYER% has been idle for %DURATION% as of %TIME%%WORLD%";
    }

    @ConfigItem(
        keyName = "includeWorld",
        name = "Include world",
        description = "Include the active world in the Discord message.",
        position = 2,
        section = discordSection
    )
    default boolean includeWorld()
    {
        return true;
    }

    @ConfigItem(
        keyName = "sendIdleAlertsToDiscord",
        name = "Send idle alerts to Discord",
        description = "Send idle alerts directly to Discord. Disable when the monitor app is responsible for Discord notifications.",
        position = 3,
        section = discordSection
    )
    default boolean sendIdleAlertsToDiscord()
    {
        return true;
    }

    @Range(min = 10, max = 600)
    @ConfigItem(
        keyName = "idleThresholdSeconds",
        name = "Idle threshold (s)",
        description = "How long the player must remain inactive before a notification is sent.",
        position = 0,
        section = idleSection
    )
    default int idleThresholdSeconds()
    {
        return 60;
    }

    @Range(min = 1, max = 50)
    @ConfigItem(
        keyName = "mouseMovementGraceTicks",
        name = "Mouse activity grace ticks",
        description = "How many ticks the plugin waits after mouse movement before considering the player idle.",
        position = 1,
        section = idleSection
    )
    default int mouseMovementGraceTicks()
    {
        return 5;
    }

    @Range(min = 1, max = 50)
    @ConfigItem(
        keyName = "keyboardMovementGraceTicks",
        name = "Keyboard activity grace ticks",
        description = "How many ticks the plugin waits after keyboard input before considering the player idle.",
        position = 2,
        section = idleSection
    )
    default int keyboardMovementGraceTicks()
    {
        return 5;
    }

    @ConfigItem(
        keyName = "forwardScreenshotsToDiscord",
        name = "Forward screenshots",
        description = "Forward RuneLite screenshots to Discord.",
        position = 0,
        section = screenshotSection
    )
    default boolean forwardScreenshotsToDiscord()
    {
        return true;
    }

    @ConfigItem(
        keyName = "screenshotMessageTemplate",
        name = "Screenshot message template",
        description = "Template used when forwarding screenshots. Supported placeholders: %PLAYER%, %FILE%.",
        position = 1,
        section = screenshotSection
    )
    default String screenshotMessageTemplate()
    {
        return "%PLAYER% triggered a screenshot (%FILE%)";
    }

    @ConfigItem(
        keyName = "statusEndpointUrl",
        name = "Status endpoint URL",
        description = "Local HTTP endpoint exposed by the monitor application (e.g. http://localhost:8085/status).",
        position = 0,
        section = monitorSection
    )
    default String statusEndpointUrl()
    {
        return "";
    }

    @Range(min = 5, max = 300)
    @ConfigItem(
        keyName = "statusUpdateIntervalSeconds",
        name = "Active update interval (s)",
        description = "How often status updates are sent while the account is active.",
        position = 1,
        section = monitorSection
    )
    default int statusUpdateIntervalSeconds()
    {
        return 30;
    }

    @Range(min = 10, max = 600)
    @ConfigItem(
        keyName = "idleBroadcastIntervalSeconds",
        name = "Idle broadcast interval (s)",
        description = "How often idle updates are sent after the initial idle alert is triggered.",
        position = 2,
        section = monitorSection
    )
    default int idleBroadcastIntervalSeconds()
    {
        return 60;
    }
}
