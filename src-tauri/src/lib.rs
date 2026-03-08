use std::process::Command;
use serde_json::Value;

fn exec(cmd: &str, args: &[&str]) -> String {
    Command::new(cmd)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

fn pw_dump() -> Value {
    let out = exec("pw-dump", &[]);
    serde_json::from_str(&out).unwrap_or(Value::Array(vec![]))
}

fn pactl_json(kind: &str) -> Value {
    let out = exec("pactl", &["--format=json", "list", kind]);
    serde_json::from_str(&out).unwrap_or(Value::Array(vec![]))
}

fn pactl_info() -> String {
    exec("pactl", &["info"])
}

fn default_sink() -> String {
    pactl_info()
        .lines()
        .find(|l| l.starts_with("Default Sink:"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn default_source() -> String {
    pactl_info()
        .lines()
        .find(|l| l.starts_with("Default Source:"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

// NUEVO: Lee el volumen nativo y sin lag de PipeWire
fn get_wpctl_vol_mute(id: i64) -> Option<(i64, bool)> {
    let out = exec("wpctl", &["get-volume", &id.to_string()]);
    let out = out.trim();
    if out.starts_with("Volume:") {
        let parts: Vec<&str> = out.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Ok(v_f) = parts[1].parse::<f64>() {
                let vol_i = (v_f * 100.0).round() as i64;
                let muted = out.contains("[MUTED]");
                return Some((vol_i, muted));
            }
        }
    }
    None
}

#[tauri::command]
fn get_sinks() -> Value {
    let nodes = pw_dump();
    let pa_sinks = pactl_json("sinks");
    let def = default_sink();
    let empty = vec![];

    let result: Vec<Value> = nodes.as_array().unwrap_or(&empty).iter()
        .filter(|n| {
            n["type"] == "PipeWire:Interface:Node" &&
                n["info"]["props"]["media.class"] == "Audio/Sink"
        })
        .map(|n| {
            let props = &n["info"]["props"];
            let node_name = props["node.name"].as_str().unwrap_or("");
            let node_id = n["id"].as_i64().unwrap_or(-1);

            let empty2 = vec![];
            let pa = pa_sinks.as_array().unwrap_or(&empty2).iter()
                .find(|s| s["name"].as_str().unwrap_or("") == node_name)
                .cloned()
                .unwrap_or(Value::Null);

            // Intentamos leer el estado instantáneo de wpctl, si falla usamos pactl
            let wpctl_state = get_wpctl_vol_mute(node_id);
            let vol = wpctl_state.map(|(v, _)| v).unwrap_or_else(|| {
                pa["volume"]["front-left"]["value_percent"]
                    .as_str().unwrap_or("100%").replace('%', "")
                    .parse::<f64>().unwrap_or(100.0) as i64
            });
            let muted = wpctl_state.map(|(_, m)| m).unwrap_or_else(|| {
                pa["mute"].as_bool().unwrap_or(false)
            });

            let empty3 = vec![];
            let ports: Vec<Value> = pa["ports"].as_array().unwrap_or(&empty3).iter().map(|p| {
                serde_json::json!({
                    "name": p["name"],
                    "description": p["description"],
                    "available": p["availability"].as_str().unwrap_or("") != "not available"
                })
            }).collect();

            serde_json::json!({
                "id": node_id,
                "name": props["node.description"].as_str().or(props["node.nick"].as_str()).or(props["node.name"].as_str()).unwrap_or("Unknown"),
                "nodeName": node_name,
                "volume": vol,
                "muted": muted,
                "isDefault": node_name == def,
                "ports": ports,
                "activePort": pa["active_port"]
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_sources() -> Value {
    let nodes = pw_dump();
    let pa_sources = pactl_json("sources");
    let def = default_source();
    let empty = vec![];

    let result: Vec<Value> = nodes.as_array().unwrap_or(&empty).iter()
        .filter(|n| {
            n["type"] == "PipeWire:Interface:Node" &&
                n["info"]["props"]["media.class"] == "Audio/Source" &&
                !n["info"]["props"]["node.name"].as_str().unwrap_or("").contains(".monitor")
        })
        .map(|n| {
            let props = &n["info"]["props"];
            let node_name = props["node.name"].as_str().unwrap_or("");
            let node_id = n["id"].as_i64().unwrap_or(-1);

            let empty2 = vec![];
            let pa = pa_sources.as_array().unwrap_or(&empty2).iter()
                .find(|s| s["name"].as_str().unwrap_or("") == node_name)
                .cloned()
                .unwrap_or(Value::Null);

            let wpctl_state = get_wpctl_vol_mute(node_id);
            let vol = wpctl_state.map(|(v, _)| v).unwrap_or_else(|| {
                pa["volume"]["front-left"]["value_percent"]
                    .as_str().unwrap_or("100%").replace('%', "")
                    .parse::<f64>().unwrap_or(100.0) as i64
            });
            let muted = wpctl_state.map(|(_, m)| m).unwrap_or_else(|| {
                pa["mute"].as_bool().unwrap_or(false)
            });

            let empty3 = vec![];
            let ports: Vec<Value> = pa["ports"].as_array().unwrap_or(&empty3).iter().map(|p| {
                serde_json::json!({ "name": p["name"], "description": p["description"] })
            }).collect();

            serde_json::json!({
                "id": node_id,
                "name": props["node.description"].as_str().or(props["node.nick"].as_str()).or(props["node.name"].as_str()).unwrap_or("Unknown"),
                "nodeName": node_name,
                "volume": vol,
                "muted": muted,
                "isDefault": node_name == def,
                "ports": ports,
                "activePort": pa["active_port"]
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_sink_inputs() -> Value {
    let inputs = pactl_json("sink-inputs");
    let sinks = pactl_json("sinks");
    let empty = vec![];

    let result: Vec<Value> = inputs.as_array().unwrap_or(&empty).iter().map(|i| {
        let app_name = i["properties"]["application.name"].as_str().or(i["properties"]["media.name"].as_str()).unwrap_or("Unknown");
        let vol = i["volume"]["front-left"]["value_percent"].as_str().unwrap_or("100%").replace('%', "").parse::<f64>().unwrap_or(100.0) as i64;
        let sink_idx = i["sink"].as_i64().unwrap_or(-1);
        let empty2 = vec![];
        let sink_name = sinks.as_array().unwrap_or(&empty2).iter().find(|s| s["index"].as_i64().unwrap_or(-2) == sink_idx).and_then(|s| s["name"].as_str()).unwrap_or("");

        serde_json::json!({
            "id": i["index"],
            "appName": app_name,
            "mediaName": i["properties"]["media.name"],
            "volume": vol,
            "muted": i["mute"].as_bool().unwrap_or(false),
            "sinkIndex": sink_idx,
            "sinkName": sink_name,
            "corked": i["corked"].as_bool().unwrap_or(false)
        })
    }).collect();

    Value::Array(result)
}

#[tauri::command]
fn get_source_outputs() -> Value {
    let outputs = pactl_json("source-outputs");
    let empty = vec![];

    let result: Vec<Value> = outputs.as_array().unwrap_or(&empty).iter().map(|o| {
        let app_name = o["properties"]["application.name"].as_str().or(o["properties"]["media.name"].as_str()).unwrap_or("Unknown");
        let vol = o["volume"]["front-left"]["value_percent"].as_str().unwrap_or("100%").replace('%', "").parse::<f64>().unwrap_or(100.0) as i64;

        serde_json::json!({
            "id": o["index"],
            "appName": app_name,
            "mediaName": o["properties"]["media.name"],
            "volume": vol,
            "muted": o["mute"].as_bool().unwrap_or(false),
            "sourceIndex": o["source"],
            "corked": o["corked"].as_bool().unwrap_or(false)
        })
    }).collect();

    Value::Array(result)
}

#[tauri::command]
fn get_cards() -> Value {
    let cards = pactl_json("cards");
    let empty = vec![];

    let result: Vec<Value> = cards.as_array().unwrap_or(&empty).iter().map(|c| {
        let empty_map = serde_json::Map::new();
        let mut profiles: Vec<Value> = c["profiles"].as_object().unwrap_or(&empty_map).iter().map(|(name, p)| {
            serde_json::json!({
                    "name": name,
                    "description": p["description"],
                    "available": p["available"].as_str().unwrap_or("") != "no",
                    "priority": p["priority"].as_i64().unwrap_or(0)
                })
        }).collect();
        profiles.sort_by(|a, b| b["priority"].as_i64().unwrap_or(0).cmp(&a["priority"].as_i64().unwrap_or(0)));

        serde_json::json!({
            "id": c["index"],
            "name": c["name"],
            "description": c["properties"]["device.description"].as_str().unwrap_or(c["name"].as_str().unwrap_or("")),
            "driver": c["properties"]["device.api"],
            "activeProfile": c["active_profile"],
            "profiles": profiles
        })
    }).collect();

    Value::Array(result)
}

// VOLVEMOS A WPCTL: usa IDs, rápido y confiable para HW
#[tauri::command]
fn set_volume(id: i64, volume: i64) -> bool {
    let vol = (volume as f64 / 100.0).clamp(0.0, 1.5);
    Command::new("wpctl").args(["set-volume", &id.to_string(), &format!("{:.2}", vol)]).status().is_ok()
}

#[tauri::command]
fn set_stream_volume(id: i64, volume: i64, kind: String) -> bool {
    let vol = format!("{}%", volume.clamp(0, 150));
    let subcmd = if kind == "source-output" { "set-source-output-volume" } else { "set-sink-input-volume" };
    Command::new("pactl").args([subcmd, &id.to_string(), &vol]).status().is_ok()
}

#[tauri::command]
fn set_mute(id: i64, mute: bool) -> bool {
    Command::new("wpctl").args(["set-mute", &id.to_string(), if mute { "1" } else { "0" }]).status().is_ok()
}

#[tauri::command]
fn set_stream_mute(id: i64, mute: bool, kind: String) -> bool {
    let subcmd = if kind == "source-output" { "set-source-output-mute" } else { "set-sink-input-mute" };
    Command::new("pactl").args([subcmd, &id.to_string(), if mute { "1" } else { "0" }]).status().is_ok()
}

#[tauri::command]
fn set_default(id: i64) -> bool {
    Command::new("wpctl").args(["set-default", &id.to_string()]).status().is_ok()
}

#[tauri::command]
fn move_stream(stream_id: i64, target_id: i64, kind: String) -> bool {
    let subcmd = if kind == "source-output" { "move-source-output" } else { "move-sink-input" };
    Command::new("pactl").args([subcmd, &stream_id.to_string(), &target_id.to_string()]).status().is_ok()
}

#[tauri::command]
fn set_port(device_name: String, port: String, kind: String) -> bool {
    let subcmd = if kind == "source" { "set-source-port" } else { "set-sink-port" };
    Command::new("pactl").args([subcmd, &device_name, &port]).status().is_ok()
}

#[tauri::command]
fn set_profile(card_name: String, profile: String) -> bool {
    Command::new("pactl").args(["set-card-profile", &card_name, &profile]).status().is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_sinks, get_sources, get_sink_inputs, get_source_outputs, get_cards,
            set_volume, set_stream_volume, set_mute, set_stream_mute,
            set_default, move_stream, set_port, set_profile
        ])
        .run(tauri::generate_context!())
        .expect("error running ArcheAudio");
}