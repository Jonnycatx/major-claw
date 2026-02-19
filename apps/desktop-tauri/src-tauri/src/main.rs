mod commands;

use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::Manager;

struct GatewayState {
    child: Mutex<Option<Child>>,
    desired_running: AtomicBool,
    app_closing: AtomicBool,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            desired_running: AtomicBool::new(true),
            app_closing: AtomicBool::new(false),
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(GatewayState::default())
        .setup(|app| {
            let gateway_state = app.state::<GatewayState>();
            if let Err(error) = commands::auto_start_gateway(gateway_state.inner()) {
                eprintln!("failed to auto-start gateway on launch: {error}");
            }
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    let state = app_handle.state::<GatewayState>();
                    if state.app_closing.load(Ordering::SeqCst) {
                        break;
                    }
                    if !state.desired_running.load(Ordering::SeqCst) {
                        continue;
                    }
                    if let Err(error) = commands::auto_start_gateway(state.inner()) {
                        eprintln!("gateway watchdog restart attempt failed: {error}");
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<GatewayState>();
                if state.app_closing.swap(true, Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                state.desired_running.store(false, Ordering::SeqCst);
                let app_handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let gateway_state = app_handle.state::<GatewayState>();
                    let _ = commands::stop_gateway_for_exit(gateway_state.inner()).await;
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.close();
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_gateway,
            commands::stop_gateway,
            commands::gateway_daemon_status,
            commands::gateway_daemon_set_enabled,
            commands::gateway_daemon_start,
            commands::gateway_daemon_stop,
            commands::gateway_daemon_restart,
            commands::red_phone_shutdown,
            commands::open_official_integrations,
            commands::close_official_integrations,
            commands::back_official_integrations,
            commands::gateway_status,
            commands::gateway_session_token,
            commands::gateway_health,
            commands::list_agents,
            commands::list_tasks,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::create_agent,
            commands::reorder_agents,
            commands::update_agent_config,
            commands::get_agent_config,
            commands::chat_threads,
            commands::chat_summary,
            commands::chat_messages,
            commands::chat_send,
            commands::chat_quick_action,
            commands::chat_checkpoints,
            commands::chat_rewind,
            commands::get_budgets,
            commands::update_budget,
            commands::vault_summary,
            commands::vault_capacity,
            commands::vault_recent,
            commands::vault_search,
            commands::vault_deposit,
            commands::vault_prune,
            commands::vault_list_versions,
            commands::vault_update_entry,
            commands::vault_create_version,
            commands::vault_storage_info,
            commands::vault_relocate_storage,
            commands::run_agent_quick_action,
            commands::get_agent_logs,
            commands::test_agent_connection,
            commands::get_integrations,
            commands::get_integration_status,
            commands::connect_integration,
            commands::get_connected_model_providers,
            commands::mcp_list_servers,
            commands::mcp_register_server,
            commands::mcp_connect_server,
            commands::mcp_disconnect_server,
            commands::mcp_list_tools,
            commands::mcp_invoke_tool,
            commands::clawhub_search,
            commands::get_live_skills,
            commands::clawhub_install,
            commands::clawhub_list_installed,
            commands::clawhub_get_skill_details,
            commands::get_installed_skills,
            commands::toggle_skill,
            commands::permissions_request,
            commands::permissions_approve,
            commands::permissions_deny,
            commands::permissions_pending,
            commands::audit_logs,
            commands::get_health_snapshot,
            commands::get_health_events,
            commands::export_health_telemetry,
            commands::get_analytics_snapshot,
            commands::export_analytics_report
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}

