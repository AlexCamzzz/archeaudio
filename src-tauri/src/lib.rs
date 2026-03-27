// ─────────────────────────────────────────────────────────────
//  Global allocator — mimalloc is significantly faster than
//  the system allocator for the many small allocs PipeWire
//  data tends to produce.
// ─────────────────────────────────────────────────────────────
use tauri::Emitter;
use std::{
    collections::HashMap,
    io::{BufRead, BufReader},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use serde_json::Value;

// ─────────────────────────────────────────────────────────────
//  Helpers — thin wrappers around system calls
// ─────────────────────────────────────────────────────────────

fn exec(cmd: &str, args: &[&str]) -> String {
    Command::new(cmd)
        .args(args)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

fn pw_dump() -> Value {
    serde_json::from_str(&exec("pw-dump", &[])).unwrap_or(Value::Array(vec![]))
}

fn pactl_json(kind: &str) -> Value {
    serde_json::from_str(&exec("pactl", &["--format=json", "list", kind]))
        .unwrap_or(Value::Array(vec![]))
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

// Read volume/mute via wpctl — fastest path (no lag vs pactl).
fn get_wpctl_vol_mute(id: i64) -> Option<(i64, bool)> {
    let out = exec("wpctl", &["get-volume", &id.to_string()]);
    let out = out.trim();
    if out.starts_with("Volume:") {
        let parts: Vec<&str> = out.split_whitespace().collect();
        if let Some(Ok(v_f)) = parts.get(1).map(|s| s.parse::<f64>()) {
            let vol = (v_f * 100.0).round() as i64;
            let muted = out.contains("[MUTED]");
            return Some((vol, muted));
        }
    }
    None
}

// ─────────────────────────────────────────────────────────────
//  Event-driven subscribe loop
//
//  Replaces the 4-second frontend polling. A background thread
//  keeps `pactl subscribe` alive and emits "audio-changed"
//  events with the affected kind ("sink", "sink-input", etc.).
//  A 150 ms per-kind debounce collapses rapid bursts (e.g. a
//  volume drag that touches pactl state many times).
// ─────────────────────────────────────────────────────────────

fn parse_event_kind(line: &str) -> &'static str {
    if line.contains("sink-input")    { return "sink-input"; }
    if line.contains("source-output") { return "source-output"; }
    if line.contains("sink")          { return "sink"; }
    if line.contains("source")        { return "source"; }
    if line.contains("card")          { return "card"; }
    "server"
}

fn spawn_subscribe(app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("pactl-subscribe".into())
        .spawn(move || {
            // Per-kind debounce windows.
            // sink-input gets a longer window because apps like Spotify
            // fire rapid property-change events during playback (buffering,
            // gapless crossfade) that don't need an immediate UI refresh.
            let debounce_default     = Duration::from_millis(150);
            let debounce_sink_input  = Duration::from_millis(400);
            let debounce_src_output  = Duration::from_millis(400);

            let debounce_for = |kind: &str| -> Duration {
                match kind {
                    "sink-input"    => debounce_sink_input,
                    "source-output" => debounce_src_output,
                    _               => debounce_default,
                }
            };

            loop {
                let child = Command::new("pactl")
                    .arg("subscribe")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::null())
                    .spawn();

                let mut child = match child {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("pactl subscribe failed to start: {e}");
                        std::thread::sleep(Duration::from_secs(2));
                        continue;
                    }
                };

                let stdout = child.stdout.take().unwrap();
                let reader = BufReader::new(stdout);
                let mut last_emit: HashMap<&'static str, Instant> = HashMap::new();
                // Prime timers so first event always fires immediately.
                let epoch = Instant::now() - debounce_default * 2;

                for line in reader.lines().flatten() {
                    let kind     = parse_event_kind(&line);
                    let now      = Instant::now();
                    let last     = last_emit.entry(kind).or_insert(epoch);
                    let debounce = debounce_for(kind);

                    if now.duration_since(*last) >= debounce {
                        *last = now;
                        app.emit("audio-changed", kind).ok();
                    }
                }

                // pactl exited (e.g. PipeWire restarted) — restart.
                log::warn!("pactl subscribe exited, restarting...");
                let _ = child.wait();
                std::thread::sleep(Duration::from_secs(1));
            }
        })
        .expect("failed to spawn subscribe thread");
}

