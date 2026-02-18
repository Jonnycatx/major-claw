mod commands;

use std::process::Child;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Default)]
struct GatewayState {
    child: Mutex<Option<Child>>,
}

fn main() {
    tauri::Builder::default()
        .manage(GatewayState::default())
        .setup(|app| {
            let gateway_state = app.state::<GatewayState>();
            if let Err(error) = commands::auto_start_gateway(gateway_state.inner()) {
                eprintln!("failed to auto-start gateway on launch: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_gateway,
            commands::stop_gateway,
            commands::gateway_status,
            commands::gateway_health,
            commands::list_agents,
            commands::create_agent,
            commands::reorder_agents,
            commands::update_agent_config,
            commands::get_agent_config,
            commands::chat_threads,
            commands::chat_summary,
            commands::chat_messages,
            commands::chat_send,
            commands::chat_quick_action,
            commands::run_agent_quick_action,
            commands::get_agent_logs,
            commands::test_agent_connection,
            commands::get_integrations,
            commands::get_integration_status,
            commands::connect_integration,
            commands::get_connected_model_providers,
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
            commands::audit_logs
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}

