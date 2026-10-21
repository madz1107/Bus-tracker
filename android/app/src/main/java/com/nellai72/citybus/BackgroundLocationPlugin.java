package com.nellai72.citybus;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundLocation")
public class BackgroundLocationPlugin extends Plugin {
    private static BackgroundLocationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void notifyLocation(double lat, double lng, float speed, float bearing) {
        if (instance != null) {
            JSObject ret = new JSObject();
            ret.put("lat", lat);
            ret.put("lng", lng);
            ret.put("speed", speed);
            ret.put("bearing", bearing);
            instance.notifyListeners("onLocation", ret);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        String busId = call.getString("busId", "BUS-1");
        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.setAction("START");
        intent.putExtra("busId", busId);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), LocationForegroundService.class);
        intent.setAction("STOP");
        getContext().stopService(intent);
        call.resolve();
    }
}
