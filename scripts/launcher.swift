import Cocoa

// ─── AppDelegate ─────────────────────────────────────────────────────────────

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {

    var statusItem: NSStatusItem!
    var mainWindow:  NSWindow!
    var nodeProcess: Process?

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // no Dock icon

        setupStatusBar()
        createWindow()
        launchNode()

        // Open browser after server warms up
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            NSWorkspace.shared.open(URL(string: "http://localhost:7777")!)
        }

        showWindow()
    }

    func applicationWillTerminate(_ notification: Notification) {
        nodeProcess?.terminate()
        nodeProcess?.waitUntilExit()
    }

    // MARK: - Node Process

    func launchNode() {
        let execURL       = Bundle.main.executableURL!
        let resourcesURL  = execURL
            .deletingLastPathComponent()            // MacOS/
            .appendingPathComponent("../Resources") // Contents/Resources
            .standardized
        let nodeURL   = resourcesURL.appendingPathComponent("node")
        let bridgeURL = resourcesURL.appendingPathComponent("bridge.cjs")

        // Strip quarantine flag so the binary can execute
        let xattr = Process()
        xattr.executableURL = URL(fileURLWithPath: "/usr/bin/xattr")
        xattr.arguments = ["-d", "com.apple.quarantine", nodeURL.path, bridgeURL.path]
        xattr.standardOutput = FileHandle.nullDevice
        xattr.standardError  = FileHandle.nullDevice
        try? xattr.run(); xattr.waitUntilExit()

        let proc = Process()
        proc.executableURL      = nodeURL
        proc.arguments          = [bridgeURL.path]
        proc.currentDirectoryURL = resourcesURL
        proc.terminationHandler = { [weak self] p in
            guard p.terminationStatus != 0 else { return }
            DispatchQueue.main.async {
                self?.showAlert(
                    title:   "CineLink Bridge stopped",
                    message: "Server process exited (code \(p.terminationStatus))."
                )
            }
        }

        do {
            try proc.run()
            nodeProcess = proc
        } catch {
            showAlert(title: "Launch Failed",
                      message: "Could not start bridge:\n\(error.localizedDescription)")
        }
    }

    // MARK: - Status Bar

    func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        guard let btn = statusItem.button else { return }

        if let img = NSImage(systemSymbolName: "video.circle.fill",
                             accessibilityDescription: "CineLink Bridge") {
            img.isTemplate = true
            btn.image = img
        } else {
            btn.title = "⏺"
        }
        btn.toolTip = "CineLink Bridge"
        btn.action  = #selector(statusBarClicked)
        btn.target  = self
    }

    @objc func statusBarClicked() { showWindow() }

    // MARK: - Window

    func createWindow() {
        mainWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 340, height: 200),
            styleMask:   [.titled, .closable],
            backing:     .buffered,
            defer:       false
        )
        mainWindow.title              = "CineLink Bridge β2"
        mainWindow.delegate           = self
        mainWindow.isReleasedWhenClosed = false
        mainWindow.appearance         = NSAppearance(named: .darkAqua)
        mainWindow.center()

        let cv = mainWindow.contentView!

        // Status label
        let statusLabel = NSTextField(labelWithString: "Server running on localhost:7777")
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font      = NSFont.systemFont(ofSize: 13, weight: .medium)
        statusLabel.textColor = NSColor.secondaryLabelColor
        statusLabel.alignment = .center
        cv.addSubview(statusLabel)

        // Open UI button (accent)
        let openBtn = NSButton(title: "Open UI", target: self, action: #selector(openUI))
        openBtn.translatesAutoresizingMaskIntoConstraints = false
        openBtn.bezelStyle  = .rounded
        openBtn.controlSize = .large
        openBtn.keyEquivalent = "\r"
        cv.addSubview(openBtn)

        // Quit button
        let quitBtn = NSButton(title: "Quit CineLink Bridge", target: self, action: #selector(quitApp))
        quitBtn.translatesAutoresizingMaskIntoConstraints = false
        quitBtn.bezelStyle  = .rounded
        quitBtn.controlSize = .regular
        cv.addSubview(quitBtn)

        NSLayoutConstraint.activate([
            statusLabel.centerXAnchor.constraint(equalTo: cv.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: cv.topAnchor, constant: 32),

            openBtn.centerXAnchor.constraint(equalTo: cv.centerXAnchor),
            openBtn.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 24),
            openBtn.widthAnchor.constraint(equalToConstant: 240),

            quitBtn.centerXAnchor.constraint(equalTo: cv.centerXAnchor),
            quitBtn.topAnchor.constraint(equalTo: openBtn.bottomAnchor, constant: 14),
            quitBtn.widthAnchor.constraint(equalToConstant: 200),
        ])
    }

    func showWindow() {
        mainWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // Close button → hide to tray
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        mainWindow.orderOut(nil)
        return false
    }

    // MARK: - Actions

    @objc func openUI() {
        NSWorkspace.shared.open(URL(string: "http://localhost:7777")!)
    }

    @objc func quitApp() {
        nodeProcess?.terminate()
        NSApp.terminate(nil)
    }

    // MARK: - Helpers

    func showAlert(title: String, message: String) {
        let a = NSAlert()
        a.messageText     = title
        a.informativeText = message
        a.alertStyle      = .warning
        a.runModal()
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

let app      = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
