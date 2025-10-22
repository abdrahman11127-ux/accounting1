package com.example.discordidle;

import com.google.common.base.Strings;
import com.google.gson.Gson;
import java.io.IOException;
import javax.inject.Singleton;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Pushes {@link PlayerStatusUpdate} payloads to the local monitor application.
 */
@Singleton
public class StatusUpdateClient
{
    private static final Logger log = LoggerFactory.getLogger(StatusUpdateClient.class);
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    private final OkHttpClient httpClient = new OkHttpClient();
    private final Gson gson = GsonFactory.create();

    public void postStatus(String endpointUrl, PlayerStatusUpdate update)
    {
        if (Strings.isNullOrEmpty(endpointUrl) || update == null)
        {
            return;
        }

        RequestBody body = RequestBody.create(JSON, gson.toJson(update));
        Request request = new Request.Builder()
            .url(endpointUrl)
            .post(body)
            .build();

        httpClient.newCall(request).enqueue(new Callback()
        {
            @Override
            public void onFailure(Call call, IOException e)
            {
                log.debug("Failed to post status update to {}", endpointUrl, e);
            }

            @Override
            public void onResponse(Call call, Response response)
            {
                try (response)
                {
                    if (!response.isSuccessful())
                    {
                        log.debug("Monitor endpoint {} returned status {}", endpointUrl, response.code());
                    }
                }
            }
        });
    }
}
