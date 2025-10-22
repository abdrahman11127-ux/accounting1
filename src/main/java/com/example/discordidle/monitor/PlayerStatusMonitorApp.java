package com.example.discordidle.monitor;

import com.example.discordidle.GsonFactory;
import com.example.discordidle.PlayerStatusUpdate;
import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.awt.BorderLayout;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.Executors;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.WindowConstants;

/**
 * Standalone desktop application that aggregates player activity updates from
 * multiple RuneLite clients.
 */
public final class PlayerStatusMonitorApp
{
    private PlayerStatusMonitorApp()
    {
    }

    public static void main(String[] args) throws IOException
    {
        MonitorOptions options = MonitorOptions.fromArgs(args);
        PlayerStatusMonitor monitor = new PlayerStatusMonitor(options);
        startHttpServer(options, monitor);
        createUi(options, monitor);
    }

    private static void startHttpServer(MonitorOptions options, PlayerStatusMonitor monitor) throws IOException
    {
        HttpServer server = HttpServer.create(new InetSocketAddress(options.port()), 0);
        Gson gson = GsonFactory.create();
        server.createContext("/status", new StatusHandler(monitor, gson));
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
    }

    private static void createUi(MonitorOptions options, PlayerStatusMonitor monitor)
    {
        SwingUtilities.invokeLater(() ->
        {
            JFrame frame = new JFrame("RuneLite Activity Monitor");
            PlayerStatusTableModel model = new PlayerStatusTableModel(monitor);
            JTable table = new JTable(model);
            table.setFillsViewportHeight(true);
            table.setAutoCreateRowSorter(true);
            frame.setLayout(new BorderLayout());
            frame.add(new JScrollPane(table), BorderLayout.CENTER);

            StringBuilder statusText = new StringBuilder("Listening on port ")
                .append(options.port());
            if (options.discordWebhookUrl() != null)
            {
                statusText.append(" | Discord alerts enabled");
            }
            JLabel statusLabel = new JLabel(statusText.toString());
            frame.add(statusLabel, BorderLayout.SOUTH);

            frame.setSize(720, 420);
            frame.setLocationRelativeTo(null);
            frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
            frame.setVisible(true);

            Timer timer = new Timer(1000, e -> model.tick());
            timer.start();
        });
    }

    private static final class StatusHandler implements HttpHandler
    {
        private final PlayerStatusMonitor monitor;
        private final Gson gson;

        private StatusHandler(PlayerStatusMonitor monitor, Gson gson)
        {
            this.monitor = monitor;
            this.gson = gson;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException
        {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod()))
            {
                respond(exchange, 405, "Method Not Allowed");
                return;
            }

            PlayerStatusUpdate update;
            try (InputStreamReader reader = new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8))
            {
                update = gson.fromJson(reader, PlayerStatusUpdate.class);
            }
            catch (Exception ex)
            {
                respond(exchange, 400, "Invalid JSON");
                return;
            }

            if (update == null || update.getPlayer() == null || update.getState() == null)
            {
                respond(exchange, 400, "Missing fields");
                return;
            }

            if (update.getTimestamp() == null)
            {
                update.setTimestamp(Instant.now());
            }

            monitor.onUpdate(update, Instant.now());
            respond(exchange, 200, "OK");
        }

        private void respond(HttpExchange exchange, int statusCode, String message) throws IOException
        {
            byte[] payload = message.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(statusCode, payload.length);
            try (OutputStream output = exchange.getResponseBody())
            {
                output.write(payload);
            }
        }
    }
}
