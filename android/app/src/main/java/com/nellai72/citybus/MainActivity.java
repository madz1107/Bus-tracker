package com.nellai72.citybus;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Nellai72MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundLocationPlugin.class);
        super.onCreate(savedInstanceState);

        // 1. Auto-request all essential location & notification permissions on startup
        requestRequiredPermissions();

        // 2. Direct Android JavaScript Interface - 100% reliable execution from webview
        setupDirectGpsInterface();

        // 3. Early repeated flavor injections to ensure web page locks to dedicated portal immediately
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.postDelayed(this::injectFlavor, 150);
            webView.postDelayed(this::injectFlavor, 600);
            webView.postDelayed(this::injectFlavor, 1500);
        }
    }

    private void setupDirectGpsInterface() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void startGps(String busId) {
                        try {
                            String activeBusId = (busId != null && !busId.isEmpty()) ? busId : "BUS-1";
                            Intent intent = new Intent(MainActivity.this, LocationForegroundService.class);
                            intent.setAction("START");
                            intent.putExtra("busId", activeBusId);

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent);
                            } else {
                                startService(intent);
                            }
                            Log.i(TAG, "startGps foreground service triggered for bus: " + activeBusId);
                        } catch (Exception e) {
                            Log.e(TAG, "startGps failed: " + e.getMessage(), e);
                        }
                    }

                    @JavascriptInterface
                    public void stopGps() {
                        try {
                            Intent intent = new Intent(MainActivity.this, LocationForegroundService.class);
                            intent.setAction("STOP");
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent);
                            } else {
                                startService(intent);
                            }
                            Log.i(TAG, "stopGps foreground service STOP action dispatched");
                        } catch (Exception e) {
                            Log.e(TAG, "stopGps failed: " + e.getMessage(), e);
                        }
                    }

                    @JavascriptInterface
                    public String getFlavor() {
                        String pkg = getPackageName();
                        if (pkg.contains("passenger")) return "passenger";
                        if (pkg.contains("driver") || pkg.contains("bus")) return "Bus";
                        if (pkg.contains("admin")) return "admin";
                        return "all";
                    }

                    @JavascriptInterface
                    public boolean isNative() {
                        return true;
                    }
                }, "AndroidGpsService");
                Log.i(TAG, "AndroidGpsService interface successfully attached to WebView");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error attaching AndroidGpsService interface: " + e.getMessage());
        }
    }

    private void requestRequiredPermissions() {
        List<String> list = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            list.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            list.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                list.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!list.isEmpty()) {
            ActivityCompat.requestPermissions(this, list.toArray(new String[0]), 7201);
        } else {
            requestBackgroundLocationIfPossible();
        }
    }

    private void requestBackgroundLocationIfPossible() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, 7202);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 7201) {
            requestBackgroundLocationIfPossible();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        injectFlavor();
        setupDirectGpsInterface();
    }

    private void injectFlavor() {
        try {
            String pkg = getPackageName();
            String flavor = "all";
            if (pkg.contains("passenger")) {
                flavor = "passenger";
            } else if (pkg.contains("driver") || pkg.contains("bus")) {
                flavor = "Bus";
            } else if (pkg.contains("admin")) {
                flavor = "admin";
            }

            final String js = "window.APP_FLAVOR = '" + flavor + "'; "
                + "try { localStorage.setItem('citybus_app_flavor', '" + flavor + "'); } catch(e){} "
                + "if (window.app && window.app.applyAppFlavor) window.app.applyAppFlavor('" + flavor + "');";
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        } catch (Exception ignored) {}
    }
}
