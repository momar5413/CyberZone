// يمنع ظهور نافذة الأوامر السوداء مع البرنامج على ويندوز
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cyberzone_lib::run();
}
