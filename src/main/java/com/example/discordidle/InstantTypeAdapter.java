package com.example.discordidle;

import com.google.gson.TypeAdapter;
import com.google.gson.stream.JsonReader;
import com.google.gson.stream.JsonToken;
import com.google.gson.stream.JsonWriter;
import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * Gson adapter that serialises {@link Instant} as ISO-8601 strings.
 */
public class InstantTypeAdapter extends TypeAdapter<Instant>
{
    @Override
    public void write(JsonWriter out, Instant value) throws IOException
    {
        if (value == null)
        {
            out.nullValue();
            return;
        }
        out.value(value.toString());
    }

    @Override
    public Instant read(JsonReader in) throws IOException
    {
        if (in.peek() == JsonToken.NULL)
        {
            in.nextNull();
            return null;
        }

        String value = in.nextString();
        if (value == null || value.isEmpty())
        {
            return null;
        }

        try
        {
            return Instant.parse(value);
        }
        catch (DateTimeParseException ex)
        {
            return null;
        }
    }
}
