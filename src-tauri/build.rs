fn main() {
    // 设置PyO3环境变量以避免版本兼容性问题
    println!("cargo:rustc-env=PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1");
    
    // 运行tauri-build
    tauri_build::build()
}
