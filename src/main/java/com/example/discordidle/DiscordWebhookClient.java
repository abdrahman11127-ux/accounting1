package com.example.discordidle;

import com.google.common.base.Strings;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import javax.inject.Singleton;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Singleton
public class DiscordWebhookClient
{
    private static final Logger log = LoggerFactory.getLogger(DiscordWebhookClient.class);
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private static final MediaType PNG = MediaType.parse("image/png");

    private final OkHttpClient httpClient = new OkHttpClient();

    public void sendMessage(String webhookUrl, String content)
    {
        if (Strings.isNullOrEmpty(webhookUrl) || Strings.isNullOrEmpty(content))
        {
            return;
        }

        String payload = "{\"content\":" + quote(content) + "}";
        RequestBody body = RequestBody.create(JSON, payload);
        Request request = new Request.Builder()
            .url(webhookUrl)
            .post(body)
            .build();

        executeAsync(request);
    }

    public void sendScreenshot(String webhookUrl, String content, BufferedImage image, String filename)
    {
        if (Strings.isNullOrEmpty(webhookUrl) || image == null)
        {
            return;
        }

        byte[] imageBytes;
        try
        {
            imageBytes = toPng(image);
        }
        catch (IOException ex)
        {
            log.warn("Unable to encode screenshot for Discord", ex);
            return;
        }

        String payload = Strings.isNullOrEmpty(content) ? "{}" : "{\"content\":" + quote(content) + "}";

        String resolvedName;
        if (Strings.isNullOrEmpty(filename))
        {
            resolvedName = "screenshot.png";
        }
        else if (filename.toLowerCase().endsWith(".png"))
        {
            resolvedName = filename;
        }
        else
        {
            resolvedName = filename + ".png";
        }

        MultipartBody.Builder builder = new MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("payload_json", payload)
            .addFormDataPart("file", resolvedName, RequestBody.create(PNG, imageBytes));

        Request request = new Request.Builder()
            .url(webhookUrl)
            .post(builder.build())
            .build();

        executeAsync(request);
    }

    private void executeAsync(Request request)
    {
        httpClient.newCall(request).enqueue(new Callback()
        {
            @Override
            public void onFailure(Call call, IOException e)
            {
                log.warn("Discord webhook call failed", e);
            }

            @Override
            public void onResponse(Call call, Response response)
            {
                try (response)
                {
                    if (!response.isSuccessful())
                    {
                        log.warn("Discord webhook returned status {}", response.code());
                    }
                }
            }
        });
    }

    private static byte[] toPng(BufferedImage image) throws IOException
    {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream())
        {
            ImageIO.write(image, "png", outputStream);
            return outputStream.toByteArray();
        }
    }

    private static String quote(String text)
    {
        StringBuilder builder = new StringBuilder("\"");
        for (char ch : text.toCharArray())
        {
            switch (ch)
            {
                case '\\':
                case '"':
                    builder.append('\\').append(ch);
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
                default:
                    builder.append(ch);
            }
        }
        builder.append('"');
        return builder.toString();
    }
}
