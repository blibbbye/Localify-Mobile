const fs=require("fs");
const path=require("path");

const root=process.cwd();
const android=path.join(root,"android");
if(!fs.existsSync(android)) throw new Error("Android project was not generated.");

const appSrc=path.join(android,"app","src","main");
const manifestPath=path.join(appSrc,"AndroidManifest.xml");

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let manifest=fs.readFileSync(manifestPath,"utf8");
const mainActivity=walk(appSrc).find(p=>/MainActivity\.(java|kt)$/.test(p));
if(!mainActivity) throw new Error("MainActivity.java/kt not found.");
if(!mainActivity.endsWith(".java")) throw new Error("Expected a Java MainActivity from Capacitor.");

let source=fs.readFileSync(mainActivity,"utf8");
const pkg=(source.match(/^\s*package\s+([A-Za-z0-9_.]+)\s*;/m)||[])[1];
if(!pkg) throw new Error("Could not determine Android package name.");

// Add the playback foreground service.
const servicePath=path.join(path.dirname(mainActivity),"LocalifyPlaybackService.java");
const service=`package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public final class LocalifyPlaybackService extends Service {
    private static final int NOTIFICATION_ID = 7001;
    private static final String CHANNEL_ID = "localify_playback";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    private Notification buildNotification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pending = null;
        if (launch != null) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            pending = PendingIntent.getActivity(this, 0, launch, flags);
        }

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        b.setContentTitle("Localify Mobile")
         .setContentText("Localify playback active")
         .setSmallIcon(android.R.drawable.ic_media_play)
         .setOngoing(true)
         .setCategory(Notification.CATEGORY_TRANSPORT);

        if (pending != null) b.setContentIntent(pending);
        return b.build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel c = new NotificationChannel(
            CHANNEL_ID,
            "Localify playback",
            NotificationManager.IMPORTANCE_LOW
        );
        c.setDescription("Keeps Localify playback active in the background.");
        NotificationManager m = getSystemService(NotificationManager.class);
        if (m != null) m.createNotificationChannel(c);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
`;
fs.writeFileSync(servicePath,service,"utf8");

// Add the Android 8+ foreground-service permissions.
const manifestPermissions=[
  "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\" />",
  "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK\" />",
  "    <uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\" />"
].join("\n");

const missingPermissions=[];
for(const line of manifestPermissions.split("\n")){
  const match=line.match(/android:name="([^"]+)"/);
  if(match && !manifest.includes(match[1])) missingPermissions.push(line);
}
if(missingPermissions.length){
  const insert=missingPermissions.join("\n");
  manifest=manifest.replace(/(<manifest[^>]*>)/,m=>m+"\n"+insert);
}

if(!manifest.includes("LocalifyPlaybackService")){
  manifest=manifest.replace(
    /\s*<\/application>/,
    "\n        <service android:name=\".LocalifyPlaybackService\" android:exported=\"false\" android:foregroundServiceType=\"mediaPlayback\" />\n    </application>"
  );
}
fs.writeFileSync(manifestPath,manifest,"utf8");

// Add the small JS bridge used by index.html for audio focus/background playback.
if(!source.includes('"LocalifyNative"')){
  const imports=[
    "import android.content.Intent;",
    "import android.media.AudioAttributes;",
    "import android.media.AudioFocusRequest;",
    "import android.media.AudioManager;",
    "import android.os.Build;",
    "import android.webkit.JavascriptInterface;"
  ];
  const pkgMatch=source.match(/^\s*package\s+[A-Za-z0-9_.]+\s*;\s*/m);
  if(!pkgMatch) throw new Error("Could not locate MainActivity package line.");

  const missing=imports.filter(x=>!source.includes(x));
  if(missing.length) source=source.replace(pkgMatch[0],pkgMatch[0]+missing.join("\n")+"\n");

  const classPos=source.indexOf("public class MainActivity extends BridgeActivity");
  const open=classPos>=0?source.indexOf("{",classPos):-1;
  if(open<0) throw new Error("MainActivity class body not found.");

  const bridge=`
    private AudioManager localifyAudioManager;
    private AudioFocusRequest localifyFocusRequest;

    private final AudioManager.OnAudioFocusChangeListener localifyFocusListener =
        new AudioManager.OnAudioFocusChangeListener() {
            @Override public void onAudioFocusChange(int change) {
                if(change == AudioManager.AUDIOFOCUS_GAIN) {
                    dispatchLocalifyFocus(true, true);
                } else if(change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                          change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                    dispatchLocalifyFocus(false, true);
                } else if(change == AudioManager.AUDIOFOCUS_LOSS) {
                    dispatchLocalifyFocus(false, false);
                }
            }
        };

    private void requestLocalifyAudioFocus() {
        localifyAudioManager = (AudioManager)getSystemService(AUDIO_SERVICE);
        if(localifyAudioManager == null) return;

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();

        if(Build.VERSION.SDK_INT >= 26) {
            localifyFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setOnAudioFocusChangeListener(localifyFocusListener)
                .setWillPauseWhenDucked(false)
                .build();
            localifyAudioManager.requestAudioFocus(localifyFocusRequest);
        } else {
            localifyAudioManager.requestAudioFocus(
                localifyFocusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }

    private void abandonLocalifyAudioFocus() {
        if(localifyAudioManager == null) return;
        if(Build.VERSION.SDK_INT >= 26 && localifyFocusRequest != null) {
            localifyAudioManager.abandonAudioFocusRequest(localifyFocusRequest);
        } else {
            localifyAudioManager.abandonAudioFocus(localifyFocusListener);
        }
    }

    private void dispatchLocalifyFocus(boolean gained, boolean transientFocus) {
        try {
            if(getBridge() != null && getBridge().getWebView() != null) {
                String js = "window.__localifyAudioFocus&&window.__localifyAudioFocus(" + gained + "," + transientFocus + ")";
                getBridge().getWebView().post(() ->
                    getBridge().getWebView().evaluateJavascript(js, null)
                );
            }
        } catch(Exception ignored) {}
    }

    private void attachLocalifyPlaybackBridge() {
        if(getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void startPlaybackService() {
                requestLocalifyAudioFocus();
                Intent i = new Intent(MainActivity.this, LocalifyPlaybackService.class);
                if(Build.VERSION.SDK_INT >= 26) startForegroundService(i);
                else startService(i);
            }

            @JavascriptInterface
            public void stopPlaybackService() {
                abandonLocalifyAudioFocus();
                stopService(new Intent(MainActivity.this, LocalifyPlaybackService.class));
            }
        }, "LocalifyNative");
    }

    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        attachLocalifyPlaybackBridge();

        if(Build.VERSION.SDK_INT >= 33 &&
           checkSelfPermission("android.permission.POST_NOTIFICATIONS") !=
           android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[]{"android.permission.POST_NOTIFICATIONS"},
                701
            );
        }
    }

    @Override
    public void onDestroy() {
        abandonLocalifyAudioFocus();
        super.onDestroy();
    }
`;

  source=source.slice(0,open+1)+bridge+source.slice(open+1);
  fs.writeFileSync(mainActivity,source,"utf8");
}

console.log("Localify Mobile Android native playback setup complete.");
