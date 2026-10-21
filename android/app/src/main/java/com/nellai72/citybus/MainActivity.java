package com.nellai72.citybus;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        injectFlavor();
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

            final String js = "window.APP_FLAVOR = '" + flavor + "'; if (window.app && window.app.applyAppFlavor) window.app.applyAppFlavor('" + flavor + "');";
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(js, null));
            }
        } catch (Exception ignored) {}
    }
}
