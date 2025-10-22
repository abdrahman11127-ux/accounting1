package com.example.discordidle.monitor;

import com.example.discordidle.PlayerActivityState;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import javax.swing.SwingUtilities;
import javax.swing.table.AbstractTableModel;

final class PlayerStatusTableModel extends AbstractTableModel
{
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss")
        .withZone(ZoneId.systemDefault());

    private final PlayerStatusMonitor monitor;
    private volatile List<PlayerStatusRecord> rows = List.of();

    PlayerStatusTableModel(PlayerStatusMonitor monitor)
    {
        this.monitor = monitor;
        this.rows = new ArrayList<>(monitor.snapshot());
        monitor.addListener(this::refreshFromMonitor);
    }

    @Override
    public int getRowCount()
    {
        return rows.size();
    }

    @Override
    public int getColumnCount()
    {
        return 5;
    }

    @Override
    public String getColumnName(int column)
    {
        switch (column)
        {
            case 0:
                return "Player";
            case 1:
                return "State";
            case 2:
                return "Idle";
            case 3:
                return "World";
            case 4:
                return "Last update";
            default:
                return super.getColumnName(column);
        }
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex)
    {
        if (rowIndex < 0 || rowIndex >= rows.size())
        {
            return "";
        }

        PlayerStatusRecord record = rows.get(rowIndex);
        Instant now = Instant.now();
        switch (columnIndex)
        {
            case 0:
                return record.getPlayer();
            case 1:
                return describeState(record.getState());
            case 2:
                long idleSeconds = record.computeIdleSeconds(now);
                return idleSeconds == 0 ? "-" : PlayerStatusMonitor.formatDuration(idleSeconds);
            case 3:
                Integer world = record.getWorld();
                return world == null ? "-" : world;
            case 4:
                Instant last = record.getLastUpdate();
                return last == null ? "-" : TIME_FORMATTER.format(last);
            default:
                return "";
        }
    }

    void tick()
    {
        if (rows.isEmpty())
        {
            return;
        }
        SwingUtilities.invokeLater(() -> fireTableRowsUpdated(0, rows.size() - 1));
    }

    private void refreshFromMonitor()
    {
        List<PlayerStatusRecord> snapshot = new ArrayList<>(monitor.snapshot());
        SwingUtilities.invokeLater(() ->
        {
            rows = snapshot;
            fireTableDataChanged();
        });
    }

    private static String describeState(PlayerActivityState state)
    {
        if (state == null)
        {
            return "Unknown";
        }

        switch (state)
        {
            case ACTIVE:
                return "Working";
            case IDLE:
                return "Idle";
            case LOGGED_OUT:
                return "Logged out";
            default:
                return state.name();
        }
    }
}