// ─────────────────────────────────────────────────────────────
//  Tauri commands — data fetchers
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_sinks() -> Value {
    let nodes     = pw_dump();
    let pa_sinks  = pactl_json("sinks");
    let def       = default_sink();
    let empty     = vec![];

    let result: Vec<Value> = nodes.as_array().unwrap_or(&empty).iter()
        .filter(|n| {
            n["type"] == "PipeWire:Interface:Node" &&
                n["info"]["props"]["media.class"] == "Audio/Sink"
        })
        .map(|n| {
            let props     = &n["info"]["props"];
            let node_name = props["node.name"].as_str().unwrap_or("");
            let node_id   = n["id"].as_i64().unwrap_or(-1);
            let empty2    = vec![];

            let pa = pa_sinks.as_array().unwrap_or(&empty2).iter()
                .find(|s| s["name"].as_str().unwrap_or("") == node_name)
                .cloned()
                .unwrap_or(Value::Null);

            let (vol, muted) = get_wpctl_vol_mute(node_id).unwrap_or_else(|| {
                let v = pa["volume"]["front-left"]["value_percent"]
                    .as_str().unwrap_or("100%").replace('%', "")
                    .parse::<f64>().unwrap_or(100.0) as i64;
                (v, pa["mute"].as_bool().unwrap_or(false))
            });

            let empty3 = vec![];
            let ports: Vec<Value> = pa["ports"].as_array().unwrap_or(&empty3).iter()
                .map(|p| serde_json::json!({
                    "name":        p["name"],
                    "description": p["description"],
                    "available":   p["availability"].as_str().unwrap_or("") != "not available"
                }))
                .collect();

            serde_json::json!({
                "id":         node_id,
                "name":       props["node.description"].as_str()
                              .or(props["node.nick"].as_str())
                              .or(props["node.name"].as_str())
                              .unwrap_or("Unknown"),
                "nodeName":   node_name,
                "volume":     vol,
                "muted":      muted,
                "isDefault":  node_name == def,
                "ports":      ports,
                "activePort": pa["active_port"]
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_sources() -> Value {
    let nodes      = pw_dump();
    let pa_sources = pactl_json("sources");
    let def        = default_source();
    let empty      = vec![];

    let result: Vec<Value> = nodes.as_array().unwrap_or(&empty).iter()
        .filter(|n| {
            n["type"] == "PipeWire:Interface:Node" &&
                n["info"]["props"]["media.class"] == "Audio/Source" &&
                !n["info"]["props"]["node.name"].as_str().unwrap_or("").contains(".monitor")
        })
        .map(|n| {
            let props     = &n["info"]["props"];
            let node_name = props["node.name"].as_str().unwrap_or("");
            let node_id   = n["id"].as_i64().unwrap_or(-1);
            let empty2    = vec![];

            let pa = pa_sources.as_array().unwrap_or(&empty2).iter()
                .find(|s| s["name"].as_str().unwrap_or("") == node_name)
                .cloned()
                .unwrap_or(Value::Null);

            let (vol, muted) = get_wpctl_vol_mute(node_id).unwrap_or_else(|| {
                let v = pa["volume"]["front-left"]["value_percent"]
                    .as_str().unwrap_or("100%").replace('%', "")
                    .parse::<f64>().unwrap_or(100.0) as i64;
                (v, pa["mute"].as_bool().unwrap_or(false))
            });

            let empty3 = vec![];
            let ports: Vec<Value> = pa["ports"].as_array().unwrap_or(&empty3).iter()
                .map(|p| serde_json::json!({ "name": p["name"], "description": p["description"] }))
                .collect();

            serde_json::json!({
                "id":         node_id,
                "name":       props["node.description"].as_str()
                              .or(props["node.nick"].as_str())
                              .or(props["node.name"].as_str())
                              .unwrap_or("Unknown"),
                "nodeName":   node_name,
                "volume":     vol,
                "muted":      muted,
                "isDefault":  node_name == def,
                "ports":      ports,
                "activePort": pa["active_port"]
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_sink_inputs() -> Value {
    let inputs = pactl_json("sink-inputs");
    let sinks  = pactl_json("sinks");
    let empty  = vec![];

    let result: Vec<Value> = inputs.as_array().unwrap_or(&empty).iter()
        .map(|i| {
            let app_name = i["properties"]["application.name"].as_str()
                .or(i["properties"]["media.name"].as_str())
                .unwrap_or("Unknown");
            let vol = i["volume"]["front-left"]["value_percent"]
                .as_str().unwrap_or("100%").replace('%', "")
                .parse::<f64>().unwrap_or(100.0) as i64;
            let sink_idx = i["sink"].as_i64().unwrap_or(-1);
            let empty2   = vec![];
            let sink_name = sinks.as_array().unwrap_or(&empty2).iter()
                .find(|s| s["index"].as_i64().unwrap_or(-2) == sink_idx)
                .and_then(|s| s["name"].as_str())
                .unwrap_or("");

            serde_json::json!({
                "id":        i["index"],
                "appName":   app_name,
                "mediaName": i["properties"]["media.name"],
                "volume":    vol,
                "muted":     i["mute"].as_bool().unwrap_or(false),
                "sinkIndex": sink_idx,
                "sinkName":  sink_name,
                "corked":    i["corked"].as_bool().unwrap_or(false)
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_source_outputs() -> Value {
    let outputs = pactl_json("source-outputs");
    let empty   = vec![];

    let result: Vec<Value> = outputs.as_array().unwrap_or(&empty).iter()
        .map(|o| {
            let app_name = o["properties"]["application.name"].as_str()
                .or(o["properties"]["media.name"].as_str())
                .unwrap_or("Unknown");
            let vol = o["volume"]["front-left"]["value_percent"]
                .as_str().unwrap_or("100%").replace('%', "")
                .parse::<f64>().unwrap_or(100.0) as i64;

            serde_json::json!({
                "id":          o["index"],
                "appName":     app_name,
                "mediaName":   o["properties"]["media.name"],
                "volume":      vol,
                "muted":       o["mute"].as_bool().unwrap_or(false),
                "sourceIndex": o["source"],
                "corked":      o["corked"].as_bool().unwrap_or(false)
            })
        })
        .collect();

    Value::Array(result)
}

#[tauri::command]
fn get_cards() -> Value {
    let cards = pactl_json("cards");
    let empty = vec![];

    let result: Vec<Value> = cards.as_array().unwrap_or(&empty).iter()
        .map(|c| {
            let empty_map = serde_json::Map::new();
            let mut profiles: Vec<Value> = c["profiles"].as_object()
                .unwrap_or(&empty_map)
                .iter()
                .map(|(name, p)| serde_json::json!({
                    "name":        name,
                    "description": p["description"],
                    "available":   p["available"].as_str().unwrap_or("") != "no",
                    "priority":    p["priority"].as_i64().unwrap_or(0)
                }))
                .collect();
            profiles.sort_by(|a, b| {
                b["priority"].as_i64().unwrap_or(0)
                    .cmp(&a["priority"].as_i64().unwrap_or(0))
            });

            serde_json::json!({
                "id":            c["index"],
                "name":          c["name"],
                "description":   c["properties"]["device.description"]
                                 .as_str()
                                 .unwrap_or(c["name"].as_str().unwrap_or("")),
                "driver":        c["properties"]["device.api"],
                "activeProfile": c["active_profile"],
                "profiles":      profiles
            })
        })
        .collect();

    Value::Array(result)
}

// ─────────────────────────────────────────────────────────────
//  Tauri commands — mutators
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn set_volume(id: i64, volume: i64) -> bool {
    let vol = (volume as f64 / 100.0).clamp(0.0, 1.5);
    Command::new("wpctl")
        .args(["set-volume", &id.to_string(), &format!("{vol:.2}")])
        .status().is_ok()
}

#[tauri::command]
fn set_stream_volume(id: i64, volume: i64, kind: String) -> bool {
    let vol    = format!("{}%", volume.clamp(0, 150));
    let subcmd = if kind == "source-output" { "set-source-output-volume" } else { "set-sink-input-volume" };
    Command::new("pactl").args([subcmd, &id.to_string(), &vol]).status().is_ok()
}

#[tauri::command]
fn set_mute(id: i64, mute: bool) -> bool {
    Command::new("wpctl")
        .args(["set-mute", &id.to_string(), if mute { "1" } else { "0" }])
        .status().is_ok()
}

#[tauri::command]
fn set_stream_mute(id: i64, mute: bool, kind: String) -> bool {
    let subcmd = if kind == "source-output" { "set-source-output-mute" } else { "set-sink-input-mute" };
    Command::new("pactl")
        .args([subcmd, &id.to_string(), if mute { "1" } else { "0" }])
        .status().is_ok()
}

#[tauri::command]
fn set_default(id: i64) -> bool {
    Command::new("wpctl").args(["set-default", &id.to_string()]).status().is_ok()
}

#[tauri::command]
fn move_stream(stream_id: i64, target_name: String, kind: String) -> bool {
    let subcmd = if kind == "source-output" { "move-source-output" } else { "move-sink-input" };
    Command::new("pactl")
        .args([subcmd, &stream_id.to_string(), &target_name])
        .status().is_ok()
}

#[tauri::command]
fn set_port(device_name: String, port: String, kind: String) -> bool {
    let subcmd = if kind == "source" { "set-source-port" } else { "set-sink-port" };
    Command::new("pactl").args([subcmd, &device_name, &port]).status().is_ok()
}

#[tauri::command]
fn set_profile(card_name: String, profile: String) -> bool {
    Command::new("pactl")
        .args(["set-card-profile", &card_name, &profile])
        .status().is_ok()
}

// ─────────────────────────────────────────────────────────────
//  User theme — loads ~/.config/archeaudio/user_theme.css
//  so users can "rice" the app without touching source files.
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_user_theme() -> String {
    dirs::config_dir()
        .map(|d| d.join("archeaudio").join("user_theme.css"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_default()
}

// ─────────────────────────────────────────────────────────────
//  Theme persistence — saves/loads the active built-in theme
//  name to ~/.config/archeaudio/theme.json so the selection
//  survives restarts.  The CSS itself lives in themes.js on
//  the frontend; we only store the name string here.
// ─────────────────────────────────────────────────────────────

fn theme_path() -> Option<std::path::PathBuf> {
    dirs::config_dir().map(|d| d.join("archeaudio").join("theme.json"))
}

#[tauri::command]
fn save_theme(name: String) -> bool {
    let Some(path) = theme_path() else { return false };
    // Ensure the directory exists before writing.
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(path, format!("{{\"theme\":\"{name}\"}}")).is_ok()
}

/// Returns the saved theme name, or "archeaudio" if nothing is saved yet.
#[tauri::command]
fn load_theme() -> String {
    theme_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v["theme"].as_str().map(String::from))
        .unwrap_or_else(|| "archeaudio".to_string())
}

// ─────────────────────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // GTK's slice allocator conflicts with mimalloc on some Arch
    // setups — this forces it to use the standard malloc path.
    std::env::set_var("G_SLICE", "always-malloc");
    // Disable DMA-BUF renderer to avoid WebKit flicker on some GPUs.
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    tauri::Builder::default()
        .setup(|app| {
            spawn_subscribe(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sinks, get_sources, get_sink_inputs, get_source_outputs, get_cards,
            set_volume, set_stream_volume, set_mute, set_stream_mute,
            set_default, move_stream, set_port, set_profile,
            get_user_theme, save_theme, load_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error running ArcheAudio");
}