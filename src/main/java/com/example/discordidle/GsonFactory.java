package com.example.discordidle;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.time.Instant;

/**
 * Centralises Gson configuration shared across plugin and monitor code.
 */
public final class GsonFactory
{
    private GsonFactory()
    {
    }

    public static Gson create()
    {
        return new GsonBuilder()
            .registerTypeAdapter(Instant.class, new InstantTypeAdapter())
            .create();
    }
}
