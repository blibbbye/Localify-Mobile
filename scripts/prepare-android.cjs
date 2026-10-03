const fs=require("fs");
const path=require("path");
const root=process.cwd();
const android=path.join(root,"android");
if(!fs.existsSync(android)) throw new Error("Android project was not generated.");
const appSrc=path.join(android,"app","src","main");
const manifestPath=path.join(appSrc,"AndroidManifest.xml");
let manifest=fs.readFileSync(manifestPath,"utf8");
function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
const mainActivity=walk(appSrc).find(p=>/MainActivity\\.(java|kt)$/.test(p));
if(!mainActivity) throw new Error("MainActivity.java/kt not found.");
if(!mainActivity.endsWith(".java")) throw new Error("Expected Java MainActivity from Capacitor.");
const source=fs.readFileSync(mainActivity,"utf8");
const pkg=(source.match(/^\\s*package\\s+([A-Za-z0-9_.]+)\\s*;/m)||[])[1];
if(!pkg) throw new Error("Could not determine Android package name.");
const servicePath=path.join(path.dirname(mainActivity),"LocalifyPlaybackService.java");
const service =
"package "+pkg+";\\n"+
"import android.app.Notification;\\n"+
"import android.app.NotificationChannel;\\n"+
"import android.app.NotificationManager;\\n"+
"import android.app.PendingIntent;\\n"+
"import android.app.Service;\\n"+
"import android.content.Intent;\\n"+
"import android.os.Build;\\n"+
"import android.os.IBinder;\\n"+
"public final class LocalifyPlaybackService extends Service {\\n"+
" private static final int NOTIFICATION_ID=7001;\\n"+
" private static final String CHANNEL_ID=\"localify_playback\";\\n"+
" @Override public void onCreate(){super.onCreate();createChannel();startForeground(NOTIFICATION_ID,buildNotification());}\\n"+
" @Override public int onStartCommand(Intent intent,int flags,int startId){startForeground(NOTIFICATION_ID,buildNotification());return START_STICKY;}\\n"+
" private Notification buildNotification(){Intent launch=getPackageManager().getLaunchIntentForPackage(getPackageName());PendingIntent pending=null;if(launch!=null)pending=PendingIntent.getActivity(this,0,launch,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_ID):new Notification.Builder(this);b.setContentTitle(\"Localify Mobile\").setContentText(\"Playing your local music\").setSmallIcon(android.R.drawable.ic_media_play).setOngoing(true).setCategory(Notification.CATEGORY_TRANSPORT);if(pending!=null)b.setContentIntent(pending);return b.build();}\\n"+
" private void createChannel(){if(Build.VERSION.SDK_INT<26)return;NotificationChannel c=new NotificationChannel(CHANNEL_ID,\"Localify playback\",NotificationManager.IMPORTANCE_LOW);c.setDescription(\"Keeps Localify playback active in the background.\");NotificationManager m=getSystemService(NotificationManager.class);if(m!=null)m.createNotificationChannel(c);}\\n"+
" @Override public IBinder onBind(Intent intent){return null;}\\n"+
"}\\n";
fs.writeFileSync(servicePath,service,"utf8");
if(!manifest.includes("android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK")){
  manifest=manifest.replace(/(<manifest[^>]*>)/,"$1\\n    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\" />\\n    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK\" />\\n    <uses-permission android:name=\"android.permission.POST_NOTIFICATIONS\" />");
}
if(!manifest.includes("LocalifyPlaybackService")){
  manifest=manifest.replace(/\\s*<\\/application>/,"\\n        <service android:name=\".LocalifyPlaybackService\" android:exported=\"false\" android:foregroundServiceType=\"mediaPlayback\" />\\n    </application>");
}
fs.writeFileSync(manifestPath,manifest,"utf8");
if(!source.includes("LocalifyNative")){
  let activity=source;
  activity=activity.replace(/(package [^;]+;\\n)/,"$1\\nimport android.content.Intent;\\nimport android.os.Build;\\nimport android.webkit.JavascriptInterface;\\n");
  const open=activity.indexOf("{",activity.indexOf("class MainActivity"));
  if(open<0) throw new Error("MainActivity class body not found.");
  const bridge=
"\\n private void attachLocalifyPlaybackBridge(){\\n"+
"  if(getBridge()==null||getBridge().getWebView()==null)return;\\n"+
"  getBridge().getWebView().addJavascriptInterface(new Object(){\\n"+
"   @JavascriptInterface public void startPlaybackService(){Intent i=new Intent(MainActivity.this,LocalifyPlaybackService.class);if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);}\\n"+
"   @JavascriptInterface public void stopPlaybackService(){stopService(new Intent(MainActivity.this,LocalifyPlaybackService.class));}\\n"+
"  },\"LocalifyNative\");\\n"+
" }\\n"+
" @Override protected void onCreate(android.os.Bundle savedInstanceState){super.onCreate(savedInstanceState);attachLocalifyPlaybackBridge();if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(\"android.permission.POST_NOTIFICATIONS\")!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{\"android.permission.POST_NOTIFICATIONS\"},701);}\\n";
  activity=activity.slice(0,open+1)+bridge+activity.slice(open+1);
  fs.writeFileSync(mainActivity,activity,"utf8");
}
console.log("Localify Mobile Android background playback setup complete.");