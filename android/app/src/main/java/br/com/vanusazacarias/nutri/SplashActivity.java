package br.com.vanusazacarias.nutri;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

/**
 * SplashActivity - LAUNCHER único - 022-D
 * Ícone original: public/icon-512x512.png via drawable/splash_logo (fiel, sem redesenho)
 * Duração total ~2500ms, ritmo elegante conforme referência:
 * 0-500 entrada do ícone, 500-1000 desenvolvimento suave, 1000-1500 estabiliza,
 * 1500-2050 Vanusa Zacarias NUTRI, 2050-2350 slogan, 2350-2500 permanência -> MainActivity
 * API 31+ e API 30 compartilham mesmo PNG e mesma timeline (SplashScreen API apenas fundo branco).
 */
public class SplashActivity extends AppCompatActivity {

    private static final long TOTAL_DURATION_MS = 2500L;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        ImageView symbol = findViewById(R.id.splash_symbol);
        LinearLayout brandContainer = findViewById(R.id.brand_container);
        TextView slogan = findViewById(R.id.brand_slogan);

        // Estado inicial
        symbol.setAlpha(0f);
        symbol.setScaleX(0.92f);
        symbol.setScaleY(0.92f);
        brandContainer.setAlpha(0f);
        brandContainer.setTranslationY(16f);
        slogan.setAlpha(0f);
        slogan.setTranslationY(12f);

        // 0-500: entrada/revelação do ícone original (fade + scale suave)
        symbol.animate()
                .alpha(1f).scaleX(1f).scaleY(1f)
                .setDuration(500)
                .setInterpolator(new android.view.animation.DecelerateInterpolator())
                .start();

        // 500-1000: único pulso sutil "batimento" 1.00 -> 1.035 -> 1.00 (Decelerate, sem overshoot/bounce)
        handler.postDelayed(() -> symbol.animate()
                .scaleX(1.035f).scaleY(1.035f)
                .setDuration(250)
                .setInterpolator(new android.view.animation.DecelerateInterpolator())
                .withEndAction(() -> symbol.animate()
                        .scaleX(1f).scaleY(1f)
                        .setDuration(250)
                        .setInterpolator(new android.view.animation.DecelerateInterpolator())
                        .start())
                .start(), 500);

        // 1000-1500: ícone estabiliza (sem animação, apenas permanência)

        // 1500-2050: Vanusa Zacarias NUTRI (550ms)
        handler.postDelayed(() -> brandContainer.animate()
                .alpha(1f).translationY(0f)
                .setDuration(550)
                .setInterpolator(new android.view.animation.DecelerateInterpolator())
                .start(), 1500);

        // 2050-2350: slogan (300ms)
        handler.postDelayed(() -> slogan.animate()
                .alpha(1f).translationY(0f)
                .setDuration(300)
                .setInterpolator(new android.view.animation.DecelerateInterpolator())
                .start(), 2050);

        // 2500: transição suave para app
        handler.postDelayed(this::goToMain, TOTAL_DURATION_MS);
    }

    private void goToMain() {
        Intent intent = new Intent(SplashActivity.this, MainActivity.class);
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
