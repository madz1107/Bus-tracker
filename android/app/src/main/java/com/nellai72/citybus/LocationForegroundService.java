package com.nellai72.citybus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocationForegroundService extends Service {
    private static final String TAG = "Nellai72GpsService";
    private static final String CHANNEL_ID = "nellai72_live_trip_channel";
    private static final int NOTIFICATION_ID = 7272;

    private static final String SUPABASE_BASE_URL = "https://yvjfcmjmlcuzxscvuzhm.supabase.co/rest/v1/buses";
    private static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2amZjbWptbGN1enhzY3Z1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjU3MzUsImV4cCI6MjEwNzgwMTczNX0.dZ7IL_sySbvIYApMWVkWJZN4gMKkufbIZqOicO9uIXQ";

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationManager locationManager;
    private LocationListener fallbackListener;

    private PowerManager.WakeLock wakeLock;
    private ExecutorService networkExecutor;
    private String currentBusId = "BUS-1";
    private boolean isTracking = false;

    @Override
    public void onCreate() {
        super.onCreate();
        networkExecutor = Executors.newSingleThreadExecutor();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nellai72:LocationWakeLock");
            wakeLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP".equals(action)) {
                stopTracking();
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }

            String busId = intent.getStringExtra("busId");
            if (busId != null && !busId.isEmpty()) {
                currentBusId = busId;
            }
        }

        startForegroundNotification();
        startTracking();

        return START_STICKY;
    }

    private void startForegroundNotification() {
        createNotificationChannel();

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nellai72 City Bus Tracker")
            .setContentText("Live GPS broadcast active • Bus: " + currentBusId)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            Log.i(TAG, "startForeground initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "startForeground error: " + e.getMessage(), e);
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception e2) {
                Log.e(TAG, "Fallback startForeground failed: " + e2.getMessage(), e2);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Nellai72 Bus Live Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps real-time bus GPS active when screen is off or app is minimized");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startTracking() {
        if (isTracking) return;
        isTracking = true;

        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire();
        }

        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
                .setMinUpdateIntervalMillis(2000)
                .setMaxUpdateDelayMillis(5000)
                .build();

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult locationResult) {
                    if (locationResult == null) return;
                    for (Location location : locationResult.getLocations()) {
                        handleNewLocation(location);
                    }
                }
            };

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing: " + se.getMessage());
        }

        // Native Android LocationManager GPS fallback
        try {
            if (locationManager != null && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                fallbackListener = new LocationListener() {
                    @Override
                    public void onLocationChanged(Location location) {
                        handleNewLocation(location);
                    }
                    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
                    @Override public void onProviderEnabled(String provider) {}
                    @Override public void onProviderDisabled(String provider) {}
                };
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 3000, 0, fallbackListener);
            }
        } catch (SecurityException se) {
            Log.w(TAG, "GPS Provider permission notice: " + se.getMessage());
        }
    }

    private void stopTracking() {
        isTracking = false;

        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }

        if (locationManager != null && fallbackListener != null) {
            locationManager.removeUpdates(fallbackListener);
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        // Send trip ended status to Supabase
        sendOfflineStatusToSupabase();
    }

    private void handleNewLocation(Location location) {
        if (location == null) return;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float speedKmh = Math.round(location.hasSpeed() ? location.getSpeed() * 3.6f : 0);
        float bearing = location.hasBearing() ? location.getBearing() : 0;

        // 1. Notify web app if alive
        BackgroundLocationPlugin.notifyLocation(lat, lng, speedKmh, bearing);

        // 2. Transmit directly to Supabase Cloud in background thread
        if (networkExecutor != null && !networkExecutor.isShutdown()) {
            networkExecutor.execute(() -> sendLocationToSupabase(lat, lng, speedKmh, bearing));
        }
    }

    private void sendLocationToSupabase(double lat, double lng, float speed, float bearing) {
        try {
            String isoTimestamp = getIsoTimestamp();
            String jsonPayload = "{"
                + "\"lat\":" + lat + ","
                + "\"lng\":" + lng + ","
                + "\"speed\":" + speed + ","
                + "\"bearing\":" + bearing + ","
                + "\"status\":\"Running\","
                + "\"is_trip_active\":true,"
                + "\"last_updated\":\"" + isoTimestamp + "\""
                + "}";

            String urlStr = SUPABASE_BASE_URL + "?id=eq." + currentBusId;
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "return=minimal");
            conn.setDoOutput(true);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            conn.disconnect();
        } catch (Exception e) {
            Log.w(TAG, "Background location push notice: " + e.getMessage());
        }
    }

    private void sendOfflineStatusToSupabase() {
        if (networkExecutor == null || networkExecutor.isShutdown()) return;
        networkExecutor.execute(() -> {
            try {
                String isoTimestamp = getIsoTimestamp();
                String jsonPayload = "{"
                    + "\"status\":\"Offline\","
                    + "\"is_trip_active\":false,"
                    + "\"speed\":0,"
                    + "\"last_updated\":\"" + isoTimestamp + "\""
                    + "}";

                String urlStr = SUPABASE_BASE_URL + "?id=eq." + currentBusId;
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Prefer", "return=minimal");
                conn.setDoOutput(true);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        });
    }

    private String getIsoTimestamp() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    @Override
    public void onDestroy() {
        stopTracking();
        if (networkExecutor != null) {
            networkExecutor.shutdown();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
