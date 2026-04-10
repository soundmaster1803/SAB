import Cocoa

// ─── Custom Window ────────────────────────────────────────────────────────────

class BridgeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
}

// ─── Status Dot ───────────────────────────────────────────────────────────────

class StatusDotView: NSView {
    var color: NSColor = .systemGreen { didSet { needsDisplay = true } }
    override func draw(_ rect: NSRect) {
        color.setFill()
        let r = min(bounds.width, bounds.height) / 2
        let path = NSBezierPath(ovalIn: bounds.insetBy(dx: bounds.width/2 - r, dy: bounds.height/2 - r))
        path.fill()
    }
}

// ─── AppDelegate ──────────────────────────────────────────────────────────────

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {

    var statusItem: NSStatusItem!
    var mainWindow: NSWindow!
    var nodeProcess: Process?

    // MARK: - Launch

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)

        // Custom Dock icon from bundle
        if let icon = NSImage(contentsOfFile: Bundle.main.resourcePath! + "/AppIcon.icns") {
            NSApp.applicationIconImage = icon
        }

        setupStatusBar()
        createWindow()
        launchNode()
        showWindow()
    }

    func applicationWillTerminate(_ notification: Notification) {
        nodeProcess?.terminate()
        nodeProcess?.waitUntilExit()
    }

    // MARK: - Node Process

    func launchNode() {
        let execURL = Bundle.main.executableURL!
        let resourcesURL = execURL
            .deletingLastPathComponent()
            .appendingPathComponent("../Resources")
            .standardized

        let nodeURL   = resourcesURL.appendingPathComponent("node")
        let bridgeURL = resourcesURL.appendingPathComponent("bridge.cjs")

        let xattr = Process()
        xattr.executableURL = URL(fileURLWithPath: "/usr/bin/xattr")
        xattr.arguments = ["-d", "com.apple.quarantine", nodeURL.path, bridgeURL.path]
        xattr.standardOutput = FileHandle.nullDevice
        xattr.standardError  = FileHandle.nullDevice
        try? xattr.run(); xattr.waitUntilExit()

        let proc = Process()
        proc.executableURL       = nodeURL
        proc.arguments           = [bridgeURL.path]
        proc.currentDirectoryURL = resourcesURL
        proc.terminationHandler  = { [weak self] p in
            guard p.terminationStatus != 0 else { return }
            DispatchQueue.main.async {
                self?.showAlert(title: "CineLink Bridge stopped",
                                message: "Server exited with code \(p.terminationStatus).")
            }
        }
        do { try proc.run(); nodeProcess = proc }
        catch { showAlert(title: "Launch Failed", message: error.localizedDescription) }
    }

    // MARK: - Status Bar

    func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        guard let btn = statusItem.button else { return }
        if let img = NSImage(systemSymbolName: "video.circle.fill", accessibilityDescription: "CineLink Bridge") {
            img.isTemplate = true
            btn.image = img
        } else { btn.title = "⏺" }
        btn.toolTip = "CineLink Bridge"
        btn.action  = #selector(statusBarClicked)
        btn.target  = self
    }

    @objc func statusBarClicked() { showWindow() }

    // MARK: - Window

    func createWindow() {
        let w: CGFloat = 320
        let h: CGFloat = 290

        mainWindow = BridgeWindow(
            contentRect: NSRect(x: 0, y: 0, width: w, height: h),
            styleMask:   [.titled, .closable, .fullSizeContentView],
            backing:     .buffered,
            defer:       false
        )
        mainWindow.title                     = "CineLink Bridge"
        mainWindow.titlebarAppearsTransparent = true
        mainWindow.titleVisibility           = .hidden
        mainWindow.isMovableByWindowBackground = true
        mainWindow.delegate                  = self
        mainWindow.isReleasedWhenClosed      = false
        mainWindow.appearance                = NSAppearance(named: .darkAqua)
        mainWindow.backgroundColor           = NSColor(red: 0.07, green: 0.07, blue: 0.10, alpha: 1)
        mainWindow.center()

        buildContent(in: mainWindow.contentView!, width: w, height: h)
    }

    func buildContent(in cv: NSView, width w: CGFloat, height h: CGFloat) {
        cv.wantsLayer = true
        cv.layer?.backgroundColor = NSColor(red: 0.07, green: 0.07, blue: 0.10, alpha: 1).cgColor

        // ── Top gradient stripe ───────────────────────────────────────────────
        let stripe = NSView(frame: NSRect(x: 0, y: h - 90, width: w, height: 90))
        stripe.wantsLayer = true
        let grad = CAGradientLayer()
        grad.frame = stripe.bounds
        grad.colors = [NSColor(red: 0.0, green: 0.30, blue: 0.65, alpha: 0.25).cgColor,
                       NSColor.clear.cgColor]
        grad.startPoint = CGPoint(x: 0.5, y: 1)
        grad.endPoint   = CGPoint(x: 0.5, y: 0)
        stripe.layer?.addSublayer(grad)
        cv.addSubview(stripe)

        // ── App Icon ──────────────────────────────────────────────────────────
        let iconView = NSImageView(frame: NSRect(x: (w - 56) / 2, y: h - 86, width: 56, height: 56))
        if let icon = NSImage(contentsOfFile: Bundle.main.resourcePath! + "/AppIcon.icns") {
            iconView.image = icon
        } else if let sym = NSImage(systemSymbolName: "video.circle.fill", accessibilityDescription: nil) {
            iconView.image = sym
        }
        iconView.imageScaling = .scaleProportionallyUpOrDown
        cv.addSubview(iconView)

        // ── Title ─────────────────────────────────────────────────────────────
        let title = NSTextField(labelWithString: "CineLink Bridge")
        title.frame = NSRect(x: 0, y: h - 110, width: w, height: 22)
        title.alignment = .center
        title.font = NSFont.systemFont(ofSize: 15, weight: .semibold)
        title.textColor = .white
        cv.addSubview(title)

        // ── Subtitle ──────────────────────────────────────────────────────────
        let sub = NSTextField(labelWithString: "Beta 3  ·  Sony PTP/IP ↔ ATEM")
        sub.frame = NSRect(x: 0, y: h - 130, width: w, height: 16)
        sub.alignment = .center
        sub.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        sub.textColor = NSColor.white.withAlphaComponent(0.35)
        cv.addSubview(sub)

        // ── Separator line ────────────────────────────────────────────────────
        let sep = NSBox(frame: NSRect(x: 24, y: h - 145, width: w - 48, height: 1))
        sep.boxType = .separator
        sep.borderColor = NSColor.white.withAlphaComponent(0.08)
        cv.addSubview(sep)

        // ── Status row ────────────────────────────────────────────────────────
        let dot = StatusDotView(frame: NSRect(x: 0, y: 0, width: 8, height: 8))
        dot.color = .systemGreen

        let statusLabel = NSTextField(labelWithString: "Server running · localhost:7777")
        statusLabel.font = NSFont.systemFont(ofSize: 12)
        statusLabel.textColor = NSColor.white.withAlphaComponent(0.5)

        let rowStack = NSStackView(views: [dot, statusLabel])
        rowStack.orientation = .horizontal
        rowStack.spacing = 7
        rowStack.alignment = .centerY

        // Wrap in a centering container
        let rowWrap = NSView()
        rowWrap.addSubview(rowStack)
        rowStack.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            rowStack.centerXAnchor.constraint(equalTo: rowWrap.centerXAnchor),
            rowStack.centerYAnchor.constraint(equalTo: rowWrap.centerYAnchor),
            rowWrap.heightAnchor.constraint(equalToConstant: 20),
        ])

        // ── Open UI button ────────────────────────────────────────────────────
        let openBtn = NSButton(title: "Open UI", target: self, action: #selector(openUI))
        openBtn.bezelStyle    = .rounded
        openBtn.controlSize   = .large
        openBtn.keyEquivalent = "\r"
        openBtn.contentTintColor = .white
        if let cell = openBtn.cell as? NSButtonCell {
            cell.backgroundColor = NSColor(red: 0.0, green: 0.478, blue: 1.0, alpha: 1)
        }

        // ── Quit button ───────────────────────────────────────────────────────
        let quitBtn = NSButton(title: "Quit CineLink Bridge", target: self, action: #selector(quitApp))
        quitBtn.bezelStyle  = .inline
        quitBtn.controlSize = .small
        quitBtn.isBordered  = false
        quitBtn.contentTintColor = NSColor.white.withAlphaComponent(0.28)

        // ── Vertical stack ────────────────────────────────────────────────────
        let stack = NSStackView(views: [rowWrap, openBtn, quitBtn])
        stack.orientation  = .vertical
        stack.spacing      = 14
        stack.alignment    = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false
        cv.addSubview(stack)

        NSLayoutConstraint.activate([
            openBtn.widthAnchor.constraint(equalToConstant: 260),
            stack.centerXAnchor.constraint(equalTo: cv.centerXAnchor),
            stack.bottomAnchor.constraint(equalTo: cv.bottomAnchor, constant: -28),
        ])
    }

    func showWindow() {
        NSApp.setActivationPolicy(.regular)
        mainWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // Close → hide to tray, remove from Dock
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        mainWindow.orderOut(nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) {
            NSApp.setActivationPolicy(.accessory)
        }
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

// ─── Entry point ──────────────────────────────────────────────────────────────

let app      = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
