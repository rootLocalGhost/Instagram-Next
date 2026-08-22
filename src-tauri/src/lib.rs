use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};
use tauri_plugin_notification::NotificationExt;

// Shared app state
#[derive(Default)]
pub struct AppState {
    pub unread_count: Arc<AtomicU32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationPayload {
    pub title: String,
    pub body: Option<String>,
    pub icon: Option<String>,
    pub tag: Option<String>,
    pub url: Option<String>,
}

// Command: Trigger native Windows notification
#[tauri::command]
fn trigger_native_notification(
    app: AppHandle,
    title: String,
    body: Option<String>,
    icon: Option<String>,
    tag: Option<String>,
    url: Option<String>,
) -> Result<(), String> {
    let payload = NotificationPayload {
        title: title.clone(),
        body: body.clone(),
        icon: icon.clone(),
        tag: tag.clone(),
        url: url.clone(),
    };

    // Emit event to SolidJS frontend so in-app drawer receives it
    let _ = app.emit("notification-received", &payload);

    // Build and send Windows native notification
    let mut builder = app
        .notification()
        .builder()
        .title(&title);

    if let Some(ref text) = body {
        builder = builder.body(text);
    }

    if let Some(ref icon_str) = icon {
        builder = builder.icon(icon_str);
    }

    if let Some(ref tag_str) = tag {
        // Tag grouping in supported notification systems
        builder = builder.extra("tag", tag_str.clone());
    }

    if let Some(ref target_url) = url {
        builder = builder.extra("url", target_url.clone());
    }

    builder.show().map_err(|e| e.to_string())?;
    Ok(())
}

// Command: Update unread badge counter
#[tauri::command]
fn update_unread_count(
    app: AppHandle,
    state: State<AppState>,
    count: u32,
) -> Result<(), String> {
    state.unread_count.store(count, Ordering::SeqCst);
    let _ = app.emit("unread-count-updated", count);
    Ok(())
}

// Command: Get current unread badge counter
#[tauri::command]
fn get_unread_count(state: State<AppState>) -> Result<u32, String> {
    Ok(state.unread_count.load(Ordering::SeqCst))
}

// Command: Toggle window always-on-top
#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Command: Send navigation or action to webview
#[tauri::command]
fn navigate_instagram(app: AppHandle, path: String) -> Result<(), String> {
    let target = if path.starts_with("http") {
        path
    } else {
        let clean = if path.starts_with('/') { &path[1..] } else { &path };
        format!("https://www.instagram.com/{}", clean)
    };

    let js = format!(
        "if (window.__INSTAGRAM_DESKTOP__) {{ window.__INSTAGRAM_DESKTOP__.navigate('{}'); }} else {{ window.location.href = '{}'; }}",
        target, target
    );

    if let Some(webview) = app.get_webview("instagram") {
        let _ = webview.eval(&js);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(&js);
    }
    Ok(())
}

// Command: Reload webview
#[tauri::command]
fn reload_instagram(app: AppHandle) -> Result<(), String> {
    let js = "if (window.__INSTAGRAM_DESKTOP__) { window.__INSTAGRAM_DESKTOP__.reload(); } else { window.location.reload(); }";
    if let Some(webview) = app.get_webview("instagram") {
        let _ = webview.eval(js);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(js);
    }
    Ok(())
}

// Command: History back
#[tauri::command]
fn go_back_instagram(app: AppHandle) -> Result<(), String> {
    let js = "if (window.__INSTAGRAM_DESKTOP__) { window.__INSTAGRAM_DESKTOP__.goBack(); } else { window.history.back(); }";
    if let Some(webview) = app.get_webview("instagram") {
        let _ = webview.eval(js);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(js);
    }
    Ok(())
}

// Command: History forward
#[tauri::command]
fn go_forward_instagram(app: AppHandle) -> Result<(), String> {
    let js = "if (window.__INSTAGRAM_DESKTOP__) { window.__INSTAGRAM_DESKTOP__.goForward(); } else { window.history.forward(); }";
    if let Some(webview) = app.get_webview("instagram") {
        let _ = webview.eval(js);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(js);
    }
    Ok(())
}

// Command: Set webview zoom
#[tauri::command]
fn set_instagram_zoom(app: AppHandle, zoom_factor: f64) -> Result<(), String> {
    if let Some(webview) = app.get_webview("instagram") {
        let _ = webview.set_zoom(zoom_factor);
    } else if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_zoom(zoom_factor);
    }
    Ok(())
}

// Injected JavaScript for Instagram
const INJECTED_INSTAGRAM_SCRIPT: &str = include_str!("../../src/scripts/instagram-injector.js");

// Modern Desktop Chrome User Agent
const DESKTOP_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            trigger_native_notification,
            update_unread_count,
            get_unread_count,
            set_always_on_top,
            navigate_instagram,
            reload_instagram,
            go_back_instagram,
            go_forward_instagram,
            set_instagram_zoom
        ])
        .setup(|app| {
            // Setup System Tray
            let open_item = MenuItem::with_id(app, "open", "Open Instagram", true, None::<&str>)?;
            let dms_item = MenuItem::with_id(app, "dms", "Direct Messages", true, None::<&str>)?;
            let test_notif_item = MenuItem::with_id(app, "test_notif", "Test Notification", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[&open_item, &dms_item, &test_notif_item, &quit_item],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("Instagram Desktop")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "dms" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        let _ = navigate_instagram(app.clone(), "/direct/inbox/".to_string());
                    }
                    "test_notif" => {
                        let _ = trigger_native_notification(
                            app.clone(),
                            "Instagram Desktop".to_string(),
                            Some("Windows notifications are active and connected!".to_string()),
                            None,
                            Some("test".to_string()),
                            Some("https://www.instagram.com/direct/inbox/".to_string()),
                        );
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(visible) = window.is_visible() {
                                if visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            // Setup Instagram Child Webview under the titlebar (y: 44px)
            if let Some(main_window) = app.get_window("main") {
                let window_size = main_window.inner_size().unwrap_or(tauri::PhysicalSize::new(1180, 840));
                let scale_factor = main_window.scale_factor().unwrap_or(1.0);
                let titlebar_height_logical = 44.0;

                let webview_builder = tauri::webview::WebviewBuilder::new(
                    "instagram",
                    tauri::WebviewUrl::External("https://www.instagram.com".parse().unwrap()),
                )
                .user_agent(DESKTOP_USER_AGENT)
                .initialization_script(INJECTED_INSTAGRAM_SCRIPT);

                let pos = tauri::LogicalPosition::new(0.0, titlebar_height_logical);
                let size = tauri::LogicalSize::new(
                    window_size.width as f64 / scale_factor,
                    (window_size.height as f64 / scale_factor) - titlebar_height_logical,
                );

                // Add child webview to main window
                match main_window.add_child(webview_builder, pos, size) {
                    Ok(child_webview) => {
                        let webview_clone = child_webview.clone();
                        let scale_clone = scale_factor;

                        // Listen for window resize to adjust child webview size dynamically
                        main_window.on_window_event(move |event| {
                            if let tauri::WindowEvent::Resized(new_size) = event {
                                let new_width_logical = new_size.width as f64 / scale_clone;
                                let new_height_logical = (new_size.height as f64 / scale_clone) - 44.0;
                                let _ = webview_clone.set_size(tauri::LogicalSize::new(
                                    new_width_logical,
                                    new_height_logical.max(100.0),
                                ));
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[Instagram Desktop] Failed to create child webview: {}", e);
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
